"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { MessageBubble, type AnyPart, type ArtifactRef } from "./MessageBubble";
import { ChatComposer, type PendingAttachment, type ReasoningEffort } from "./ChatComposer";
import { SelectionChips } from "./SelectionChips";
import { SystemPromptEditor } from "./SystemPromptEditor";
import { SwarmInlineView } from "@/components/swarm/SwarmInlineView";
import { ArtifactsPane, type ArtifactData } from "./ArtifactsPane";
import { useSwarmStream } from "@/hooks/use-swarm-stream";
import { getModel } from "@/lib/providers/registry";
import type { ChatMessage } from "@/types/chat";

const REASONING_EFFORT_KEY = "openmlc:reasoning-effort";

function isReasoningEffort(v: unknown): v is ReasoningEffort {
  return v === "off" || v === "low" || v === "medium" || v === "high";
}

function loadReasoningEffort(): ReasoningEffort {
  if (typeof window === "undefined") return "off";
  try {
    const raw = localStorage.getItem(REASONING_EFFORT_KEY);
    if (raw && isReasoningEffort(raw)) return raw;
  } catch {}
  return "off";
}

type Props = {
  conversationId: string;
  initialModelId: string;
  initialTitle: string;
  initialSystemPrompt?: string;
  initialPersonaId?: string | null;
  initialMessages: ChatMessage[];
  /* edit-feature: pre-loaded superseded messages for the "show" toggle */
  supersededMessages?: ChatMessage[];
  /* reroll-feature: JSON-encoded selected variants map */
  initialSelectedVariants?: string;
  profile: { avatarMonogram: string; displayName: string };
  /* search-flash: deep-link target from /search?msg=… */
  flashMessageId?: string | null;
};

function dbToUiMessages(rows: ChatMessage[]): UIMessage[] {
  return rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
    }));
}

