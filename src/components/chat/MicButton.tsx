"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const BAR_COUNT = 32;

export function MicButton({ onTranscript, disabled }: MicButtonProps) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barHeights, setBarHeights] = useState<number[]>(Array(BAR_COUNT).fill(0.2));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAnalysis = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    setBarHeights(Array(BAR_COUNT).fill(0.2));
  }, []);

  const startAnalysis = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const bucketSize = Math.floor(dataArray.length / BAR_COUNT);
      const heights = Array.from({ length: BAR_COUNT }, (_, i) => {
        const start = i * bucketSize;
        let sum = 0;
        for (let j = start; j < start + bucketSize; j++) sum += dataArray[j] ?? 0;
        const avg = sum / bucketSize / 255;
        return Math.max(0.08, avg);
      });
      setBarHeights(heights);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopAnalysis();
    setRecording(false);
  }, [stopAnalysis]);

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }

    streamRef.current = stream;
    startAnalysis(stream);

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      setLoading(true);
      try {
        const form = new FormData();
        form.append("file", blob, "audio.webm");
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        if (res.ok) {
          const data = await res.json() as { text?: string };
          if (data.text) onTranscript(data.text);
        }
      } finally {
        setLoading(false);
      }
    };

    recorder.start();
    setRecording(true);
  }, [startAnalysis, onTranscript]);

  const handleClick = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, stopRecording, startRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      className={`voice-btn${recording ? " voice-btn--recording" : ""}`}
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={recording ? "Stop recording" : "Start recording"}
      title={recording ? "Stop recording" : "Record voice input"}
    >
      {recording ? (
        <>
          <span className="voice-rec-dot" aria-hidden="true" />
          <span
            className="voice-waveform"
            aria-hidden="true"
            style={{ width: BAR_COUNT * 4 }}
          >
            {barHeights.map((h, i) => (
              <span
                key={i}
                className="voice-waveform-bar"
                style={{ transform: `scaleY(${h})` }}
              />
            ))}
          </span>
          <span>REC</span>
        </>
      ) : loading ? (
        <span>...</span>
      ) : (
        <span>MIC</span>
      )}
    </button>
  );
}
