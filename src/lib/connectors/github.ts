import { tool } from "ai";
import { z } from "zod";
import type { ConnectorDef } from "./types";

const SCOPES = ["repo", "read:user", "user:email"];

function gh(accessToken: string, accept = "application/vnd.github+json") {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: accept,
    "User-Agent": "openmlc",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export const githubConnector: ConnectorDef = {
  id: "github",
  displayName: "GitHub",
  scopes: SCOPES,

  authUrl({ clientId, redirectUri, state }) {
    const u = new URL("https://github.com/login/oauth/authorize");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", SCOPES.join(","));
    u.searchParams.set("state", state);
    return u.toString();
  },

  async tokenExchange({ code, clientId, clientSecret, redirectUri }) {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`github token exchange failed: ${res.status}`);
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!data.access_token) {
      throw new Error(`github token exchange error: ${data.error_description ?? data.error ?? "no token"}`);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  },

  async refresh({ refreshToken, clientId, clientSecret }) {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`github refresh failed: ${res.status}`);
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) throw new Error("github refresh: no token returned");
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  },

  async fetchAccount(accessToken) {
    const res = await fetch("https://api.github.com/user", { headers: gh(accessToken) });
    if (!res.ok) throw new Error(`github fetchAccount failed: ${res.status}`);
    const u = (await res.json()) as { id: number; login: string; name?: string; email?: string };
    return { id: String(u.id), login: u.login, name: u.name ?? undefined, email: u.email ?? undefined };
  },

  buildTools(_ctx, accessToken) {
    return {
      github_list_repos: tool({
        description:
          "List GitHub repositories the authenticated user has access to. Use to find repo names before calling other GitHub tools.",
        inputSchema: z.object({
          visibility: z.enum(["all", "owner", "member"]).optional().default("all"),
        }),
        execute: async ({ visibility }) => {
          const u = new URL("https://api.github.com/user/repos");
          u.searchParams.set("per_page", "50");
          u.searchParams.set("sort", "updated");
          u.searchParams.set("affiliation", visibility === "owner" ? "owner" : visibility === "member" ? "collaborator,organization_member" : "owner,collaborator,organization_member");
          const res = await fetch(u, { headers: gh(accessToken) });
          if (!res.ok) return { success: false, error: `github ${res.status}` };
          const repos = (await res.json()) as Array<{
            full_name: string; private: boolean; description: string | null; html_url: string; default_branch: string; updated_at: string;
          }>;
          return {
            success: true,
            repos: repos.map((r) => ({
              full_name: r.full_name,
              private: r.private,
              description: r.description,
              url: r.html_url,
              default_branch: r.default_branch,
              updated_at: r.updated_at,
            })),
          };
        },
      }),

      github_search_code: tool({
        description:
          "Search code on GitHub. Optionally scope to an owner and repo. The query uses GitHub code search syntax.",
        inputSchema: z.object({
          query: z.string().min(1),
          owner: z.string().optional(),
          repo: z.string().optional(),
        }),
        execute: async ({ query, owner, repo }) => {
          let q = query;
          if (owner && repo) q = `${q} repo:${owner}/${repo}`;
          else if (owner) q = `${q} user:${owner}`;
          const u = new URL("https://api.github.com/search/code");
          u.searchParams.set("q", q);
          u.searchParams.set("per_page", "20");
          const res = await fetch(u, { headers: gh(accessToken) });
          if (res.status === 422) {
            return {
              success: false,
              error:
                "GitHub code search requires a scoped query (e.g. include `repo:owner/name` or `user:owner`). Provide owner+repo or refine the query.",
            };
          }
          if (!res.ok) return { success: false, error: `github ${res.status}` };
          const data = (await res.json()) as {
            total_count: number;
            items: Array<{ name: string; path: string; html_url: string; repository: { full_name: string } }>;
          };
          return {
            success: true,
            total: data.total_count,
            items: data.items.map((i) => ({
              repo: i.repository.full_name,
              path: i.path,
              name: i.name,
              url: i.html_url,
            })),
          };
        },
      }),

      github_get_issue: tool({
        description: "Read a GitHub issue's title, body, state, labels, and comments count.",
        inputSchema: z.object({
          owner: z.string(),
          repo: z.string(),
          number: z.number().int().positive(),
        }),
        execute: async ({ owner, repo, number }) => {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
            headers: gh(accessToken),
          });
          if (!res.ok) return { success: false, error: `github ${res.status}` };
          const i = (await res.json()) as {
            number: number; title: string; body: string | null; state: string; html_url: string;
            user: { login: string }; labels: Array<{ name: string }>; comments: number;
          };
          return {
            success: true,
            issue: {
              number: i.number,
              title: i.title,
              body: i.body,
              state: i.state,
              url: i.html_url,
              author: i.user.login,
              labels: i.labels.map((l) => l.name),
              comments: i.comments,
            },
          };
        },
      }),

      github_create_issue: tool({
        description:
          "Create a new GitHub issue. Confirm with the user before calling — this writes to their repository.",
        inputSchema: z.object({
          owner: z.string(),
          repo: z.string(),
          title: z.string().min(1),
          body: z.string().optional(),
          labels: z.array(z.string()).optional(),
        }),
        execute: async ({ owner, repo, title, body, labels }) => {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: "POST",
            headers: { ...gh(accessToken), "Content-Type": "application/json" },
            body: JSON.stringify({ title, body, labels }),
          });
          if (!res.ok) return { success: false, error: `github ${res.status}: ${await res.text()}` };
          const i = (await res.json()) as { number: number; html_url: string };
          return { success: true, number: i.number, url: i.html_url };
        },
      }),

      github_get_pr_diff: tool({
        description: "Fetch the unified diff text for a GitHub pull request.",
        inputSchema: z.object({
          owner: z.string(),
          repo: z.string(),
          number: z.number().int().positive(),
        }),
        execute: async ({ owner, repo, number }) => {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
            headers: gh(accessToken, "application/vnd.github.diff"),
          });
          if (!res.ok) return { success: false, error: `github ${res.status}` };
          const diff = await res.text();
          // truncate large diffs
          const truncated = diff.length > 60_000;
          return {
            success: true,
            diff: truncated ? diff.slice(0, 60_000) + "\n... [truncated]" : diff,
            truncated,
          };
        },
      }),
    };
  },
};
