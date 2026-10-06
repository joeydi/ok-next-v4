import type { ReactNode, Ref } from "react";
import { figureId } from "@/lib/figure-id";
import { Jog } from "./Jog";
import type { LoopJog } from "./useLoop";

/**
 * A technique diagram in a note, laid out and captioned like a <Figure> (see
 * src/components/mdx.tsx), in the same media frame: "wide" spans columns 2–12,
 * "full" 1–12. Diagrams are hidden from assistive tech, so `description` says
 * what one shows. Pass the loop's `jog` (from useLoop) for a jog wheel along
 * the bottom that scrubs and throws it. Outside a note, leave out the caption
 * and place it with `className`; `bare` drops the frame, to set it straight on
 * the page. See .claude/skills/diagram/SKILL.md.
 */
export function DiagramFigure({
  caption,
  description,
  layout = "wide",
  className,
  bare = false,
  ref,
  jog,
  children,
}: {
  caption?: string;
  description: string;
  layout?: "wide" | "full";
  /** Replaces the note's figure layout. */
  className?: string;
  /** Without the media frame: no background, corners or shadow. */
  bare?: boolean;
  ref?: Ref<HTMLElement>;
  jog?: LoopJog;
  children: ReactNode;
}) {
  const numbered = caption !== undefined && /^\d+ \/ /.test(caption);
  return (
    <figure
      ref={ref}
      id={numbered ? figureId(caption) : undefined}
      className={className ?? `note-fig note-fig-${layout}`}
    >
      <p className="sr-only">{description}</p>
      {/* The media frame, as images and videos get, on raised paper, with the loop's jog wheel over it. */}
      <div className={bare ? "@container relative" : "frame @container relative overflow-hidden bg-paper-raised"}>
        {children}
        {jog && <Jog jog={jog} />}
      </div>
      {caption && <figcaption className="mono-label mt-fl-28 text-muted">{caption}</figcaption>}
    </figure>
  );
}
