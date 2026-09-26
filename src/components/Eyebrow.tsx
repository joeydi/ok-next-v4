import type { ReactNode } from "react";

/** Section label: `/ 01   SECTION NAME` in mono. Omit `n` for `/ NAME`. */
export function Eyebrow({
  n,
  children,
  className = "text-muted",
}: {
  n?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mono-label flex flex-wrap gap-x-fl-24 ${className}`}>
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
