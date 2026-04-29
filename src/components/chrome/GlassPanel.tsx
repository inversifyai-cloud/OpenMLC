import { cn } from "@/lib/cn";

type Variant = "glass" | "strong" | "flat";

export function GlassPanel({
  as: Tag = "div",
  variant = "glass",
  className,
  children,
  ...rest
}: {
  as?: keyof React.JSX.IntrinsicElements;
  variant?: Variant;
  className?: string;
  children?: React.ReactNode;
  [k: string]: unknown;
}) {
  const cls =
    variant === "strong" ? "glass-strong" : variant === "flat" ? "glass-flat" : "glass";
  const Component = Tag as React.ElementType;
  return <Component className={cn(cls, className)} {...rest}>{children}</Component>;
}
