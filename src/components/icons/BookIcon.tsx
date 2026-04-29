import type { SVGProps } from "react";

export function BookIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M4 4h7a3 3 0 013 3v14a2 2 0 00-2-2H4z" /><path d="M20 4h-7a3 3 0 00-3 3v14a2 2 0 012-2h8z" />
    </svg>
  );
}
