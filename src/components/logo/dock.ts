import { LOGO_LETTERS, LOGO_VIEWBOX } from "./letters";

/**
 * The maths behind the dock logo (DockLogo.tsx), kept pure so the admin lab
 * (/admin/logo) can drive it too. Each letter has a target scale from its distance
 * to the pointer; a spring per letter chases it, and the layout spaces the letters
 * from their current scales, so neighbours ride the same springs.
 */

export type DockFalloff = "cosine" | "gaussian" | "linear";
/** What holds still as the letters grow: the point under the pointer, or an end of the logo. */
export type DockAnchor = "pointer" | "left" | "center";

export type DockSettings = {
  /** Scale of the letter right under the pointer. */
  scale: number;
  /** How many letters either side the swell reaches before it dies out. */
  reach: number;
  falloff: DockFalloff;
  /** 0: letters grow in place and overlap; 1: they push their neighbours apart. */
  spread: number;
  anchor: DockAnchor;
  /** Where letters grow from, as a share of the viewBox height (0 top, 1 bottom). */
  originY: number;
  stiffness: number;
  damping: number;
  mass: number;
};

export const DEFAULT_DOCK: DockSettings = {
  scale: 1.5,
  reach: 3,
  falloff: "cosine",
  spread: 0.5,
  anchor: "pointer",
  originY: 0.5,
  stiffness: 320,
  damping: 16,
  mass: 1,
};

const CENTERS = LOGO_LETTERS.map((l) => (l.x0 + l.x1) / 2);
const WIDTHS = LOGO_LETTERS.map((l) => l.x1 - l.x0);
const LAST = LOGO_LETTERS.length - 1;
/** The average distance between letter centres, the unit of `reach`. */
const PITCH = (CENTERS[LAST] - CENTERS[0]) / LAST;

/** 1 at the pointer, falling to 0 at `t` = 1 (one reach away). */
export function falloff(kind: DockFalloff, t: number) {
  const a = Math.abs(t);
  if (kind === "gaussian") return Math.exp(-3 * a * a);
  if (a >= 1) return 0;
  return kind === "cosine" ? 0.5 + 0.5 * Math.cos(Math.PI * a) : 1 - a;
}

/** Each letter's target scale for a pointer at viewBox x `px`, or all 1 when it's away. */
export function dockTargets(px: number | null, s: DockSettings) {
  return CENTERS.map((c) => (px === null ? 1 : 1 + (s.scale - 1) * falloff(s.falloff, (px - c) / (s.reach * PITCH))));
}

/**
 * An SVG transform per letter for the current `scales`. The gap between two letters'
 * centres grows by the mean of their scales, then the row shifts so the anchor holds
 * still; `px` is the last pointer x, for the pointer anchor.
 */
export function dockTransforms(scales: readonly number[], px: number, s: DockSettings) {
  const pushed = [CENTERS[0]];
  for (let i = 1; i <= LAST; i++) {
    pushed.push(pushed[i - 1] + (CENTERS[i] - CENTERS[i - 1]) * ((scales[i - 1] + scales[i]) / 2));
  }

  let shift = 0;
  if (s.anchor === "left") {
    shift = (WIDTHS[0] * (scales[0] - 1)) / 2;
  } else if (s.anchor === "center") {
    const left = pushed[0] - (WIDTHS[0] * scales[0]) / 2;
    const right = pushed[LAST] + (WIDTHS[LAST] * scales[LAST]) / 2;
    shift = (LOGO_LETTERS[0].x0 + LOGO_LETTERS[LAST].x1) / 2 - (left + right) / 2;
  } else {
    shift = px - remap(px, pushed, scales);
  }

  const oy = s.originY * LOGO_VIEWBOX.h;
  return CENTERS.map((c, i) => {
    const k = scales[i];
    const x = c + s.spread * (pushed[i] + shift - c);
    return `matrix(${k} 0 0 ${k} ${x - c * k} ${oy - oy * k})`;
  });
}

/** Where viewBox x `px` lands once the centres move to `pushed`, linear between them. */
function remap(px: number, pushed: readonly number[], scales: readonly number[]) {
  if (px <= CENTERS[0]) return pushed[0] + (px - CENTERS[0]) * scales[0];
  if (px >= CENTERS[LAST]) return pushed[LAST] + (px - CENTERS[LAST]) * scales[LAST];
  let i = 0;
  while (px > CENTERS[i + 1]) i++;
  const t = (px - CENTERS[i]) / (CENTERS[i + 1] - CENTERS[i]);
  return pushed[i] + t * (pushed[i + 1] - pushed[i]);
}

/** Advances a damped spring by `dt` seconds, in substeps short enough to stay stable when stiff. */
export function stepSpring(x: number, v: number, target: number, dt: number, s: DockSettings): [number, number] {
  const n = Math.ceil(dt / (1 / 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    v += ((-s.stiffness * (x - target) - s.damping * v) / s.mass) * h;
    x += v * h;
  }
  return [x, v];
}
