import type { SVGProps } from "react";

export function GithubIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M9 19c-4 1.5-4-2-6-2.5M15 22v-3.9a3.4 3.4 0 00-1-2.6c3.3-.4 6.7-1.6 6.7-7.3a5.7 5.7 0 00-1.6-3.9 5.3 5.3 0 00-.1-3.9s-1.3-.4-4.2 1.6a14.5 14.5 0 00-7.5 0c-2.9-2-4.2-1.6-4.2-1.6a5.3 5.3 0 00-.1 3.9 5.7 5.7 0 00-1.6 3.9c0 5.7 3.4 6.9 6.7 7.3a3.4 3.4 0 00-1 2.6V22" />
    </svg>
  );
}
