import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A visual in a doc: a paper panel with a mono title above and a caption below.
 * Full width in the doc (`doc-wide`); put two or three in a <DocGrid> to set them side by side.
 */
export function DocFigure({
  title,
  caption,
  children,
  className,
}: {
  title?: ReactNode;
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("doc-wide flex min-w-0 flex-col gap-fl-16", className)}>
      {title && <div className="mono-label text-ink">{title}</div>}
      <div className="min-w-0 rounded-lg border border-rule bg-paper-light p-fl-24">{children}</div>
      {caption && (
        <figcaption className="max-w-[40rem] text-fl-18 leading-[1.6] text-pretty text-body">{caption}</figcaption>
      )}
    </figure>
  );
}

/** Figures or cards side by side from md: two columns, or three from xl with `cols={3}`. */
export function DocGrid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return (
    <div className={cn("doc-wide grid items-start gap-fl-32 md:grid-cols-2", cols === 3 && "xl:grid-cols-3")}>
      {children}
    </div>
  );
}
