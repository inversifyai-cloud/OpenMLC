// SpendSparkline — pure SVG, no library. 7 data points, baseline + line + dot.
// Server component (no client APIs used). Defensive: handles all-zero / empty.

type Props = {
  points: number[]; // expected length 7, oldest → newest
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function SpendSparkline({
  points,
  width = 168,
  height = 28,
  className,
  ariaLabel = "7-day spend",
}: Props) {
  const data = points.length >= 2 ? points : [0, 0];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  // padding so dot/stroke don't clip
  const padX = 1.5;
  const padY = 3;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const step = innerW / Math.max(data.length - 1, 1);
  const coords = data.map((v, i) => {
    const x = padX + i * step;
    const flat = max === min;
    const y = flat
      ? padY + innerH / 2
      : padY + innerH - ((v - min) / range) * innerH;
    return { x, y };
  });
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg
      className={`home-spark${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <line
        className="home-spark__base"
        x1={0}
        x2={width}
        y1={height - 0.5}
        y2={height - 0.5}
      />
      <path className="home-spark__line" d={path} />
      <circle className="home-spark__dot" cx={last.x} cy={last.y} r={1.6} />
    </svg>
  );
}
