"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/chrome/Input";
import { Button } from "@/components/chrome/Button";
import { HudLabel } from "@/components/chrome/HudLabel";
import { AvatarMonogram } from "@/components/chrome/AvatarMonogram";
import type { AvatarAccent } from "@/types/profile";

export function NewProfileForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [monogram, setMonogram] = useState("");
  const [accent, setAccent] = useState<AvatarAccent>("cyan");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const previewMonogram = (monogram || displayName.slice(0, 2) || "·").toUpperCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          displayName,
          password,
          avatarMonogram: monogram || undefined,
          avatarAccent: accent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "registration failed");
      router.push("/chat");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AvatarMonogram letters={previewMonogram} accent={accent} size={48} />
        <div className="flex flex-col gap-1">
          <HudLabel>preview</HudLabel>
          <span className="font-mono text-[12px] text-fg-3">{previewMonogram} · {accent}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <HudLabel>display name</HudLabel>
        <Input
          autoFocus
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="corbin"
          maxLength={64}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <HudLabel>username</HudLabel>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="corbin"
          maxLength={32}
          pattern="[a-z0-9_-]{2,32}"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <HudLabel>password</HudLabel>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="·······"
          minLength={6}
          maxLength={200}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <HudLabel>monogram</HudLabel>
          <Input
            value={monogram}
            onChange={(e) => setMonogram(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="auto"
            maxLength={3}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <HudLabel>accent</HudLabel>
          <div className="flex gap-2">
            {(["cyan", "mint", "ink"] as AvatarAccent[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAccent(a)}
                className="flex-1 h-10 rounded-r3 border text-[12px] font-mono uppercase tracking-[0.12em] transition-colors"
                style={{
                  background: accent === a ? "var(--surface-selected)" : "transparent",
                  borderColor: accent === a ? "var(--cyan-500)" : "var(--stroke-1)",
                  color: accent === a ? "var(--fg-1)" : "var(--fg-3)",
                  transitionDuration: "var(--dur-1)",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && (
        <p className="text-[13px]" style={{ color: "var(--signal-err)" }}>
          · {err}
        </p>
      )}

      <Button type="submit" disabled={busy} className="mt-2">
        {busy ? "creating…" : "create profile"}
      </Button>
    </form>
  );
}
