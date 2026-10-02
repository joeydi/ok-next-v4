// The river from the "poetry in motion" note (github.com/joeydi/shape-outside-scroll),
// for its diagram: the float's bank as a periodic curve, so a loop can slide it by
// whole periods without a seam, the poem lines that wrap around it, and their fade.

/** A bank: its distance from the float's left edge, as a share of its width, `u` periods down. Periodic in `u`. */
export type Bank = (u: number) => number;

const clampBank = (x: number) => Math.min(1, Math.max(0.06, x));

/** The demo's river. */
export const bank: Bank = (u) => {
  const a = 2 * Math.PI * u;
  return clampBank(0.5 + 0.28 * Math.sin(a) + 0.14 * Math.sin(2 * a + 1.3) + 0.06 * Math.sin(3 * a + 0.4));
};

/** `k` (0–1) of the way from bank `a` to bank `b`. */
export const mixBanks =
  (a: Bank, b: Bank, k: number): Bank =>
  (u) =>
    a(u) + (b(u) - a(u)) * k;

const ROWS = 64; // rows a drawn stroke is averaged into
const HARMONICS = 6; // sines a drawn bank keeps

/**
 * A bank from a stroke drawn down one period ([x share, y share] points, in any
 * order): its height stretched to the period, smoothed, and its ends matched so
 * it loops. Null if it's too short to read as a bank.
 */
export function fitBank(stroke: readonly (readonly [number, number])[]): Bank | null {
  if (stroke.length < 4) return null;
  const ys = stroke.map(([, y]) => y);
  const top = Math.min(...ys),
    span = Math.max(...ys) - top;
  if (span < 0.25) return null;

  // Average the stroke into rows down its height, filling any it skipped from their neighbours.
  const sum = new Array<number>(ROWS).fill(0),
    count = new Array<number>(ROWS).fill(0);
  for (const [x, y] of stroke) {
    const r = Math.min(ROWS - 1, Math.floor(((y - top) / span) * ROWS));
    sum[r] += x;
    count[r]++;
  }
  const filled = sum.map((s, r) => (count[r] ? s / count[r] : null));
  const rows = filled.map((x, r) => {
    if (x !== null) return x;
    const before = filled.findLastIndex((v, i) => i < r && v !== null);
    const after = filled.findIndex((v, i) => i > r && v !== null);
    if (before < 0) return filled[after] as number;
    if (after < 0) return filled[before] as number;
    const k = (r - before) / (after - before);
    return (filled[before] as number) * (1 - k) + (filled[after] as number) * k;
  });

  // Tilt it so its ends meet (about its middle, so it stays where it was drawn), then keep
  // the first few whole-period sines: smooth, and periodic, so the seam can't show.
  const drift = rows[ROWS - 1] - rows[0];
  const level = rows.map((x, r) => x - drift * (r / (ROWS - 1) - 0.5));
  const n = ROWS - 1; // the last row is the first again, a period on
  const terms = Array.from({ length: HARMONICS + 1 }, (_, k) => {
    let c = 0,
      s = 0;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * k * i) / n;
      c += level[i] * Math.cos(a);
      s += level[i] * Math.sin(a);
    }
    // Lanczos σ tapers the top harmonics, so the cut-off doesn't ring.
    const sigma = k === 0 ? 1 : Math.sin((Math.PI * k) / (HARMONICS + 1)) / ((Math.PI * k) / (HARMONICS + 1));
    const w = (k === 0 ? 1 / n : 2 / n) * sigma;
    return [c * w, s * w] as const;
  });

  return (u) => {
    let x = 0;
    for (let k = 0; k < terms.length; k++) {
      const a = 2 * Math.PI * k * u;
      x += terms[k][0] * Math.cos(a) + terms[k][1] * Math.sin(a);
    }
    return clampBank(x);
  };
}

/** Points down `b` for a float `periods` periods tall, `steps` per period: [x share, y share]. */
function bankPoints(periods: number, b: Bank, steps = 48) {
  const n = periods * steps;
  return Array.from({ length: n + 1 }, (_, i) => [b((i / n) * periods), i / n] as const);
}

/** A `shape-outside` polygon() for a float `periods` periods tall, on its border box. */
export function shapePolygon(periods: number, b: Bank = bank) {
  const pts = bankPoints(periods, b).map(([x, y]) => `${+(x * 100).toFixed(2)}% ${+(y * 100).toFixed(3)}%`);
  return `polygon(0% 0%, ${pts.join(", ")}, 0% 100%) border-box`;
}

/** The same outline as an SVG path, for a float `w`×`h` px. */
export function shapePath(w: number, h: number, periods: number, b: Bank = bank) {
  const pts = bankPoints(periods, b).map(([x, y]) => `${+(x * w).toFixed(1)} ${+(y * h).toFixed(1)}`);
  return `M0 0L${pts.join("L")}L0 ${h}Z`;
}

/** Just the bank, one period of it, as an SVG path for a `w`×`h` px box. */
export function bankPath(w: number, h: number, b: Bank, steps = 96) {
  const pts = Array.from(
    { length: steps + 1 },
    (_, i) => `${+(b(i / steps) * w).toFixed(1)} ${+((i / steps) * h).toFixed(1)}`,
  );
  return `M${pts.join("L")}`;
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
