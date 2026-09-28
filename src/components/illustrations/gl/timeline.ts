// Keyframe sampling with CSS semantics, so timings port straight from the
// keyframes the CSS illustrations generate.

export type Ease = (u: number) => number;

/** CSS cubic-bezier(x1, y1, x2, y2). */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s: number) => ((ax * s + bx) * s + cx) * s;
  const Y = (s: number) => ((ay * s + by) * s + cy) * s;
  const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 8; i++) {
      const e = X(s) - x, d = dX(s);
      if (Math.abs(e) < 1e-6) return Y(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    // Newton stalled: bisect.
    let lo = 0, hi = 1;
    s = x;
    for (let i = 0; i < 30 && Math.abs(X(s) - x) > 1e-6; i++) {
      if (X(s) > x) hi = s;
      else lo = s;
      s = (lo + hi) / 2;
    }
    return Y(s);
  };
}

export const linear: Ease = (u) => u;
export const easeInOut = bezier(0.42, 0, 0.58, 1);

/** [time, value, easing to the next stop] — like a CSS keyframe with its animation-timing-function. */
export type Stop = [t: number, v: number, ease?: Ease];

/** Samples piecewise keyframes; holds the first and last values outside their range. */
export function track(stops: Stop[]) {
  return (t: number) => {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, v0, ease = linear] = stops[i], [t1, v1] = stops[i + 1];
      if (t < t1) return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
    }
    return stops[stops.length - 1][1];
  };
}

/** t wrapped into [0, period). */
export const wrap = (t: number, period: number) => ((t % period) + period) % period;
