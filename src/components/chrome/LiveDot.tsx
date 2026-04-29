import { cn } from "@/lib/cn";

type Status = "ok" | "active" | "error" | "idle";

const COLOR: Record<Status, string> = {
  ok: "var(--mint-400)",
  active: "var(--cyan-500)",
  error: "var(--signal-err)",
  idle: "var(--ink-400)",
};

const GLOW: Record<Status, string> = {
  ok: "0 0 8px rgba(var(--mint-glow), 0.85)",
  active: "0 0 8px rgba(var(--cyan-glow), 0.85)",
  error: "0 0 8px rgba(255, 85, 102, 0.8)",
  idle: "none",
};

export function LiveDot({
  status = "ok",
  pulse = true,
  size = 6,
  className,
}: {
  status?: Status;
  pulse?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block rounded-full", pulse && status !== "idle" && "live-pulse", className)}
      style={{
        width: size,
        height: size,
        background: COLOR[status],
        boxShadow: GLOW[status],
      }}
    />
  );
}
