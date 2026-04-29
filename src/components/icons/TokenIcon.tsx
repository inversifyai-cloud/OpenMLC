import type { SVGProps } from "react";

export function TokenIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <polygon points="12,3 21,8 21,16 12,21 3,16 3,8" /><path d="M12 12v9M3 8l9 4 9-4" opacity="0.5" />
    </svg>
  );
}
