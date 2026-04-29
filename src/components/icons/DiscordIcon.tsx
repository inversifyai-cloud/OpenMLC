import type { SVGProps } from "react";

export function DiscordIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M5 7c2-1 4-1.5 4-1.5l.5 1A11 11 0 0112 6c1.1 0 2 .2 2.5.5l.5-1S17 6 19 7c1 2 2 5 2 9-1.5 1.5-3.5 2-5 2l-1-2c1 0 2-.5 3-1-3.5 1.5-7.5 1.5-12 0 1 .5 2 1 3 1l-1 2c-1.5 0-3.5-.5-5-2 0-4 1-7 2-9z" /><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
