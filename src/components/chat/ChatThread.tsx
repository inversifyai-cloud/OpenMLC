"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { MessageBubble, type AnyPart, type ArtifactRef } from "./MessageBubble";
import { ChatComposer, type PendingAttachment, type ReasoningEffort } from "./ChatComposer";
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
  profile: { avatarMonogram: string; displayName: string };
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

export function ChatThread({ conversationId, initialModelId, initialTitle, initialSystemPrompt = "", initialPersonaId = null, initialMessages, profile }: Props) {
  const router = useRouter();
  const [modelId, setModelId] = useState(initialModelId);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [personaId, setPersonaId] = useState<string | null>(initialPersonaId);
  const [input, setInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("off");
  const [swarmMode, setSwarmMode] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [browserMode, setBrowserMode] = useState(false);
  const [browserAvailable, setBrowserAvailable] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([]);
  const [openArtifact, setOpenArtifact] = useState<ArtifactRef | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const swarm = useSwarmStream();

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/browser/status")
      .then((r) => r.ok ? r.json() : { available: false })
      .then((d: { available?: boolean }) => {
        if (!cancelled) setBrowserAvailable(!!d.available);
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
        },
      }),
    });
  }

  const { messages, sendMessage, stop, status, setMessages } = useChat({
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

  }, [conversationId]);

  useEffect(() => {
    if (modelId === initialModelId) return;
    fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelId }),
    }).catch(() => {});

  }, [modelId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status, swarm.status]);

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

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
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
              />
            );
          })}

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
