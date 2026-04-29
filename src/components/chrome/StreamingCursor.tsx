import { cn } from "@/lib/cn";

export function StreamingCursor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block align-text-bottom live-pulse", className)}
      style={{
        width: 8,
        height: 16,
        background: "var(--cyan-500)",
        boxShadow: "var(--shadow-glow)",
        marginLeft: 2,
        borderRadius: "var(--r-1)",
      }}
    />
  );
}
