import type { SVGProps } from "react";

export function CtxIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="6" width="18" height="12" rx="1" /><path d="M7 10v4M11 10v4M15 10v4" opacity="0.5" />
    </svg>
  );
}
