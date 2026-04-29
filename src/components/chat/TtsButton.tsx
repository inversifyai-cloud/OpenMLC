"use client";

import { useEffect, useRef, useState } from "react";
import { audioPlayer, useAudioPlayer } from "@/lib/audio/player";

type Props = {
  messageId: string;
  text: string;
  autoPlay?: boolean;
};

// Cache blob URLs per message to avoid refetching on subsequent clicks.
const blobCache = new Map<string, string>();

async function fetchTts(text: string): Promise<{ ok: true; blobUrl: string } | { ok: false; status: number }> {
  const res = await fetch("/api/voice/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { ok: true, blobUrl };
}

export function TtsButton({ messageId, text, autoPlay }: Props) {
  const playerState = useAudioPlayer();
  const [localLoading, setLocalLoading] = useState(false);
  const autoPlayedRef = useRef(false);

  const isThis = playerState.messageId === messageId;
  const isPlaying = isThis && playerState.status === "playing";
  const isLoading = localLoading || (isThis && playerState.status === "loading");

  const trigger = async () => {
    if (isPlaying) {
      audioPlayer.stop();
      return;
    }
    const cached = blobCache.get(messageId);
    if (cached) {
      audioPlayer.play(messageId, cached);
      // Note: blob URL is owned by audioPlayer now; remove from cache so we
      // re-fetch next time (player revokes on cleanup).
      blobCache.delete(messageId);
      return;
    }
    setLocalLoading(true);
    audioPlayer.setLoading(messageId);
    try {
      const result = await fetchTts(text);
      if (!result.ok) {
        if (result.status === 402) {
          alert("OpenAI API key required for TTS — add one in settings → API keys");
        }
        audioPlayer.stop();
        return;
      }
      audioPlayer.play(messageId, result.blobUrl);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    if (autoPlay && !autoPlayedRef.current && text.trim().length > 0) {
      autoPlayedRef.current = true;
      void trigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 24,
    minWidth: 24,
    padding: "0 6px",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: isPlaying ? "var(--fg-accent)" : "var(--fg-3)",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "var(--r-1)",
    cursor: isLoading ? "wait" : "pointer",
  };

  return (
    <button
      type="button"
      onClick={() => void trigger()}
      disabled={isLoading || !text.trim()}
      title={isPlaying ? "Stop" : "Read aloud"}
      aria-label={isPlaying ? "Stop reading" : "Read aloud"}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--stroke-1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      {isLoading ? (
        <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden style={{ animation: "spin 0.8s linear infinite" }}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="14 28" strokeLinecap="round" />
        </svg>
      ) : isPlaying ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
