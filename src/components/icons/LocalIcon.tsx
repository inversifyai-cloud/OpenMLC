import type { SVGProps } from "react";

export function LocalIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="4" width="18" height="12" rx="1" /><path d="M3 16l3 4h12l3-4M9 20h6" /><circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
