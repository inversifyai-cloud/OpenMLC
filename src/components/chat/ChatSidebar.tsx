"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AvatarMonogram } from "@/components/chrome/AvatarMonogram";
import { LogoutButton } from "./LogoutButton";
import { FolderManager, type Folder } from "./FolderManager";
import { ConvContextMenu } from "./ConvContextMenu";
import type { ConversationSummary } from "@/types/chat";
import type { AvatarAccent } from "@/types/profile";
import { getModel } from "@/lib/providers/registry";

type Props = {
  initialConversations: ConversationSummary[];
  profile: { displayName: string; username: string; avatarMonogram: string; avatarAccent: AvatarAccent };
};

type ConvExt = ConversationSummary & {
  archived?: boolean;
  folderId?: string | null;
  spaceId?: string | null;
};

// [spaces] light shape used for the in-space subhead grouping.
type SpaceLite = { id: string; name: string; emoji: string | null };

function shortModel(modelId: string): string {
  const m = getModel(modelId);
  if (!m) {
    const stripped = modelId.replace(/^or:/, "").replace(/:free$/, "");
    const last = stripped.split("/").pop() ?? stripped;
    return last;
  }
  return m.name.toLowerCase().replace(/^(gpt|claude|gemini|grok|llama|gemma|deepseek|qwen|mistral|nemotron|gpt-oss|glm|lfm)\s*/i, (s) => s);
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Bucket = { label: string; rows: ConvExt[] };

function bucketize(rows: ConvExt[], activeFolder: string | null): Bucket[] {

  const pinned = rows.filter((r) => r.pinned && !r.archived);
  const rest = rows.filter((r) => !r.pinned && !r.archived);

  const filtered = activeFolder
    ? rest.filter((r) => r.folderId === activeFolder)
    : rest;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const today: ConvExt[] = [];
  const yesterday: ConvExt[] = [];
  const week: ConvExt[] = [];
  const older: ConvExt[] = [];
  for (const r of filtered) {
    const age = now - new Date(r.updatedAt).getTime();
    if (age < day) today.push(r);
    else if (age < 2 * day) yesterday.push(r);
    else if (age < 7 * day) week.push(r);
    else older.push(r);
  }
  const out: Bucket[] = [];
  if (pinned.length) out.push({ label: "pinned", rows: pinned });
  if (today.length) out.push({ label: "today", rows: today });
  if (yesterday.length) out.push({ label: "yesterday", rows: yesterday });
  if (week.length) out.push({ label: "last 7 days", rows: week });
  if (older.length) out.push({ label: "older", rows: older });
  return out;
}

type ContextMenuState = {
  x: number;
  y: number;
  conv: ConvExt;
} | null;

export function ChatSidebar({ initialConversations, profile }: Props) {
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const activeId = params?.conversationId;
  const [conversations, setConversations] = useState<ConvExt[]>(initialConversations);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  // [spaces] light list of spaces for the in-space subhead.
  const [spaces, setSpaces] = useState<SpaceLite[]>([]);

  useEffect(() => {
    fetch("/api/spaces?light=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.spaces)) {
          setSpaces(d.spaces.filter((s: SpaceLite & { archived?: boolean }) => !s.archived));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.folders) setFolders(d.folders); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/conversations")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.conversations) return;
        setConversations(data.conversations);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeId]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return conversations;
    const q = filter.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, filter]);

  const buckets = useMemo(() => bucketize(filtered, activeFolder), [filtered, activeFolder]);

  // [spaces] Group conversations belonging to a space (renders above buckets).
  // Conversations with spaceId === null fall through to the existing bucket logic.
  const spaceGroups = useMemo(() => {
    if (spaces.length === 0) return [];
    const byId = new Map<string, ConvExt[]>();
    for (const c of filtered) {
      if (!c.archived && c.spaceId) {
        const arr = byId.get(c.spaceId) ?? [];
        arr.push(c);
        byId.set(c.spaceId, arr);
      }
    }
    return spaces
      .map((s) => ({ space: s, rows: byId.get(s.id) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [spaces, filtered]);

  const rootBuckets = useMemo(() => {
    // Filter out conversations that are already shown in a spaceGroup.
    const filteredRoot = filtered.filter((c) => !c.spaceId);
    return bucketize(filteredRoot, activeFolder);
  }, [filtered, activeFolder]);

  async function newChat() {
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (data?.conversation?.id) {
        setConversations((prev) => [data.conversation, ...prev]);
        router.push(`/chat/${data.conversation.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  function handleContextMenu(e: React.MouseEvent, conv: ConvExt) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, conv });
  }

  const patchConv = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const d = await res.json();
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, ...d.conversation } : c));
    }
  }, []);

  async function deleteConv(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) router.push("/chat");
  }

  async function shareConv(id: string) {
    const res = await fetch(`/api/conversations/${id}/share`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      const url = `${window.location.origin}/share/${d.slug}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareToast(url);
      setTimeout(() => setShareToast(null), 4000);
    }
  }

  return (
    <>
      {contextMenu && (
        <ConvContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          conversationId={contextMenu.conv.id}
          pinned={contextMenu.conv.pinned}
          archived={contextMenu.conv.archived ?? false}
          folderId={contextMenu.conv.folderId ?? null}
          folders={folders}
          onClose={() => setContextMenu(null)}
          onPinToggle={() => patchConv(contextMenu.conv.id, { pinned: !contextMenu.conv.pinned })}
          onArchiveToggle={() => patchConv(contextMenu.conv.id, { archived: !contextMenu.conv.archived })}
          onMoveToFolder={(fid) => patchConv(contextMenu.conv.id, { folderId: fid })}
          onDelete={() => deleteConv(contextMenu.conv.id)}
          onShare={() => shareConv(contextMenu.conv.id)}
          onRename={() => {
            const next = window.prompt("rename conversation", contextMenu.conv.title);
            const trimmed = next?.trim();
            if (trimmed && trimmed !== contextMenu.conv.title) {
              patchConv(contextMenu.conv.id, { title: trimmed });
            }
          }}
        />
      )}

      {shareToast && (
        <div className="share-toast">
          link copied: <span className="share-toast-url">{shareToast}</span>
        </div>
      )}

      <aside className="sidebar">
        <div className="side-head">
          <span className="side-title"><b>conversations</b></span>
          <span className="side-title">{conversations.length}</span>
        </div>

        <FolderManager
          activeFolder={activeFolder}
          onSelect={setActiveFolder}
        />

        <button className="new-chat" onClick={newChat} disabled={creating} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 5h10M4 9h6" />
            <path d="M3 3h12v10H8l-4 4v-4H3z" />
            <path d="M17 3v6M14 6h6" />
          </svg>
          {creating ? "creating…" : "new chat"}
          <span className="kbd">⌘N</span>
        </button>

        <div
          className="side-search"
          onClick={() => {
            // The Cmd+K palette is mounted globally now; synthesize the
            // shortcut so the global listener opens it.
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true })
            );
          }}
          style={{ cursor: "pointer" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="10" cy="10" r="6" />
            <path d="M14.5 14.5l5 5" />
          </svg>
          <input
            value={filter}
            onChange={(e) => { e.stopPropagation(); setFilter(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            placeholder="filter conversations"
          />
          <span className="kbd">⌘K</span>
        </div>

        <div className="conv-list">
          {buckets.length === 0 && spaceGroups.length === 0 && (
            <div style={{ padding: "32px 16px", color: "var(--fg-3)", fontSize: 13, textAlign: "center" }}>
              {filter ? "no matches" : "no conversations yet"}
            </div>
          )}

          {/* [spaces] in-space subheads */}
          {spaceGroups.map(({ space, rows }) => (
            <div key={`spc-${space.id}`}>
              <Link href={`/spaces/${space.id}`} className="spc-side-group" prefetch={false}>
                <span className="emoji" aria-hidden>{space.emoji || "◇"}</span>
                <span className="name"><i>{space.name}</i></span>
                <span className="count">{rows.length}</span>
              </Link>
              {rows.map((c) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  prefetch
                  className={`conv ${activeId === c.id ? "active" : ""}${c.pinned ? " conv--pinned" : ""}`}
                  onContextMenu={(e) => handleContextMenu(e, c)}
                >
                  <span className="title">{c.title || "untitled"}</span>
                  <span className="meta">
                    <span className="model">{shortModel(c.modelId)}</span>
                    <span>·</span>
                    <span suppressHydrationWarning>{relTime(c.updatedAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ))}

          {rootBuckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="conv-section">
                <span>{bucket.label}</span>
                <span>{bucket.rows.length}</span>
              </div>
              {bucket.rows.map((c) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  prefetch
                  className={`conv ${activeId === c.id ? "active" : ""}${c.pinned ? " conv--pinned" : ""}`}
                  onContextMenu={(e) => handleContextMenu(e, c)}
                >
                  <span className="title">{c.title || "untitled"}</span>
                  <span className="meta">
                    <span className="model">{shortModel(c.modelId)}</span>
                    <span>·</span>
                    <span suppressHydrationWarning>{relTime(c.updatedAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-foot">
          <AvatarMonogram letters={profile.avatarMonogram} accent={profile.avatarAccent} size={28} />
          <div className="who">
            <span className="name">{profile.displayName}</span>
            <span className="username">{profile.username}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
