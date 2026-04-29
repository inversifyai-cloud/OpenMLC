import type { SVGProps } from "react";

export function ThemeIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="8" /><path d="M12 4v16" strokeWidth="1.5" /><path d="M4 12h8" opacity="0" /><path d="M12 4a8 8 0 010 16" fill="currentColor" />
    </svg>
  );
}
