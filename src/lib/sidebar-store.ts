"use client";

import { useSyncExternalStore } from "react";

let isOpen = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const sidebarStore = {
  get: () => isOpen,
  set(value: boolean) {
    if (value === isOpen) return;
    isOpen = value;
    emit();
  },
  toggle() {
    isOpen = !isOpen;
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useSidebarOpen(): boolean {
  return useSyncExternalStore(
    sidebarStore.subscribe,
    sidebarStore.get,
    () => false,
  );
}
