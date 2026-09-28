import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Section label: `/ 01   SECTION NAME` in mono. Omit `n` for `/ NAME`.
 * `href` links the first segment; `details` adds segments after it: `/ NOTES   MAY 19, 2026`.
 */
export function Eyebrow({
  n,
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
  const lead = <>/ {n ?? children}</>;
  return (
    <div className={cn("mono-label flex flex-wrap gap-x-fl-24 text-muted", className)}>
      {href ? <Link href={href}>{lead}</Link> : <span>{lead}</span>}
      {n && <span>{children}</span>}
      {details?.map((d, i) => (
        <span key={i}>{d}</span>
      ))}
    </div>
  );
}
