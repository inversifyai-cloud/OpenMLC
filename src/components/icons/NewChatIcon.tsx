import type { SVGProps } from "react";

export function NewChatIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M4 5h10M4 9h6" /><path d="M3 3h12v10H8l-4 4v-4H3z" /><path d="M17 3v6M14 6h6" />
    </svg>
  );
}
