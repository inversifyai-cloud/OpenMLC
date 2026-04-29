import type { SVGProps } from "react";

export function DotErrorIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M12 5v2M12 17v2M5 12h2M17 12h2" />
    </svg>
  );
}
