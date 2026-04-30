"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

type Persona = { id: string; name: string; emoji: string | null };
type ModelOption = { id: string; name: string; providerId: string };

type Space = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  systemPrompt: string | null;
  defaultPersonaId: string | null;
  defaultModel: string | null;
  archived: boolean;
};

type Props = {
  space: Space;
  personas: Persona[];
};

export function SpaceSettingsForm({ space, personas }: Props) {
  const router = useRouter();
  const [name, setName] = useState(space.name);
  const [emoji, setEmoji] = useState(space.emoji ?? "");
  const [description, setDescription] = useState(space.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(space.systemPrompt ?? "");
  const [defaultPersonaId, setDefaultPersonaId] = useState(space.defaultPersonaId ?? "");
  const [defaultModel, setDefaultModel] = useState(space.defaultModel ?? "");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.models)) {
          setModels(
            d.models.map((m: { id: string; name: string; providerId: string }) => ({
              id: m.id,
              name: m.name,
              providerId: m.providerId,
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        emoji: emoji.trim() || null,
        description: description.trim() || null,
        systemPrompt: systemPrompt.trim() || null,
        defaultPersonaId: defaultPersonaId || null,
        defaultModel: defaultModel || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "save failed");
      return;
    }
    setSavedAt(Date.now());
    startTransition(() => router.refresh());
  }

  async function archive() {
    const res = await fetch(`/api/spaces/${space.id}/archive`, { method: "POST" });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  async function destroy() {
    const sure = window.confirm(
      `Delete space "${space.name}"? Conversations, files, and memories that belong to it will become un-scoped (root). This cannot be undone.`,
    );
    if (!sure) return;
    const res = await fetch(`/api/spaces/${space.id}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => {
        router.refresh();
        router.push("/spaces");
      });
    }
  }

  return (
    <form className="spc-settings" onSubmit={save}>
      <div className="spc-fieldset">
        <span className="spc-fieldset-title">Identity</span>
        <span className="spc-fieldset-help">FIG.02.A — display name and glyph</span>
        <div className="spc-form-row">
          <input
            aria-label="Emoji"
            className="spc-input spc-input--emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            placeholder="◇"
          />
          <input
            aria-label="Name"
            className="spc-input spc-input--name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />
        </div>
        <input
          aria-label="Description"
          className="spc-input"
          placeholder="optional one-line description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={280}
        />
      </div>

      <div className="spc-fieldset">
        <span className="spc-fieldset-title">System prompt</span>
        <span className="spc-fieldset-help">
          FIG.02.B — Prepended to every chat in this space, ahead of the conversation prompt.
        </span>
        <textarea
          aria-label="System prompt"
          className="spc-textarea"
          rows={6}
          placeholder="e.g. you are an editor reviewing chapters of a thesis on rust ownership semantics. respond in clipped academic prose."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          maxLength={8000}
        />
      </div>

      <div className="spc-fieldset">
        <span className="spc-fieldset-title">Defaults</span>
        <span className="spc-fieldset-help">FIG.02.C — applied to new chats opened from this space</span>
        <label className="spc-form-label">
          <span>Default persona</span>
          <select
            className="spc-select"
            value={defaultPersonaId}
            onChange={(e) => setDefaultPersonaId(e.target.value)}
          >
            <option value="">— none —</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji ? `${p.emoji} ` : ""}{p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="spc-form-label">
          <span>Default model</span>
          <select
            className="spc-select"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
          >
            <option value="">— inherit from profile —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.providerId}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="spc-form-error">{error}</div>}

      <div className="spc-settings-foot">
        <div className="spc-settings-foot-left">
          <button type="button" className="spc-btn" onClick={archive}>
            {space.archived ? "unarchive" : "archive"}
          </button>
          <button type="button" className="spc-btn spc-btn--danger" onClick={destroy}>
            delete space
          </button>
        </div>
        <div className="spc-settings-foot-left" style={{ alignItems: "center" }}>
          {savedAt && (
            <span className="spc-settings-saved">
              saved
            </span>
          )}
          <button type="submit" className="spc-btn spc-btn--primary" disabled={pending}>
            {pending ? "saving…" : "save"}
          </button>
        </div>
      </div>
    </form>
  );
}
