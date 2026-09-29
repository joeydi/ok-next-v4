import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** The admin's pill button (the Open Graph and illustration labs' chips); `on` fills it with ink. */
export function DocButton({ on = false, className, ...props }: ComponentProps<"button"> & { on?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={props["aria-pressed"]}
      {...props}
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-fl-14 transition-colors duration-200 motion-reduce:transition-none",
        on ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink",
        className,
      )}
    />
  );
}
