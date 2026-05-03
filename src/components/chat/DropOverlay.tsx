"use client";

type Props = {
  isDraggingOver: boolean;
};

export function DropOverlay({ isDraggingOver }: Props) {
  return (
    <div className={`drop-overlay${isDraggingOver ? " is-active" : ""}`}>
      <div className="drop-overlay__panel">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>Drop to attach</span>
      </div>
    </div>
  );
}
