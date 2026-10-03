import { isValidElement, type ReactNode } from "react";
import { figureId } from "@/lib/figure-id";
import { getMedia, type MediaKey } from "@/lib/media";
import { Placeholder } from "./Placeholder";

// Components available in every note without importing. Layout (which grid
// columns each block spans) lives in the .note-body rules in globals.css.

/** Opening paragraph, set in Gelica. */
export function Lead({ children }: { children: ReactNode }) {
  // Written over several lines, a lead reaches here wrapped in a paragraph of MDX's own, which
  // can't sit in this one: unwrap it.
  const text =
    isValidElement<{ children?: ReactNode }>(children) && children.type === "p" ? children.props.children : children;
  return <p className="note-lead">{text}</p>;
}

/**
 * Image/video figure.
 * - layout "wide": columns 2–12 (default)  · "full": 1–12  · "half": 6 columns; place two in a row
 * - caption "01 / Client constellation" (numbered) also adds an "In this post" entry,
 *   but only in notes with no `## headings` (a note with headings lists just those)
 * - media "notes/thinkmd/hero.jpg": R2 key from src/data/media.json; striped placeholder until set.
 *   Without a caption prop, the manifest's caption is shown (but never numbered into "In this post").
 *   Real media keeps its own aspect ratio; the layout's ratio only shapes placeholders.
 */
export function Figure({
  label,
  media,
  alt,
  caption,
  layout = "wide",
  dark = false,
}: {
  label?: string;
  media?: MediaKey;
  alt?: string;
  caption?: string;
  layout?: "wide" | "full" | "half";
  dark?: boolean;
}) {
  const numbered = caption && /^\d+ \/ /.test(caption);
  const m = media ? getMedia(media) : undefined;
  const shown = caption ?? m?.caption;
  return (
    <figure id={numbered ? figureId(caption) : undefined} className={`note-fig note-fig-${layout}`}>
      <Placeholder
        label={label ?? caption ?? ""}
        media={m}
        alt={alt}
        dark={dark}
        sizes={layout === "half" ? "(min-width: 1024px) 50vw, 100vw" : "100vw"}
        natural={Boolean(m)}
        className="note-fig-media"
      />
      {shown && <figcaption className="mono-label mt-fl-28 text-muted">{shown}</figcaption>}
    </figure>
  );
}

/**
 * Invisible anchor that adds an "In this post" entry where there's no numbered
 * figure, in a note with no `## headings`: <TocAnchor label="04 / Services pathway" />
 */
export function TocAnchor({ label }: { label: string }) {
  return <span id={figureId(label)} className="note-anchor" aria-hidden="true" />;
}

/** Big Gelica pull quote; *emphasis* renders in pink. */
export function PullQuote({ children }: { children: ReactNode }) {
  return <blockquote className="note-quote">{children}</blockquote>;
}

/**
 * A person the note introduces, as a margin note: a portrait, their name and
 * dates, and a line or two about them. From xl it sits in the right margin,
 * level with the heading of the section it opens; below that, it's a small
 * card in the text. Put it straight after that section's `##` heading:
 * <Profile media="notes/<slug>/portrait.jpg" name="…" dates="1942–1963">About them.</Profile>
 */
export function Profile({
  media,
  name,
  dates,
  children,
}: {
  media?: MediaKey;
  name: string;
  dates?: string;
  children: ReactNode;
}) {
  const m = media ? getMedia(media) : undefined;
  return (
    <aside className="note-profile">
      <Placeholder
        label="portrait"
        media={m}
        small
        sizes="(min-width: 1280px) 20vw, 128px"
        className="note-profile-photo"
      />
      <div className="flex flex-col gap-fl-8">
        {/* Name and dates read as one heading: no gap between them. */}
        <div>
          <p className="display text-fl-24 text-ink leading-display-text-24 tracking-display-24">{name}</p>
          {dates && <p className="mono-text text-muted">{dates}</p>}
        </div>
        <div className="text-body text-fl-14 leading-copy">{children}</div>
      </div>
    </aside>
  );
}
