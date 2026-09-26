import { slug } from "github-slugger";

/** Anchor id for a numbered figure caption ("01 / Client constellation"). */
export function figureId(caption: string) {
  return `fig-${slug(caption.replace(/^\d+ \/ /, ""))}`;
}
