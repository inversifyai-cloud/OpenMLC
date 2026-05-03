"use client";

type Props = {
  used: number;
  total: number;
};

export function ContextMeter({ used, total }: Props) {
  const percentage = Math.min(100, (used / total) * 100);

  let warnLevel: "amber" | "red" | "over" | undefined;
  if (percentage > 100) {
    warnLevel = "over";
  } else if (percentage >= 85) {
    warnLevel = "red";
  } else if (percentage >= 70) {
    warnLevel = "amber";
  }

  return (
    <div className="context-meter" data-warn={warnLevel ?? undefined}>
      <div
        className="context-meter__fill"
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Context window usage: ${Math.round(percentage)}%`}
      />
    </div>
  );
}
