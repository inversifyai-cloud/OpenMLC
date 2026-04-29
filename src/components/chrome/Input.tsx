import { cn } from "@/lib/cn";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full px-3 rounded-r3 bg-surface-1 border border-stroke-1 text-fg-1 placeholder:text-fg-4",
          "focus:outline-none focus:border-stroke-focus",
          "focus:shadow-[0_0_0_3px_rgba(var(--cyan-glow),0.18)]",
          "transition-colors",
          className
        )}
        style={{ transitionDuration: "var(--dur-1)" }}
        {...rest}
      />
    );
  }
);