export function ChatThread({ conversationId, initialModelId, initialTitle, initialSystemPrompt = "", initialPersonaId = null, initialMessages, supersededMessages = [], initialSelectedVariants = "{}", profile, flashMessageId = null }: Props) {
  const router = useRouter();
  const [modelId, setModelId] = useState(initialModelId);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [personaId, setPersonaId] = useState<string | null>(initialPersonaId);
  const [input, setInput] = useState("");
  // Selection chips → composer routing. SelectionChips dispatches a window
  // CustomEvent("composer:insert") with { kind: "quote" | "ask", text }.
  // We append to the current input (rather than replace) so users can stack
  // quotes or quote-then-write-question.
  useEffect(() => {
    function onInsert(e: Event) {
      const detail = (e as CustomEvent<{ kind: "quote" | "ask"; text: string }>).detail;
      if (!detail) return;
      const { kind, text } = detail;
      const quoted = text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      const block =
        kind === "quote"
          ? `${quoted}\n\n`
          : `${quoted}\n\n`; // both prepend the quote; "ask" leaves cursor after for the question
      setInput((prev) => (prev ? `${block}${prev}` : block));
      // Focus the textarea on next tick
      requestAnimationFrame(() => {
        const ta = document.querySelector<HTMLTextAreaElement>("textarea[name='msg-input'], .composer-area textarea");
        ta?.focus();
        // Move caret to end so the user can start typing the follow-up
        if (ta) ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    }
    window.addEventListener("composer:insert", onInsert);
    return () => window.removeEventListener("composer:insert", onInsert);
  }, []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("off");
  const [swarmMode, setSwarmMode] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [browserMode, setBrowserMode] = useState(false);
  const [browserAvailable, setBrowserAvailable] = useState(false);
  const [computerMode, setComputerMode] = useState(false);
  const [computerAvailable, setComputerAvailable] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([]);
  const [openArtifact, setOpenArtifact] = useState<ArtifactRef | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const swarm = useSwarmStream();
  /* edit-feature: track historical superseded turns + reveal toggle */
  const [supersededHistory, setSupersededHistory] = useState<ChatMessage[]>(supersededMessages);
  const [showSuperseded, setShowSuperseded] = useState(false);

  const fetchArtifacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/artifacts`);
      if (!res.ok) return;
      const data = (await res.json()) as { artifacts: ArtifactData[] };
      setArtifacts(data.artifacts);
    } catch {}
  }, [conversationId]);

  useEffect(() => { void fetchArtifacts(); }, [fetchArtifacts]);

  const artifactsByMessage = useMemo(() => {
    const map = new Map<string, ArtifactRef[]>();
    for (const a of artifacts) {
      const arr = map.get(a.messageId) ?? [];
      arr.push({
        id: a.id,
        title: a.title,
        type: a.type,
        language: a.language ?? null,
        content: a.content,
      });
      map.set(a.messageId, arr);
    }
    return map;
  }, [artifacts]);

  /* reroll-feature: state for variant pager + selected map.
   * `assistantVariants` is keyed by parentUserMessageId.
   * `selectedVariants` mirrors Conversation.selectedVariants. */
  const [assistantVariants, setAssistantVariants] = useState<
    Record<string, ChatMessage[]>
  >(() => {
    const map: Record<string, ChatMessage[]> = {};
    for (const m of initialMessages) {
      if (m.role === "assistant" && m.parentUserMessageId) {
        const arr = map[m.parentUserMessageId] ?? [];
        arr.push(m);
        map[m.parentUserMessageId] = arr;
      }
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0));
    }
    return map;
  });
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>(() => {
    try {
      const parsed = JSON.parse(initialSelectedVariants);
      if (parsed && typeof parsed === "object") return parsed as Record<string, number>;
    } catch {}
    return {};
  });

  /* reroll-feature: which assistant message id is "visible" for each parent.
   * Falls back to the latest variant when nothing is selected. */
  const visibleVariantIdByParent = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [parentId, arr] of Object.entries(assistantVariants)) {
      if (!arr.length) continue;
      const desired = selectedVariants[parentId];
      const pick =
        arr.find((v) => (v.variantIndex ?? 0) === desired) ??
        arr[arr.length - 1];
      out[parentId] = pick.id;
    }
    return out;
  }, [assistantVariants, selectedVariants]);

  const openArtifactData: ArtifactData | null = useMemo(() => {
    if (!openArtifact) return null;
    return {
      id: openArtifact.id,
      title: openArtifact.title,
      type: openArtifact.type,
      language: openArtifact.language ?? undefined,
      content: openArtifact.content,
      version: 1,
      createdAt: new Date().toISOString(),
      messageId: "",
      conversationId,
    };
  }, [openArtifact, conversationId]);

  const modelIdRef = useRef(modelId);
  useEffect(() => { modelIdRef.current = modelId; }, [modelId]);

  const reasoningEffortRef = useRef<ReasoningEffort>("off");
  useEffect(() => { reasoningEffortRef.current = reasoningEffort; }, [reasoningEffort]);

  const researchModeRef = useRef(false);
  useEffect(() => { researchModeRef.current = researchMode; }, [researchMode]);

  const browserModeRef = useRef(false);
  useEffect(() => { browserModeRef.current = browserMode; }, [browserMode]);

  const computerModeRef = useRef(false);
  useEffect(() => { computerModeRef.current = computerMode; }, [computerMode]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/browser/status")
      .then((r) => r.ok ? r.json() : { available: false })
      .then((d: { available?: boolean }) => {
        if (!cancelled) setBrowserAvailable(!!d.available);
      })
      .catch(() => {});
    fetch("/api/computer/status")
      .then((r) => r.ok ? r.json() : { available: false })
      .then((d: { available?: boolean }) => {
        if (!cancelled) setComputerAvailable(!!d.available);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setReasoningEffort(loadReasoningEffort());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(REASONING_EFFORT_KEY, reasoningEffort); } catch {}
  }, [reasoningEffort]);

  const pendingAttachmentsRef = useRef<string[]>([]);

  const [perMsgModel, setPerMsgModel] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const m of initialMessages) {
      if (m.role === "assistant" && m.modelId) out[m.id] = m.modelId;
    }
    return out;
  });
  const pendingModelRef = useRef<string | null>(null);

  const transportRef = useRef<DefaultChatTransport<UIMessage> | null>(null);
  if (!transportRef.current) {
    transportRef.current = new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          modelId: modelIdRef.current,
          conversationId,
          attachmentIds: pendingAttachmentsRef.current,
          reasoningEffort: reasoningEffortRef.current,
          researchMode: researchModeRef.current,
          browserMode: browserModeRef.current,
          computerMode: computerModeRef.current,
        },
      }),
    });
  }

  const { messages, sendMessage, stop, status, setMessages, regenerate } = useChat({
    id: conversationId,
    messages: dbToUiMessages(initialMessages),
    transport: transportRef.current,
    onError: (err) => setErrorMsg(err?.message ?? "something went wrong"),
    onFinish: ({ message }) => {
      if (message?.id && pendingModelRef.current) {
        const used = pendingModelRef.current;
        setPerMsgModel((prev) => ({ ...prev, [message.id]: used }));
        pendingModelRef.current = null;
      }
      pendingAttachmentsRef.current = [];
      setErrorMsg(null);
      router.refresh();
      void fetchArtifacts();
    },
  });

  useEffect(() => {
    setMessages(dbToUiMessages(initialMessages));
    setModelId(initialModelId);
    setInput("");
    setErrorMsg(null);
    setPendingAttachments([]);
    const seed: Record<string, string> = {};
    for (const m of initialMessages) {
      if (m.role === "assistant" && m.modelId) seed[m.id] = m.modelId;
    }
    setPerMsgModel(seed);
    pendingModelRef.current = null;
    pendingAttachmentsRef.current = [];
    setReasoningEffort("off");
    /* edit-feature: reset reveal-toggle when navigating between threads */
    setSupersededHistory(supersededMessages);
    setShowSuperseded(false);
    /* reroll-feature: rebuild variants map + selected map on convo switch */
    {
      const vmap: Record<string, ChatMessage[]> = {};
      for (const m of initialMessages) {
        if (m.role === "assistant" && m.parentUserMessageId) {
          const arr = vmap[m.parentUserMessageId] ?? [];
          arr.push(m);
          vmap[m.parentUserMessageId] = arr;
        }
      }
      for (const k of Object.keys(vmap)) {
        vmap[k].sort((a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0));
      }
      setAssistantVariants(vmap);
      try {
        const parsed = JSON.parse(initialSelectedVariants);
        setSelectedVariants(
          parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {},
        );
      } catch {
        setSelectedVariants({});
      }
    }

  }, [conversationId]);

  useEffect(() => {
    if (modelId === initialModelId) return;
    fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelId }),
    }).catch(() => {});

  }, [modelId]);

  // Smooth auto-scroll: rAF-throttled, eased toward bottom, only when user is
  // already near the bottom (don't fight them if they scrolled up to read).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const stickThreshold = 200; // px from bottom — beyond this, leave them alone
    if (distance > stickThreshold) return;

    if (reduce) {
      el.scrollTop = el.scrollHeight;
      return;
    }

    let cancelled = false;
    const tick = () => {
      if (cancelled || !el) return;
      const target = el.scrollHeight - el.clientHeight;
      const cur = el.scrollTop;
      const delta = target - cur;
      if (Math.abs(delta) < 1) return;
      // Eased: cover ~22% of remaining distance per frame → smooth glide.
      el.scrollTop = cur + delta * 0.22;
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [messages, status, swarm.status]);

  // search-flash: deep-link from /search?msg=… → scroll + pulse the target row
  useEffect(() => {
    if (!flashMessageId) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const idx = initialMessages.findIndex((m) => m.id === flashMessageId);
    if (idx < 0) return;
    // The .msg-wrap nodes inside the scroller are 1:1 with rendered messages.
    const wraps = scroller.querySelectorAll<HTMLElement>(".msg-wrap");
    const target = wraps[idx];
    if (!target) return;
    target.setAttribute("data-flash", "true");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(() => {
      target.removeAttribute("data-flash");
    }, 1500);
    return () => window.clearTimeout(t);
    // Intentionally fire once per conversation+flashId combo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashMessageId, conversationId]);

  const swarmInjectedRef = useRef(false);
  useEffect(() => {
    if (swarm.status !== "complete") {
      swarmInjectedRef.current = false;
      return;
    }
    if (swarmInjectedRef.current) return;
    swarmInjectedRef.current = true;
    const synthesis = swarm.synthesis;
    const runId = swarm.runId;
    if (synthesis) {
      setMessages((prev) => [
        ...prev,
        {
          id: `swarm-${runId ?? Date.now()}`,
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: synthesis }],
        },
      ]);
    }

  }, [swarm.status]);

  async function handleFileSelect(files: FileList) {
    const fileArr = Array.from(files);
    const placeholders: PendingAttachment[] = fileArr.map((f) => ({
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      filename: f.name,
      mimeType: f.type || "application/octet-stream",
      uploading: true,
    }));
    setPendingAttachments((prev) => [...prev, ...placeholders]);

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      const placeholder = placeholders[i];
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/attachments", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as { id: string; filename: string; mimeType: string };
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.id === placeholder.id
              ? { id: data.id, filename: data.filename, mimeType: data.mimeType, uploading: false }
              : a
          )
        );
      } catch {
        setPendingAttachments((prev) => prev.filter((a) => a.id !== placeholder.id));
      }
    }
  }

  function handleRemoveAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));

    fetch(`/api/attachments/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleBranch(messageId: string) {
    try {
      // The AI SDK assigns its own client-side ids to freshly streamed
      // messages. Those ids don't exist in the DB until the page reloads,
      // so branching off a just-completed reply would 404 with
      // "message not found." Remap to the canonical server id by ordinal.
      let serverId = messageId;
      const localIdx = messages.findIndex((m) => m.id === messageId);
      try {
        const probe = await fetch(`/api/conversations/${conversationId}`);
        if (probe.ok) {
          const data = (await probe.json()) as {
            messages?: Array<{ id: string; role: string }>;
          };
          const serverMsgs = data.messages ?? [];
          if (localIdx >= 0 && serverMsgs[localIdx]?.id) {
            serverId = serverMsgs[localIdx].id;
          } else {
            const lastAssistant = [...serverMsgs].reverse().find((m) => m.role === "assistant");
            if (lastAssistant) serverId = lastAssistant.id;
          }
        }
      } catch {}

      const res = await fetch(`/api/conversations/${conversationId}/branch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: serverId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { conversationId: string };
      router.push(`/chat/${data.conversationId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "branch failed");
    }
  }

  /* reroll-feature: POST /api/messages/[id]/reroll, append the streaming
   * variant into the thread, optimistically select it. */
  async function handleReroll(messageId: string) {
    try {
      // Same id-remap dance as handleBranch — the AI SDK assigns
      // ephemeral ids to fresh stream messages; we need the server id.
      let serverId = messageId;
      const localIdx = messages.findIndex((m) => m.id === messageId);
      try {
        const probe = await fetch(`/api/conversations/${conversationId}`);
        if (probe.ok) {
          const data = (await probe.json()) as {
            conversation?: { messages?: Array<{ id: string; role: string }> };
            messages?: Array<{ id: string; role: string }>;
          };
          const serverMsgs = data.conversation?.messages ?? data.messages ?? [];
          if (localIdx >= 0 && serverMsgs[localIdx]?.id) {
            serverId = serverMsgs[localIdx].id;
          } else {
            const lastAssistant = [...serverMsgs].reverse().find((m) => m.role === "assistant");
            if (lastAssistant) serverId = lastAssistant.id;
          }
        }
      } catch {}

      const res = await fetch(`/api/messages/${encodeURIComponent(serverId)}/reroll`, {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        let msg = "reroll failed";
        try {
          const data = (await res.json()) as { error?: string; message?: string };
          msg = data?.message ?? data?.error ?? msg;
        } catch {}
        throw new Error(msg);
      }

      // Drain the UI-message stream into a synthetic assistant bubble.
      const newId = `reroll-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: newId,
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "" }],
        },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const m = line.match(/^0:(.*)$/);
          if (m) {
            try {
              const parsed = JSON.parse(m[1]);
              if (typeof parsed === "string") acc += parsed;
            } catch {
              acc += m[1];
            }
          }
        }
        const snapshot = acc;
        setMessages((prev) =>
          prev.map((mm) =>
            mm.id === newId
              ? { ...mm, parts: [{ type: "text" as const, text: snapshot }] }
              : mm,
          ),
        );
      }

      // After stream completes, refresh from server so the persisted
      // variant + updated selectedVariants take over from our synthetic.
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "reroll failed");
    }
  }

  /* reroll-feature: switch the visible variant for a parent user message */
  async function handleSelectVariant(parentUserMessageId: string, variantIndex: number) {
    setSelectedVariants((prev) => ({ ...prev, [parentUserMessageId]: variantIndex }));
    try {
      await fetch(`/api/conversations/${conversationId}/select-variant`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userMessageId: parentUserMessageId, variantIndex }),
      });
    } catch {
      /* swallow — UI is optimistic */
    }
  }

  /* edit-feature: edit a user message, truncate the thread, re-stream */
  async function handleEdit(messageId: string, newContent: string) {
    const trimmed = newContent.trim();
    if (!trimmed) throw new Error("empty content");

    if (status === "streaming" || status === "submitted") {
      try { stop(); } catch {}
    }

    const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}/edit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });
    if (!res.ok) {
      let msg = "edit failed";
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) msg = data.error;
      } catch {}
      throw new Error(msg);
    }
    const data = (await res.json()) as { conversationId: string; truncatedMessageIds: string[] };
    const truncated = new Set(data.truncatedMessageIds);

    // Snapshot of newly-superseded messages so the user can still reveal them
    // without an extra round-trip.
    const nowSuperseded: ChatMessage[] = [];
    for (const m of initialMessages) {
      if (truncated.has(m.id)) {
        nowSuperseded.push({ ...m, supersededAt: new Date().toISOString() });
      }
    }
    if (nowSuperseded.length > 0) {
      setSupersededHistory((prev) => [...prev, ...nowSuperseded]);
    }

    // Trim local UI state: keep messages up to and including the edited one,
    // updating its text in place. Drop everything after.
    let editedFound = false;
    setMessages((prev) => {
      const next: typeof prev = [];
      for (const m of prev) {
        if (m.id === messageId) {
          editedFound = true;
          next.push({
            ...m,
            parts: [{ type: "text" as const, text: trimmed }],
          });
          break;
        }
        next.push(m);
      }
      return editedFound ? next : prev;
    });

    pendingAttachmentsRef.current = [];
    pendingModelRef.current = modelIdRef.current;

    // Trigger a fresh assistant turn off the truncated history.
    try {
      await regenerate();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "regenerate failed");
    }
  }

  function handleSubmit() {
    const text = input.trim();
    const readyAttachments = pendingAttachments.filter((a) => !a.uploading);
    if (!text && readyAttachments.length === 0) return;

    if (swarmMode && text) {
      if (swarm.status !== "idle") return;
      setInput("");
      setPendingAttachments([]);
      setErrorMsg(null);

      setMessages((prev) => [
        ...prev,
        {
          id: `user-swarm-${Date.now()}`,
          role: "user" as const,
          parts: [{ type: "text" as const, text }],
        },
      ]);
      swarm.start({ prompt: text, conversationId }).catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "swarm failed");
      });
      return;
    }

    if (status === "submitted" || status === "streaming") return;

    pendingAttachmentsRef.current = readyAttachments.map((a) => a.id);
    pendingModelRef.current = modelIdRef.current;

    const displayText = text || readyAttachments.map((a) => a.filename).join(", ");

    setInput("");
    setPendingAttachments([]);
    setErrorMsg(null);
    sendMessage({ text: displayText });
  }

  const isStreaming = status === "streaming";
  const lastIsAssistant = messages.at(-1)?.role === "assistant";
  const currentModel = getModel(modelId);
  const ctxK = currentModel?.contextWindow
    ? currentModel.contextWindow >= 1_000_000
      ? `${Math.round(currentModel.contextWindow / 1_000_000)}m`
      : `${Math.round(currentModel.contextWindow / 1000)}k`
    : null;

  return (
    <main className="main">
        <SelectionChips />
        <div className="main-head">
          <div className="thread-title">
            <span className="title-text">{initialTitle || "untitled"}</span>
          </div>
          <div className="thread-meta">
            <SystemPromptEditor
              conversationId={conversationId}
              initialPrompt={systemPrompt}
              onSaved={setSystemPrompt}
            />
            <span className="chip cyan">{currentModel?.name?.toLowerCase() ?? modelId}</span>
            {ctxK && <span className="chip">{ctxK} ctx</span>}
            <span className="chip">{status}</span>
          </div>
        </div>

        <div className="messages" ref={scrollerRef}>
          {messages.length === 0 && (
            <div className="empty-state">
              <h1>say something</h1>
              <p>your keys, your models, your machine.</p>
            </div>
          )}

          {/* reroll-feature: hide assistant variants that aren't the
              currently-selected one for their parent user message. The
              `dbMessage` lookup tells us which assistant rows have a
              parent in DB; everything else (legacy + freshly streamed)
              passes through untouched. */}
          {messages
            .filter((m) => {
              if (m.role !== "assistant") return true;
              const db = initialMessages.find((im) => im.id === m.id);
              const parentId = db?.parentUserMessageId;
              if (!parentId) return true;
              const visibleId = visibleVariantIdByParent[parentId];
              if (!visibleId) return true;
              return m.id === visibleId;
            })
            .map((m, i, visibleArr) => {
            const isLast = i === visibleArr.length - 1;
            const text = m.parts
              ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
              ?.map((p) => p.text)
              ?.join("") ?? "";

            const liveReasoning = m.parts
              ?.filter((p): p is Extract<typeof p, { type: "reasoning" }> =>
                (p as { type: string }).type === "reasoning"
              )
              ?.map((p) => (p as { text?: string }).text ?? "")
              ?.join("") ?? "";
            let messageModelId: string | undefined;
            if (m.role === "assistant") {
              messageModelId =
                perMsgModel[m.id]
                ?? (isLast && isStreaming && lastIsAssistant ? pendingModelRef.current ?? undefined : undefined)
                ?? modelId;
            }

            const dbMessage = initialMessages.find((im) => im.id === m.id);
            const reasoning = liveReasoning || dbMessage?.reasoning || null;
            /* reroll-feature: build pager state if this assistant has siblings */
            let variantsProp:
              | { count: number; current: number; onPrev: () => void; onNext: () => void }
              | undefined;
            if (m.role === "assistant" && dbMessage?.parentUserMessageId) {
              const parentId = dbMessage.parentUserMessageId;
              const siblings = assistantVariants[parentId] ?? [];
              if (siblings.length > 1) {
                const idx = siblings.findIndex((s) => s.id === m.id);
                const current1 = idx >= 0 ? idx + 1 : 1;
                variantsProp = {
                  count: siblings.length,
                  current: current1,
                  onPrev: () => {
                    const prev = siblings[Math.max(0, idx - 1)];
                    if (prev) void handleSelectVariant(parentId, prev.variantIndex ?? 0);
                  },
                  onNext: () => {
                    const next = siblings[Math.min(siblings.length - 1, idx + 1)];
                    if (next) void handleSelectVariant(parentId, next.variantIndex ?? 0);
                  },
                };
              }
            }
            return (
              <MessageBubble
                key={m.id}
                role={m.role as "user" | "assistant"}
                parts={m.parts as AnyPart[] | undefined}
                text={text}
                modelId={messageModelId}
                streaming={isStreaming && isLast && lastIsAssistant && m.role === "assistant"}
                profileMonogram={profile.avatarMonogram}
                profileDisplayName={profile.displayName}
                attachments={dbMessage?.attachments}
                reasoning={reasoning}
                messageId={m.id}
                onBranch={handleBranch}
                artifacts={artifactsByMessage.get(m.id) ?? []}
                onOpenArtifact={setOpenArtifact}
                /* edit-feature */
                onEdit={m.role === "user" ? handleEdit : undefined}
                /* reroll-feature */
                onReroll={m.role === "assistant" ? handleReroll : undefined}
                variants={variantsProp}
              />
            );
          })}

          {/* edit-feature: superseded turns toggle + faded historical bubbles */}
          {supersededHistory.length > 0 && (
            <div className="msg-wrap">
              <button
                type="button"
                className="msg-superseded-toggle"
                onClick={() => setShowSuperseded((v) => !v)}
                aria-expanded={showSuperseded}
              >
                {showSuperseded ? "hide" : "show"} superseded turns ({supersededHistory.length})
              </button>
            </div>
          )}
          {showSuperseded && supersededHistory.map((m) => (
            <MessageBubble
              key={`sup-${m.id}`}
              role={m.role as "user" | "assistant"}
              text={m.content}
              modelId={m.role === "assistant" ? m.modelId ?? undefined : undefined}
              streaming={false}
              profileMonogram={profile.avatarMonogram}
              profileDisplayName={profile.displayName}
              attachments={m.attachments}
              reasoning={m.reasoning ?? null}
              messageId={m.id}
              superseded
            />
          ))}

          {swarm.status !== "idle" && (
            <div className="msg-wrap">
              <div className="msg">
                <div
                  className="avatar ai"
                  style={{
                    background: "linear-gradient(135deg, var(--green-500), var(--green-300))",
                    fontSize: 9,
                    letterSpacing: "0.04em",
                  }}
                >
                  S·W
                </div>
                <div className="body" style={{ flex: 1, minWidth: 0 }}>
                  <div className="body-head">
                    <span className="name">swarm</span>
                  </div>
                  <SwarmInlineView
                    status={swarm.status}
                    plan={swarm.plan}
                    agents={swarm.agents}
                    synthesis={swarm.synthesis}
                    error={swarm.error}
                    onDismiss={swarm.reset}
                  />
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="msg-wrap">
              <div
                style={{
                  border: "1px solid color-mix(in oklch, var(--signal-err) 40%, transparent)",
                  background: "color-mix(in oklch, var(--signal-err) 8%, transparent)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  color: "var(--signal-err)",
                  fontSize: 13,
                }}
              >
                · {errorMsg}
              </div>
            </div>
          )}
        </div>

        <ChatComposer
          modelId={modelId}
          onModelChange={setModelId}
          status={status}
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          pendingAttachments={pendingAttachments}
          onFileSelect={handleFileSelect}
          onRemoveAttachment={handleRemoveAttachment}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={setReasoningEffort}
          swarmMode={swarmMode}
          onSwarmToggle={setSwarmMode}
          researchMode={researchMode}
          onResearchToggle={setResearchMode}
          browserMode={browserMode}
          onBrowserToggle={setBrowserMode}
          browserAvailable={browserAvailable}
          computerMode={computerMode}
          onComputerToggle={setComputerMode}
          computerAvailable={computerAvailable}
          conversationId={conversationId}
          personaId={personaId}
          onPersonaChange={setPersonaId}
        />
      <ArtifactsPane
        artifact={openArtifactData}
        onClose={() => setOpenArtifact(null)}
        versions={openArtifact ? artifacts.filter((a) => a.title === openArtifact.title && a.id !== openArtifact.id) : []}
      />
    </main>
  );
}
