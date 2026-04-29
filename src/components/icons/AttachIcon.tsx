import type { SVGProps } from "react";

export function AttachIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M20 11l-8.5 8.5a4.5 4.5 0 11-6.4-6.4l8.5-8.5a3 3 0 014.2 4.2L9 17.5a1.5 1.5 0 11-2.1-2.1l7.4-7.4" />
    </svg>
  );
}
