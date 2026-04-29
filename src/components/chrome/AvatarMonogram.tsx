import { cn } from "@/lib/cn";

type Variant = "ai" | "user";
type Accent = "cyan" | "mint" | "ink";

const ACCENT_BG: Record<Accent, string> = {
  cyan: "var(--cyan-500)",
  mint: "var(--mint-400)",
  ink: "var(--ink-700)",
};

export function AvatarMonogram({
  variant = "user",
  letters = "·",
  accent = "cyan",
  size = 32,
  className,
}: {
  variant?: Variant;
  letters?: string;
  accent?: Accent;
  size?: number;
  className?: string;
}) {
  const isAi = variant === "ai";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center font-mono uppercase select-none",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.floor(size * 0.34)),
        letterSpacing: "0.05em",
        fontWeight: 500,
        color: isAi ? "var(--ink-0)" : "var(--fg-1)",
        background: isAi
          ? "linear-gradient(135deg, var(--cyan-500) 0%, var(--mint-400) 100%)"
          : ACCENT_BG[accent],
        borderRadius: "var(--r-3)",
        boxShadow: isAi ? "var(--shadow-glow)" : "var(--shadow-1)",
      }}
    >
      {letters.slice(0, 3)}
    </span>
  );
}
