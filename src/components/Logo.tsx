import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { LOGO_LETTERS, LOGO_VIEWBOX } from "./logo/letters";

/**
 * Wordmark, inline so it takes `currentColor`. Also drawn on OG cards, where satori needs
 * `width`/`height`. The nav draws the hover-reactive DockLogo instead.
 */
export function Logo({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
      role="img"
      aria-label="okayplus"
      {...props}
      className={cn("h-6 w-auto lg:h-7", className)}
    >
      {LOGO_LETTERS.map((l) => (
        <path key={l.char} fill="currentColor" d={l.d} />
      ))}
    </svg>
  );
}
