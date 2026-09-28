// Posters: each scene's posterTime frame as a static image, shown until the
// renderer takes over (and instead of it under prefers-reduced-motion). They're
// rendered in /admin/illustrations and written to public/illustrations by its
// poster route — re-save them after changing a scene or DEFAULT_SETTINGS.

/** Poster widths (px): 1× to 3× the 620px drawing surface. */
export const POSTER_WIDTHS = [620, 1240, 1860] as const;
export type PosterFormat = "avif" | "webp";

export const posterPath = (scene: string, width: number, format: PosterFormat) =>
  `/illustrations/${scene}-${width}.${format}`;

export const posterSrcSet = (scene: string, format: PosterFormat) =>
  POSTER_WIDTHS.map((w) => `${posterPath(scene, w, format)} ${w}w`).join(", ");
