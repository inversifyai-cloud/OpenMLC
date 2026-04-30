import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { models as MODEL_REGISTRY } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

type Kind = "all" | "chat" | "setting" | "space" | "library" | "model";

type Result = {
  kind: "chat" | "setting" | "space" | "library" | "model";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  modelId?: string;
};

// Mirror of NAV_SECTIONS from src/components/settings/SettingsNav.tsx.
// Kept in sync manually so the palette can find pages without bundling client code.
const SETTINGS_PAGES: { href: string; label: string; hint?: string }[] = [
  { href: "/settings/profile", label: "profile", hint: "name, monogram, theme" },
  { href: "/settings/api-keys", label: "api keys", hint: "openai, anthropic, etc." },
  { href: "/settings/custom-providers", label: "custom providers", hint: "openai-compatible endpoints" },
  { href: "/settings/personas", label: "personas", hint: "system prompts" },
  { href: "/settings/prompts", label: "prompt library", hint: "reusable snippets" },
  { href: "/settings/memory", label: "memory", hint: "long-term facts" },
  { href: "/settings/knowledge", label: "knowledge", hint: "uploaded files" },
  { href: "/settings/voice", label: "voice", hint: "tts and stt" },
  { href: "/settings/connectors", label: "connectors", hint: "github, gmail, …" },
  { href: "/settings/mcp", label: "mcp servers", hint: "external tool servers" },
  { href: "/settings/sandbox", label: "code sandbox" },
  { href: "/settings/workflows", label: "workflows", hint: "schedules + webhooks" },
  { href: "/settings/swarm", label: "swarm", hint: "multi-agent runs" },
  { href: "/settings/usage", label: "usage", hint: "spend + limits" },
];

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ci(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const kindParam = (searchParams.get("kind") ?? "all") as Kind;
  const kind: Kind = (["all", "chat", "setting", "space", "library", "model"] as const).includes(kindParam)
    ? kindParam
    : "all";

  if (!q) return NextResponse.json({ results: [] });

  const perKindCap = kind === "all" ? 8 : 24;
  const totalCap = 24;
  const out: Result[] = [];

  // ── chats ───────────────────────────────────────────────────────────
  if (kind === "all" || kind === "chat") {
    const byTitle = await db.conversation.findMany({
      where: {
        profileId,
        archived: false,
        title: { contains: q },
      },
      orderBy: { updatedAt: "desc" },
      take: perKindCap,
      select: { id: true, title: true, modelId: true, updatedAt: true },
    });

    const seen = new Set(byTitle.map((c) => c.id));
    let extra: typeof byTitle = [];
    if (byTitle.length < perKindCap) {
      const byMessage = await db.message.findMany({
        where: {
          conversation: { profileId, archived: false },
          content: { contains: q },
        },
        orderBy: { createdAt: "desc" },
        take: perKindCap * 2,
        select: {
          conversation: { select: { id: true, title: true, modelId: true, updatedAt: true } },
        },
      });
      for (const m of byMessage) {
        if (!m.conversation) continue;
        if (seen.has(m.conversation.id)) continue;
        seen.add(m.conversation.id);
        extra.push(m.conversation);
        if (byTitle.length + extra.length >= perKindCap) break;
      }
    }

    const chats = [...byTitle, ...extra]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, perKindCap);

    for (const c of chats) {
      out.push({
        kind: "chat",
        id: c.id,
        title: c.title || "untitled",
        subtitle: `${c.modelId} · ${relTime(c.updatedAt)}`,
        href: `/chat/${c.id}`,
        modelId: c.modelId,
      });
    }
  }

  // ── settings (static) ──────────────────────────────────────────────
  if (kind === "all" || kind === "setting") {
    const matches = SETTINGS_PAGES.filter((p) => ci(p.label, q) || ci(p.hint ?? "", q)).slice(0, perKindCap);
    for (const p of matches) {
      out.push({
        kind: "setting",
        id: p.href,
        title: p.label,
        subtitle: p.hint,
        href: p.href,
      });
    }
  }

  // ── spaces ─────────────────────────────────────────────────────────
  if (kind === "all" || kind === "space") {
    const spaces = await db.space.findMany({
      where: { profileId, archived: false, name: { contains: q } },
      orderBy: { updatedAt: "desc" },
      take: perKindCap,
      select: { id: true, name: true, emoji: true, description: true },
    });
    for (const s of spaces) {
      out.push({
        kind: "space",
        id: s.id,
        title: s.emoji ? `${s.emoji} ${s.name}` : s.name,
        subtitle: s.description ?? undefined,
        href: `/spaces/${s.id}`,
      });
    }
  }

  // ── library (artifacts + research + browser) ───────────────────────
  if (kind === "all" || kind === "library") {
    const cap = perKindCap;
    const profileConvIds = await db.conversation.findMany({
      where: { profileId },
      select: { id: true },
    });
    const convIds = profileConvIds.map((c) => c.id);

    const [artifacts, research, browser] = await Promise.all([
      convIds.length === 0
        ? Promise.resolve([])
        : db.artifact.findMany({
            where: {
              conversationId: { in: convIds },
              title: { contains: q },
            },
            orderBy: { createdAt: "desc" },
            take: cap,
            select: { id: true, title: true, type: true, createdAt: true },
          }),
      convIds.length === 0
        ? Promise.resolve([])
        : db.researchSession.findMany({
            where: {
              conversationId: { in: convIds },
              query: { contains: q },
            },
            orderBy: { createdAt: "desc" },
            take: cap,
            select: { id: true, query: true, status: true, createdAt: true },
          }),
      db.browserSession.findMany({
        where: {
          profileId,
          startUrl: { contains: q },
        },
        orderBy: { createdAt: "desc" },
        take: cap,
        select: { id: true, startUrl: true, status: true, createdAt: true },
      }),
    ]);

    const merged: Result[] = [];
    for (const a of artifacts) {
      merged.push({
        kind: "library",
        id: `artifact:${a.id}`,
        title: a.title || "artifact",
        subtitle: `artifact · ${a.type} · ${relTime(a.createdAt)}`,
        href: `/library/artifact:${a.id}`,
      });
    }
    for (const r of research) {
      merged.push({
        kind: "library",
        id: `research:${r.id}`,
        title: r.query,
        subtitle: `research · ${r.status} · ${relTime(r.createdAt)}`,
        href: `/library/research:${r.id}`,
      });
    }
    for (const b of browser) {
      merged.push({
        kind: "library",
        id: `browser:${b.id}`,
        title: b.startUrl || "browser session",
        subtitle: `browser · ${b.status} · ${relTime(b.createdAt)}`,
        href: `/library/browser:${b.id}`,
      });
    }
    merged.sort((a, b) => (a.subtitle && b.subtitle ? 0 : 0));
    for (const m of merged.slice(0, cap)) out.push(m);
  }

  // ── models ─────────────────────────────────────────────────────────
  if (kind === "all" || kind === "model") {
    const matches = MODEL_REGISTRY
      .filter((m) => ci(m.id, q) || ci(m.name, q) || ci(m.providerId, q) || ci(m.bestFor ?? "", q))
      .slice(0, perKindCap);
    for (const m of matches) {
      out.push({
        kind: "model",
        id: m.id,
        title: m.name,
        subtitle: `${m.providerId}${m.bestFor ? ` · ${m.bestFor}` : ""}`,
        href: `/chat?model=${encodeURIComponent(m.id)}`,
        modelId: m.id,
      });
    }
  }

  // Cap total when "all".
  const finalResults = kind === "all" ? out.slice(0, totalCap) : out.slice(0, totalCap);
  return NextResponse.json({ results: finalResults });
}
