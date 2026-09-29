// The few colours a doc's charts draw in, as text colours: SVG takes them through
// `currentColor`. Named for what they mark in a chart, so a doc never picks a hex.

export const TONES = {
  /** The subject: the new page, the curve being shown. */
  pink: "text-pink",
  /** What it's compared against: the old page. */
  muted: "text-muted-light",
  /** Supporting parts: the nav, the rows that stay. */
  ink: "text-ink-2",
  /** Background parts: the browser's own fade. */
  guide: "text-guide",
} as const;

export type Tone = keyof typeof TONES;
