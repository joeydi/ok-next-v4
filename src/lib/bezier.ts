// Cubic bézier easing, drawn the way CSS draws cubic-bezier(x1, y1, x2, y2).
// Client-safe; src/lib/tokens.ts reads the curves themselves from globals.css.

export type Bezier = readonly [number, number, number, number];

/** CSS's `ease` keyword, for the animations that use the browser default. */
export const CSS_EASE: Bezier = [0.25, 0.1, 0.25, 1];

/** Progress (0–1) at time `x` (0–1): Newton's method on x(t), then bisection if it stalls. */
export function bezier([x1, y1, x2, y2]: Bezier): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      if (sx(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** Progress of an animation `ms` after the start, given its delay and duration. */
export function progress(ease: (x: number) => number, ms: number, delay: number, duration: number) {
  return ease(Math.min(1, Math.max(0, (ms - delay) / duration)));
}
