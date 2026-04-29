import Image from "next/image";
import { cn } from "@/lib/cn";

export function Wordmark({ width = 180, className }: { width?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo/wordmark.svg"
      alt="OpenMLC"
      width={width}
      height={Math.round(width / 5)}
      className={cn("text-fg-1", className)}
      priority
    />
  );
}

export function Monogram({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo/monogram.svg"
      alt="OpenMLC"
      width={size}
      height={size}
      className={cn("text-fg-1", className)}
      priority
    />
  );
}
