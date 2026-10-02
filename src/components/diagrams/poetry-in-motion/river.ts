// The river from the "poetry in motion" note (github.com/joeydi/shape-outside-scroll),
// for its diagram: the float's bank as a periodic curve, so a loop can slide it by
// whole periods without a seam, the poem lines that wrap around it, and their fade.

/** The bank's distance from the float's left edge, as a share of its width, `u` periods down. */
export function bank(u: number) {
  const a = 2 * Math.PI * u;
  const x = 0.5 + 0.28 * Math.sin(a) + 0.14 * Math.sin(2 * a + 1.3) + 0.06 * Math.sin(3 * a + 0.4);
  return Math.min(1, Math.max(0.06, x));
}

/** Points down the bank of a float `periods` periods tall, `steps` per period: [x share, y share]. */
function bankPoints(periods: number, steps = 48) {
  const n = periods * steps;
  return Array.from({ length: n + 1 }, (_, i) => [bank((i / n) * periods), i / n] as const);
}

/** A `shape-outside` polygon() for a float `periods` periods tall, on its border box. */
export function shapePolygon(periods: number) {
  const pts = bankPoints(periods).map(([x, y]) => `${+(x * 100).toFixed(2)}% ${+(y * 100).toFixed(3)}%`);
  return `polygon(0% 0%, ${pts.join(", ")}, 0% 100%) border-box`;
}

/** The same outline as an SVG path, for a float `w`×`h` px. */
export function shapePath(w: number, h: number, periods: number) {
  const pts = bankPoints(periods).map(([x, y]) => `${+(x * w).toFixed(1)} ${+(y * h).toFixed(1)}`);
  return `M0 0L${pts.join("L")}L0 ${h}Z`;
}

/** The poem's opening section, which wraps around the river. */
export const LINES = [
  "I am a river, going down over wide stones,",
  "going down over hard rocks,",
  "my path drawn by the wind.",
  "The trees around me are shrouded with rain.",
  "I am a river, descending with greater fury,",
  "with greater violence,",
  "whenever a bridge reflects me in its curves.",
  "I am a river, a river.",
  "A river: clear as crystal every morning.",
  "Sometimes I am tender and kind.",
  "I slide smoothly through fertile valleys.",
  "I let the cattle and the gentle people",
  "drink as much as they want.",
  "Children run to me by day.",
  "At night, trembling lovers stare into my eyes",
  "and plunge themselves",
] as const;

/**
 * A line's opacity `p` of the way through its pass (0 = its top at the bottom of
 * the viewport, 1 = its bottom at the top): the demo's power2.in fade over the
 * second half.
 */
export function lineOpacity(p: number) {
  const q = Math.min(1, Math.max(0, (p - 0.5) / 0.5));
  return 1 - q ** 3;
}
