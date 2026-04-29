import type { SVGProps } from "react";

export function CommandIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M7 4a3 3 0 100 6h10a3 3 0 100-6 3 3 0 00-3 3v10a3 3 0 11-3-3 3 3 0 013 3" /><path d="M7 10v4M17 10v4M10 7h4M10 17h4" />
    </svg>
  );
}
