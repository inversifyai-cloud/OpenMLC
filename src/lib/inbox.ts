// Inbox — async activity feed helpers.
// recordInboxEntry() is fire-and-forget: it must NEVER throw, even if the DB
// write fails. Callers wrap completion paths (research done, swarm done,
// workflow run finished, browser session closed). Schema: see InboxEntry in
// prisma/schema.prisma.

import { db } from "@/lib/db";

export type InboxKind =
  | "workflow_run"
  | "swarm_run"
  | "research_done"
  | "browser_done"
  | "schedule_fired";

export type InboxRefType =
  | "conversation"
  | "swarm_run"
  | "research_session"
  | "browser_session"
  | "workflow_run";

export type InboxEntryInput = {
  profileId: string;
  kind: InboxKind;
  title: string;
  summary?: string | null;
  refType: InboxRefType;
  refId: string;
};

function clampTitle(s: string, max = 160): string {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return "(untitled)";
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

function clampSummary(s: string | null | undefined, max = 280): string | null {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

export async function recordInboxEntry(input: InboxEntryInput): Promise<void> {
  try {
    await db.inboxEntry.create({
      data: {
        profileId: input.profileId,
        kind: input.kind,
        title: clampTitle(input.title),
        summary: clampSummary(input.summary ?? null),
        refType: input.refType,
        refId: input.refId,
      },
    });
  } catch (err) {
    // Surfaced to console only; never escalate.
    console.error("[inbox] recordInboxEntry failed", err);
  }
}

export async function getUnreadCount(profileId: string): Promise<number> {
  try {
    return await db.inboxEntry.count({
      where: { profileId, read: false },
    });
  } catch (err) {
    console.error("[inbox] getUnreadCount failed", err);
    return 0;
  }
}
