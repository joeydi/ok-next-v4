import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Section label: `/ 01   SECTION NAME` in mono. Omit `n` for `/ NAME`. */
export function Eyebrow({
  n,
  children,
  className,
}: {
  n?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mono-label flex flex-wrap gap-x-fl-24 text-muted", className)}>
      {n ? (
        <>
          <span>/ {n}</span>
          <span>{children}</span>
        </>
      ) : (
        <span>/ {children}</span>
      )}
    </div>
  );
}
