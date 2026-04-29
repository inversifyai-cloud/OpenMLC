import type { SVGProps } from "react";

export function EyeOffIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M3 3l18 18M10.5 6.2A9 9 0 0112 6c6.5 0 10 6 10 6a13 13 0 01-3.2 3.7M6.6 6.6A13 13 0 002 12s3.5 6 10 6a9 9 0 003.5-.7" /><path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </svg>
  );
}
