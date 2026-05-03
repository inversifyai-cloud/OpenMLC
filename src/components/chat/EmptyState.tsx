"use client";

import { getTimeOfDay } from "@/lib/time-of-day";
import { AmbientOrb } from "./AmbientOrb";

type Props = {
  modelLabel?: string | null;
  personaLabel?: string | null;
  suggestions: string[];
  onPickSuggestion: (text: string) => void;
};

const DEFAULT_SUGGESTIONS = [
  "Explain a concept simply",
  "Help me write something",
  "Debug this code",
  "Brainstorm with me",
];

export function EmptyState({
  modelLabel,
  personaLabel,
  suggestions,
  onPickSuggestion,
}: Props) {
  const { greeting, accentHue } = getTimeOfDay();
  const suggestionList = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  return (
    <div className="empty-state-v2">
      <AmbientOrb hue={accentHue} />

      <div className="empty-state-v2__content">
        <h1 className="empty-state-v2__greeting">
          {greeting}
          <span
            className="empty-state-v2__accent-dot"
            style={{
              background: `oklch(0.65 0.18 ${accentHue})`,
            }}
          />
        </h1>

        <p className="empty-state-v2__sub">
          {modelLabel && personaLabel
            ? `${modelLabel} · ${personaLabel}`
            : modelLabel || "ready"}
        </p>

        <div className="empty-state-v2__chips">
          {suggestionList.map((suggestion, idx) => (
            <button
              key={idx}
              className="empty-state-v2__chip"
              style={{
                animationDelay: `${idx * 60}ms`,
              }}
              onClick={() => onPickSuggestion(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="empty-state-v2__noise">
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <filter id="noise-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              result="noise"
              seed="1"
            />
            <feColorMatrix
              in="noise"
              type="saturate"
              values="0"
            />
          </filter>
          <rect
            width="100%"
            height="100%"
            filter="url(#noise-filter)"
            opacity="0.04"
          />
        </svg>
      </div>
    </div>
  );
}
