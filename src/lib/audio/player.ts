"use client";

import { useSyncExternalStore } from "react";

export type AudioStatus = "idle" | "loading" | "playing";

export type AudioState = {
  messageId: string | null;
  status: AudioStatus;
};

let state: AudioState = { messageId: null, status: "idle" };
let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: AudioState) {
  state = next;
  emit();
}

function cleanupCurrent() {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      // ignore
    }
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (currentBlobUrl) {
    try {
      URL.revokeObjectURL(currentBlobUrl);
    } catch {
      // ignore
    }
    currentBlobUrl = null;
  }
}

export const audioPlayer = {
  getCurrent(): AudioState {
    return state;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setLoading(messageId: string) {
    setState({ messageId, status: "loading" });
  },
  play(messageId: string, blobUrl: string) {
    cleanupCurrent();
    const audio = new Audio(blobUrl);
    currentAudio = audio;
    currentBlobUrl = blobUrl;
    audio.onended = () => {
      cleanupCurrent();
      setState({ messageId: null, status: "idle" });
    };
    audio.onerror = () => {
      cleanupCurrent();
      setState({ messageId: null, status: "idle" });
    };
    setState({ messageId, status: "playing" });
    void audio.play().catch(() => {
      cleanupCurrent();
      setState({ messageId: null, status: "idle" });
    });
  },
  stop() {
    cleanupCurrent();
    setState({ messageId: null, status: "idle" });
  },
};

const serverSnapshot: AudioState = { messageId: null, status: "idle" };

export function useAudioPlayer(): AudioState {
  return useSyncExternalStore(
    audioPlayer.subscribe,
    audioPlayer.getCurrent,
    () => serverSnapshot,
  );
}
