import type { SVGProps } from "react";

export function HomeIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M3 12l9-8 9 8v9a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1z" />
    </svg>
  );
}
