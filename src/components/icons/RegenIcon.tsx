import type { SVGProps } from "react";

export function RegenIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M4 8a8 8 0 0114-4M20 16a8 8 0 01-14 4" /><path d="M4 4v4h4M20 20v-4h-4" />
    </svg>
  );
}
