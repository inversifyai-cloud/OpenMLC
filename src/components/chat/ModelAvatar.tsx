"use client";

import { useEffect, useRef, useState } from "react";

// Model-aware avatar with brand color + monogram. Replaces the static "M·L"
// placeholder for assistant messages. Supports three states:
//   - idle:   subtle ambient glow
//   - stream: breathing pulse (matches the streaming cursor's rhythm)
//   - settle: one-shot brightness pop on stream completion
//
// The settle state auto-fires for 720ms when `state` transitions from
// "stream" → "idle", giving every reply a tiny "ahh" beat.
//
// Brand palette is intentionally muted (≤ 30% saturation against the surface)
// so the avatar reads as identity, not decoration.

type State = "idle" | "stream" | "settle";

type Props = {
  modelId?: string | null;
  providerId?: string | null;
  state?: State;
  size?: number; // px, default 28
  monogram?: string; // override (used by user/profile avatars)
};

type Brand = { mono: string; hue: string };

// Provider → brand. `hue` is an oklch chroma anchor used in the gradient.
const BRANDS: Record<string, Brand> = {
  anthropic:  { mono: "C", hue: "30"  }, // warm amber
  openai:     { mono: "O", hue: "165" }, // mint-green
  google:     { mono: "G", hue: "240" }, // blue-violet
  xai:        { mono: "X", hue: "0"   }, // greyscale (handled in CSS)
  fireworks:  { mono: "F", hue: "20"  }, // ember orange
  openrouter: { mono: "R", hue: "300" }, // purple
  ollama:     { mono: "L", hue: "20"  }, // ollama orange
  custom:     { mono: "M", hue: "200" }, // teal
};

// Try to extract a sensible monogram from the model id when we don't recognize the provider.
function fallbackMonogram(modelId?: string | null): string {
  if (!modelId) return "M";
  const tail = modelId.split("/").pop() ?? modelId;
  const firstAlpha = tail.match(/[A-Za-z]/);
  return (firstAlpha?.[0] ?? "M").toUpperCase();
}

export function ModelAvatar({
  modelId,
  providerId,
  state = "idle",
  size = 28,
  monogram,
}: Props) {
  const brand = providerId ? BRANDS[providerId] : undefined;
  const display = monogram ?? brand?.mono ?? fallbackMonogram(modelId);
  const accent = brand?.hue ?? "200";

  // Auto-fire settle state on stream → idle transition.
  const prevState = useRef<State>(state);
  const [transient, setTransient] = useState<State | null>(null);
  useEffect(() => {
    if (prevState.current === "stream" && state === "idle") {
      setTransient("settle");
      const t = setTimeout(() => setTransient(null), 720);
      prevState.current = state;
      return () => clearTimeout(t);
    }
    prevState.current = state;
  }, [state]);

  const effective = transient ?? state;

  return (
    <span
      className={`model-avatar is-${effective}`}
      data-provider={providerId ?? "unknown"}
      style={{
        ["--avatar-size" as string]: `${size}px`,
        ["--avatar-hue" as string]: accent,
      }}
      aria-hidden
      title={modelId ?? undefined}
    >
      <span className="model-avatar__mono">{display}</span>
    </span>
  );
}
