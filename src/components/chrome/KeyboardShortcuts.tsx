"use client";

import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/chat/CommandPalette";

/**
 * Global keyboard layer. Mounted once from the root layout so the
 * Cmd/Ctrl+K command palette is available on every page (chat, settings,
 * library, spaces, inbox, etc.). Esc closes; the palette handles its own
 * arrow-key navigation.
 */
export function KeyboardShortcuts() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Cmd/Ctrl+K toggles the palette.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        // Avoid stealing from inputs that bind the same shortcut elsewhere
        // — none today, so just preventDefault.
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // Esc closes when open.
      if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen]);

  return <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />;
}
