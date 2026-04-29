"use client";

import { useState } from "react";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { HudLabel } from "@/components/chrome/HudLabel";

type ProviderId = "openai" | "anthropic" | "google" | "xai" | "fireworks" | "openrouter" | "ollama";

const ALL_PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "xai", label: "xAI" },
  { id: "fireworks", label: "Fireworks" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama (local)" },
];

const EFFORT: Array<{ id: "low" | "medium" | "high"; hint: string }> = [
  { id: "low", hint: "fast, cheap" },
  { id: "medium", hint: "balanced" },
  { id: "high", hint: "deep, slow" },
];

export type SwarmConfigInitial = {
  enabledProviders: string[];
  minAgents: number;
  maxAgents: number;
  reasoningEffort: "low" | "medium" | "high";
  supervisorModel: string;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function SwarmConfigForm({ initial }: { initial: SwarmConfigInitial }) {
  const [minAgents, setMinAgents] = useState(initial.minAgents);
  const [maxAgents, setMaxAgents] = useState(initial.maxAgents);
  const [effort, setEffort] = useState(initial.reasoningEffort);
  const [supervisor, setSupervisor] = useState(initial.supervisorModel);
  const [providers, setProviders] = useState<string[]>(initial.enabledProviders);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allEnabled = providers.length === 0;

  function toggleProvider(id: ProviderId, checked: boolean) {
    if (allEnabled) {

      setProviders(checked ? [] : ALL_PROVIDERS.filter((p) => p.id !== id).map((p) => p.id));
      return;
    }
    setProviders((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((p) => p !== id)
    );
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const lo = clamp(Math.round(minAgents) || 1, 1, 10);
      const hi = clamp(Math.round(maxAgents) || lo, lo, 10);
      const res = await fetch("/api/swarm-config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          minAgents: lo,
          maxAgents: hi,
          reasoningEffort: effort,
          supervisorModel: supervisor,
          enabledProviders: providers,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `save failed (${res.status})`);
      }
      setSavedAt(Date.now());
      setMinAgents(lo);
      setMaxAgents(hi);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="swarm-config">
      <section className="swarm-config-row">
        <div className="swarm-config-label">
          <HudLabel>agent count</HudLabel>
          <p>min and max number of agents the supervisor may spawn (1–10).</p>
        </div>
        <div className="swarm-config-control swarm-config-numbers">
          <label className="swarm-config-number">
            <span className="t-hud">min</span>
            <input
              type="number"
              min={1}
              max={10}
              value={minAgents}
              onChange={(e) => setMinAgents(Number(e.target.value))}
            />
          </label>
          <label className="swarm-config-number">
            <span className="t-hud">max</span>
            <input
              type="number"
              min={1}
              max={10}
              value={maxAgents}
              onChange={(e) => setMaxAgents(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="swarm-config-row">
        <div className="swarm-config-label">
          <HudLabel>reasoning effort</HudLabel>
          <p>how hard each agent thinks before answering.</p>
        </div>
        <div className="swarm-config-control swarm-config-radios">
          {EFFORT.map((opt) => (
            <label
              key={opt.id}
              className={`swarm-config-radio ${effort === opt.id ? "is-active" : ""}`}
            >
              <input
                type="radio"
                name="reasoning-effort"
                value={opt.id}
                checked={effort === opt.id}
                onChange={() => setEffort(opt.id)}
              />
              <span className="swarm-config-radio-id">{opt.id}</span>
              <span className="swarm-config-radio-hint">{opt.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="swarm-config-row">
        <div className="swarm-config-label">
          <HudLabel>supervisor model</HudLabel>
          <p>plans the run, picks worker models, synthesizes the final answer.</p>
        </div>
        <div className="swarm-config-control">
          <ModelPicker value={supervisor} onChange={setSupervisor} />
        </div>
      </section>

      <section className="swarm-config-row">
        <div className="swarm-config-label">
          <HudLabel>enabled providers</HudLabel>
          <p>
            workers may only use models from these providers. leave all unchecked to allow every
            provider with a configured key.
          </p>
        </div>
        <div className="swarm-config-control swarm-config-providers">
          {ALL_PROVIDERS.map((p) => {
            const checked = allEnabled || providers.includes(p.id);
            return (
              <label key={p.id} className="swarm-config-provider">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleProvider(p.id, e.target.checked)}
                />
                <span>{p.label}</span>
              </label>
            );
          })}
          <p className="swarm-config-providers-note">
            {allEnabled ? "all providers enabled" : `${providers.length} provider${providers.length === 1 ? "" : "s"} enabled`}
          </p>
        </div>
      </section>

      <div className="swarm-config-foot">
        <button type="button" className="new-chat" disabled={busy} onClick={save}>
          {busy ? "saving…" : "save changes"}
        </button>
        {savedAt && !err && (
          <span className="t-hud" style={{ color: "var(--fg-mint)" }}>
            saved
          </span>
        )}
        {err && <span style={{ color: "var(--signal-err)", fontSize: 12 }}>· {err}</span>}
      </div>
    </div>
  );
}
