import type { ReactNode } from "react";
import { figureId } from "@/lib/figure-id";
import { Placeholder } from "./Placeholder";

// Components available in every note without importing. Layout (which grid
// columns each block spans) lives in the .note-body rules in globals.css.

/** Opening paragraph, set in Gelica. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="note-lead">{children}</p>;
}

/**
 * Image/video figure.
 * - layout "wide": columns 2–12 (default)  · "full": 1–12  · "half": 6 columns; place two in a row
 * - caption "01 / Client constellation" (numbered) also adds an "In this post" entry
 */
export function Figure({
  label,
  src,
  alt,
  caption,
  layout = "wide",
  dark = false,
}: {
  label?: string;
  src?: string;
  alt?: string;
  caption?: string;
  layout?: "wide" | "full" | "half";
  dark?: boolean;
}) {
  const numbered = caption && /^\d+ \/ /.test(caption);
  return (
    <figure id={numbered ? figureId(caption) : undefined} className={`note-fig note-fig-${layout}`}>
      <Placeholder
        label={label ?? caption ?? ""}
        src={src}
        alt={alt}
        dark={dark}
        sizes={layout === "half" ? "(min-width: 1024px) 50vw, 100vw" : "100vw"}
        className="note-fig-media"
      />
      {caption && <figcaption className="mono-label mt-fl-28 tracking-label-tight text-muted">{caption}</figcaption>}
    </figure>
  );
}

/**
 * Invisible anchor that adds an "In this post" entry where there's no numbered
 * figure or heading: <TocAnchor label="04 / Services pathway" />
 */
export function TocAnchor({ label }: { label: string }) {
  return <span id={figureId(label)} className="note-anchor" aria-hidden="true" />;
}

/** Big Gelica pull quote; *emphasis* renders in pink. */
export function PullQuote({ children }: { children: ReactNode }) {
  return <blockquote className="note-quote">{children}</blockquote>;
}
