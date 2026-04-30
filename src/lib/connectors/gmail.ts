import { tool } from "ai";
import { z } from "zod";
import type { ConnectorDef } from "./types";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "openid",
  "email",
];

function bearer(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 ? "=".repeat(4 - (padded.length % 4)) : "";
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

type GmailPayloadPart = {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
};

function extractTextFromPayload(part: GmailPayloadPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    try { return base64UrlDecode(part.body.data); } catch { return ""; }
  }
  if (part.parts) {
    for (const p of part.parts) {
      const t = extractTextFromPayload(p);
      if (t) return t;
    }
  }
  // fallback to first available body
  if (part.body?.data) {
    try { return base64UrlDecode(part.body.data); } catch { return ""; }
  }
  return "";
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value;
}

export const gmailConnector: ConnectorDef = {
  id: "gmail",
  displayName: "Gmail",
  scopes: SCOPES,

  authUrl({ clientId, redirectUri, state }) {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", SCOPES.join(" "));
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("state", state);
    return u.toString();
  },

  async tokenExchange({ code, clientId, clientSecret, redirectUri }) {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`gmail token exchange failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  },

  async refresh({ refreshToken, clientId, clientSecret }) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`gmail refresh failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  },

  async fetchAccount(accessToken) {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: bearer(accessToken),
    });
    if (!res.ok) throw new Error(`gmail fetchAccount failed: ${res.status}`);
    const data = (await res.json()) as { emailAddress: string };
    return { email: data.emailAddress };
  },

  buildTools(_ctx, accessToken) {
    return {
      gmail_search: tool({
        description:
          "Search the user's Gmail messages. Returns id, threadId, from, subject, snippet, internalDate. Use Gmail search operators (from:, subject:, after:, label:, is:unread).",
        inputSchema: z.object({
          query: z.string().min(1),
          max: z.number().int().min(1).max(50).optional().default(10),
        }),
        execute: async ({ query, max }) => {
          const u = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
          u.searchParams.set("q", query);
          u.searchParams.set("maxResults", String(max));
          const listRes = await fetch(u, { headers: bearer(accessToken) });
          if (!listRes.ok) return { success: false, error: `gmail ${listRes.status}` };
          const list = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }> };
          if (!list.messages || list.messages.length === 0) return { success: true, messages: [] };
          const detailed = await Promise.all(
            list.messages.map(async (m) => {
              const r = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                { headers: bearer(accessToken) }
              );
              if (!r.ok) return null;
              const msg = (await r.json()) as {
                id: string; threadId: string; snippet?: string; internalDate?: string;
                payload?: { headers?: Array<{ name: string; value: string }> };
              };
              return {
                id: msg.id,
                threadId: msg.threadId,
                from: header(msg.payload?.headers, "From") ?? null,
                subject: header(msg.payload?.headers, "Subject") ?? null,
                snippet: msg.snippet ?? "",
                internalDate: msg.internalDate ?? null,
              };
            })
          );
          return { success: true, messages: detailed.filter(Boolean) };
        },
      }),

      gmail_get_thread: tool({
        description: "Read all messages in a Gmail thread, including text bodies and headers.",
        inputSchema: z.object({ threadId: z.string().min(1) }),
        execute: async ({ threadId }) => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
            { headers: bearer(accessToken) }
          );
          if (!res.ok) return { success: false, error: `gmail ${res.status}` };
          const data = (await res.json()) as {
            id: string;
            messages?: Array<{
              id: string; internalDate?: string;
              payload?: GmailPayloadPart;
            }>;
          };
          const messages = (data.messages ?? []).map((m) => ({
            id: m.id,
            internalDate: m.internalDate ?? null,
            from: header(m.payload?.headers, "From") ?? null,
            to: header(m.payload?.headers, "To") ?? null,
            subject: header(m.payload?.headers, "Subject") ?? null,
            date: header(m.payload?.headers, "Date") ?? null,
            body: extractTextFromPayload(m.payload).slice(0, 20_000),
          }));
          return { success: true, threadId: data.id, messages };
        },
      }),

      gmail_send: tool({
        description:
          "Send an email from the user's Gmail account. Confirm intent with the user before calling. Set replyToThreadId to reply within an existing thread.",
        inputSchema: z.object({
          to: z.string().min(1),
          subject: z.string(),
          body: z.string(),
          replyToThreadId: z.string().optional(),
        }),
        execute: async ({ to, subject, body, replyToThreadId }) => {
          const rfc822 = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "MIME-Version: 1.0",
            'Content-Type: text/plain; charset="UTF-8"',
            "",
            body,
          ].join("\r\n");
          const raw = base64UrlEncode(rfc822);
          const payload: Record<string, unknown> = { raw };
          if (replyToThreadId) payload.threadId = replyToThreadId;
          const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: { ...bearer(accessToken), "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) return { success: false, error: `gmail ${res.status}: ${await res.text()}` };
          const sent = (await res.json()) as { id: string; threadId: string };
          return { success: true, id: sent.id, threadId: sent.threadId };
        },
      }),

      gmail_label_thread: tool({
        description:
          "Add or remove labels on a Gmail thread (e.g. add ['UNREAD'] / ['STARRED'], remove ['INBOX']). Use Gmail's system label IDs or label IDs from listLabels.",
        inputSchema: z.object({
          threadId: z.string().min(1),
          addLabels: z.array(z.string()).optional(),
          removeLabels: z.array(z.string()).optional(),
        }),
        execute: async ({ threadId, addLabels, removeLabels }) => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`,
            {
              method: "POST",
              headers: { ...bearer(accessToken), "Content-Type": "application/json" },
              body: JSON.stringify({
                addLabelIds: addLabels ?? [],
                removeLabelIds: removeLabels ?? [],
              }),
            }
          );
          if (!res.ok) return { success: false, error: `gmail ${res.status}: ${await res.text()}` };
          return { success: true };
        },
      }),
    };
  },
};
