import type { SVGProps } from "react";

export function TerminalIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="4" width="18" height="16" rx="1" /><path d="M7 9l3 3-3 3M13 15h4" />
    </svg>
  );
}
