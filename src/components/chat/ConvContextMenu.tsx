"use client";

import { useEffect, useRef } from "react";
import type { Folder } from "./FolderManager";

type Props = {
  x: number;
  y: number;
  conversationId: string;
  pinned: boolean;
  archived: boolean;
  folderId: string | null;
  folders: Folder[];
  onClose: () => void;
  onPinToggle: () => void;
  onArchiveToggle: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onDelete: () => void;
  onShare: () => void;
  onRename: () => void;
};

export function ConvContextMenu({
  x, y, conversationId, pinned, archived, folderId, folders,
  onClose, onPinToggle, onArchiveToggle, onMoveToFolder, onDelete, onShare, onRename,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key === "Escape") { onClose(); return; }
      if (e instanceof MouseEvent && menuRef.current && !menuRef.current.contains(e.target as Node)) { onClose(); }
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  function exportConv(format: "md" | "json") {
    window.open(`/api/conversations/${conversationId}/export?format=${format}`, "_blank");
    onClose();
  }

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 9999,
  };

  return (
    <div ref={menuRef} className="ccm" style={menuStyle} role="menu">
      <button className="ccm-item" onClick={() => { onRename(); onClose(); }} role="menuitem" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z" />
        </svg>
        rename
      </button>

      <button className="ccm-item" onClick={() => { onPinToggle(); onClose(); }} role="menuitem" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2l2.4 6.4L21 9l-5 4.5 1.5 7L12 17l-5.5 3.5L8 13.5 3 9l6.6-.6z" />
        </svg>
        {pinned ? "unpin" : "pin"}
      </button>

      <button className="ccm-item" onClick={() => { onArchiveToggle(); onClose(); }} role="menuitem" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
        </svg>
        {archived ? "unarchive" : "archive"}
      </button>

      {folders.length > 0 && (
        <>
          <div className="ccm-sep" />
          <div className="ccm-label">move to folder</div>
          {folderId !== null && (
            <button className="ccm-item ccm-item--indent" onClick={() => { onMoveToFolder(null); onClose(); }} role="menuitem" type="button">
              <span className="ccm-dot" style={{ background: "var(--fg-3)" }} />
              no folder
            </button>
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              className={`ccm-item ccm-item--indent${folderId === f.id ? " ccm-item--active" : ""}`}
              onClick={() => { onMoveToFolder(f.id); onClose(); }}
              role="menuitem"
              type="button"
            >
              <span className="ccm-dot" style={{ background: f.color }} />
              {f.name}
            </button>
          ))}
        </>
      )}

      <div className="ccm-sep" />

      <button className="ccm-item" onClick={() => { exportConv("md"); }} role="menuitem" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        export as markdown
      </button>

      <button className="ccm-item" onClick={() => { exportConv("json"); }} role="menuitem" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        export as json
      </button>

      <button className="ccm-item" onClick={() => { onShare(); onClose(); }} role="menuitem" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        share link
      </button>

      <div className="ccm-sep" />

      <button className="ccm-item ccm-item--danger" onClick={() => { onDelete(); onClose(); }} role="menuitem" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
        delete
      </button>
    </div>
  );
}
