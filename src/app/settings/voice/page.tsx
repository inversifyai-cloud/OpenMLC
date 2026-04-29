"use client";

import { useEffect, useState } from "react";
import { audioPlayer } from "@/lib/audio/player";

const VOICES = ["alloy", "echo", "fable", "nova", "onyx", "shimmer"] as const;
type Voice = (typeof VOICES)[number];

type Prefs = {
  ttsVoice: Voice;
  ttsAutoPlay: boolean;
  ttsSpeed: number;
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12 };

export default function VoiceSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>({ ttsVoice: "nova", ttsAutoPlay: false, ttsSpeed: 1.0 });
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<Voice | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/voice/settings");
      if (res.ok) {
        const data = (await res.json()) as Prefs;
        setPrefs({
          ttsVoice: (VOICES as readonly string[]).includes(data.ttsVoice) ? data.ttsVoice : "nova",
          ttsAutoPlay: !!data.ttsAutoPlay,
          ttsSpeed: typeof data.ttsSpeed === "number" ? data.ttsSpeed : 1.0,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function patch(partial: Partial<Prefs>) {
    setPrefs((p) => ({ ...p, ...partial }));
    await fetch("/api/voice/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(partial),
    });
  }

  async function previewVoice(voice: Voice) {
    setPreviewing(voice);
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Hello, this is OpenMLC speaking.",
          voice,
          speed: prefs.ttsSpeed,
        }),
      });
      if (!res.ok) {
        if (res.status === 402) {
          alert("OpenAI API key required for TTS — add one in settings → API keys");
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioPlayer.play(`preview:${voice}`, url);
    } finally {
      setPreviewing(null);
    }
  }

  async function selectVoice(voice: Voice) {
    await patch({ ttsVoice: voice });
    void previewVoice(voice);
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Voice</h1>
      <p style={{ color: "var(--fg-3)", marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
        Configure text-to-speech playback for assistant messages. Uses your OpenAI API key.
      </p>

      {loading ? (
        <div style={{ color: "var(--fg-3)", fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--stroke-1)",
              borderRadius: "var(--r-3)",
              padding: 16,
              marginBottom: 24,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={prefs.ttsAutoPlay}
                onChange={(e) => void patch({ ttsAutoPlay: e.target.checked })}
              />
              <span>
                <span style={{ fontSize: 13, color: "var(--fg-1)" }}>Auto-play assistant responses</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)" }}>
                  Automatically read new assistant messages aloud once they finish.
                </span>
              </span>
            </label>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
                marginBottom: 8,
              }}
            >
              voice
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {VOICES.map((v) => {
                const selected = prefs.ttsVoice === v;
                const isPreview = previewing === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => void selectVoice(v)}
                    disabled={isPreview}
                    style={{
                      background: selected ? "var(--fg-accent)" : "transparent",
                      color: selected ? "#FAFAF7" : "var(--fg-2)",
                      border: "1px solid",
                      borderColor: selected ? "var(--fg-accent)" : "var(--stroke-1)",
                      borderRadius: "var(--r-2)",
                      padding: "8px 14px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: isPreview ? "wait" : "pointer",
                      opacity: isPreview ? 0.6 : 1,
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 8 }}>
              Click a voice to select it and hear a preview.
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>speed</span>
              <span style={{ color: "var(--fg-2)" }}>{prefs.ttsSpeed.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={prefs.ttsSpeed}
              onChange={(e) => setPrefs((p) => ({ ...p, ttsSpeed: parseFloat(e.target.value) }))}
              onMouseUp={() => void patch({ ttsSpeed: prefs.ttsSpeed })}
              onTouchEnd={() => void patch({ ttsSpeed: prefs.ttsSpeed })}
              onKeyUp={() => void patch({ ttsSpeed: prefs.ttsSpeed })}
              style={{ width: "100%" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                ...MONO,
                fontSize: 10,
                color: "var(--fg-4)",
                letterSpacing: "0.06em",
                marginTop: 4,
              }}
            >
              <span>0.5×</span>
              <span>1.0×</span>
              <span>2.0×</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
