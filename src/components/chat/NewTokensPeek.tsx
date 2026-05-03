"use client";

type Props = {
  visible: boolean;
  hiddenLines: number;
  onClick: () => void;
};

export function NewTokensPeek({ visible, hiddenLines, onClick }: Props) {
  return (
    <div
      className={`new-tokens-peek${visible ? " is-visible" : ""}`}
      role="button"
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${hiddenLines} new lines below, click to scroll`}
    >
      <span>↓</span>
      <span>{hiddenLines} new line{hiddenLines !== 1 ? "s" : ""}</span>
    </div>
  );
}
