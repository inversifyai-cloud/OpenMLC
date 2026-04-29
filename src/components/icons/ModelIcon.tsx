import type { SVGProps } from "react";

export function ModelIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" opacity="0.4" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </svg>
  );
}
