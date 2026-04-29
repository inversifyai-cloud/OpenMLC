import type { SVGProps } from "react";

export function SparkleIcon({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
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
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6.5 6.5l3.5 3.5M14 14l3.5 3.5M6.5 17.5L10 14M14 10l3.5-3.5" />
    </svg>
  );
}
