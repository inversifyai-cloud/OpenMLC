"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the freshly-created space id, before navigation. */
  onCreated?: (id: string) => void;
};

export function NewSpaceForm({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        emoji: emoji.trim() || null,
        description: description.trim() || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Could not create space.");
      return;
    }
    const data = await res.json();
    if (data?.space?.id) {
      onCreated?.(data.space.id);
      startTransition(() => {
        router.refresh();
        router.push(`/spaces/${data.space.id}`);
      });
    }
  }

  return (
    <form className="spc-form" onSubmit={submit}>
      <div className="spc-form-row">
        <input
          aria-label="Emoji"
          className="spc-input spc-input--emoji"
          maxLength={4}
          placeholder="◇"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
        />
        <input
          aria-label="Space name"
          className="spc-input spc-input--name"
          placeholder="space name (e.g. thesis, op-aurora, recipe lab)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={80}
        />
      </div>
      <textarea
        aria-label="Description"
        className="spc-textarea"
        placeholder="optional one-line description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        maxLength={280}
      />
      {error && <div className="spc-form-error">{error}</div>}
      <div className="spc-form-actions">
        <button type="button" className="spc-btn spc-btn--ghost" onClick={onClose}>
          cancel
        </button>
        <button type="submit" className="spc-btn spc-btn--primary" disabled={pending}>
          {pending ? "creating…" : "create space"}
        </button>
      </div>
    </form>
  );
}
