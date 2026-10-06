import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The plus on a 10×10 grid; also drawn by satori on the fallback social card. */
export const PLUS_PATH = "M3.75 0h2.5v3.75H10v2.5H6.25V10h-2.5V6.25H0v-2.5h3.75z";

/** Bold pink plus that leads every eyebrow, drawn so its weight doesn't depend on the mono font's. */
export function Plus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={cn("size-[0.7em] shrink-0 text-pink", className)}>
      <path fill="currentColor" d={PLUS_PATH} />
    </svg>
  );
}

/**
 * Section label: `+ SECTION NAME` in mono. `n` (the section number) is no longer shown.
 * `href` links the first segment; `details` adds segments after it: `+ NOTES   MAY 19, 2026`.
 */
export function Eyebrow({
  href,
  details,
  children,
  className,
}: {
  n?: string;
  href?: string;
  details?: ReactNode[];
  children: ReactNode;
  className?: string;
}) {
  const lead = (
    <span className="inline-flex items-center gap-[1em]">
      <Plus />
      {children}
    </span>
  );
  return (
    <div className={cn("mono-label flex flex-wrap gap-x-fl-24 text-muted", className)}>
      {href ? <Link href={href}>{lead}</Link> : lead}
      {details?.map((d, i) => (
        <span key={i}>{d}</span>
      ))}
    </div>
  );
}
