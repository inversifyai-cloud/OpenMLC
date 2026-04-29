import { cn } from "@/lib/cn";

export function HudLabel({
  children,
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "div" | "label";
}) {
  return <Tag className={cn("t-hud", className)}>{children}</Tag>;
}
