import { P, W } from "../../primitives";
import { quat } from "../math";
import type { Item, SceneDef } from "../renderer";
import { bezier, track, wrap } from "../timeline";

// Website care, concept — bounce-row's layout, with the columns all one
// height. The pink ball rolls along the top as the row slides under it, until
// a column is missing and it drops into the gap. Just in time a short pink
// column slides in from the side, catches it, and lifts it back up level with
// the rest; the ball rolls back to its place and the pink column travels on.
// 9s loop.

const TS = 1.5; // one column passes the centre every TS (s)
const N = 6; // columns per loop, one of them missing
const T = N * TS; // loop length (s)
const PITCH = 144; // column spacing (px)
const CW = 114; // column width (px)
const V = PITCH / TS; // row speed (px/s)
const HIT = 3.6; // when a column is under the ball (s into its loop)
const H = 170; // column height (px)
const DROP = 80; // how far the ball falls before it's caught (px)
const BR = (V * T) / (4 * Math.PI); // ball radius (px): two full rolls per loop, so the spin closes
const SLIDE = 300; // how far the pink column slides in from (px)

// The ball keeps rolling at the row's speed as it goes over the edge into the gap: round
// the column's corner, then off it in an arc, landing on the pink column and slowing to a
// stop there. On screen it holds its place until it lands, then goes with the row.
const EDGE = PITCH - CW / 2; // from the gap's centre back to the edge of the column before it (px)
const S0 = HIT - EDGE / V; // the ball's centre passes the edge (s)
const LAND = -12; // where it lands, from the gap's centre (px)
// How far it rolls round the corner before it leaves it (rad): far enough that the arc
// it leaves on falls away from the corner rather than cutting into it.
const PHI = 1.15;
const ROUND = (BR * Math.sin(PHI)) / V; // how long that takes (s)
const FLY = (EDGE + LAND - BR * Math.sin(PHI)) / V; // then how long it's in the air (s)
const CATCH = S0 + ROUND + FLY; // it lands on the pink column (s)
const SETTLE = 0.25; // and slows to a stop on it over this long (s)
// Gravity (px/s²) that takes it from leaving the corner, along the corner's tangent at V, onto the pink column at CATCH.
const G = (2 * (BR * Math.cos(PHI) + DROP - BR - V * Math.tan(PHI) * FLY)) / FLY ** 2;
const UP = CATCH + 0.85; // the pink column is level with the rest (s)
const BACK = 0.9; // and the ball rolls back to the centre over this long (s)

const EASE_IN = bezier(0.55, 0, 1, 0.45);
const EASE_OUT = bezier(0.2, 0.8, 0.3, 1);
const EASE_IO = bezier(0.45, 0, 0.55, 1);

// Per column, by time into its loop: rises off the floor as it comes in and sinks as it leaves.
const rise = track([
  [HIT - 3.5, 0, EASE_OUT],
  [HIT - 2.3, 1],
  [HIT + 1.8, 1, EASE_IN],
  [HIT + 3, 0],
]);
const fade = track([
  [HIT - 3.5, 0],
  [HIT - 3.25, 1],
  [HIT + 2.75, 1],
  [HIT + 3, 0],
]);

// The missing column's loop: the pink column sliding in and lifting.
const lift = track([
  [CATCH, H - DROP, EASE_OUT],
  [CATCH + 0.1, H - DROP - 12, EASE_IO],
  [CATCH + 0.3, H - DROP],
  [CATCH + 0.35, H - DROP, EASE_IO],
  [UP, H],
]);
const slide = track([
  [CATCH - 0.8, SLIDE, EASE_OUT],
  [CATCH - 0.02, 0],
]);
const slideFade = track([
  [CATCH - 0.8, 0],
  [CATCH - 0.6, 1],
]);
const back = track([
  [UP, 0, EASE_IO],
  [UP + BACK, 1],
]);

/** A column's x, by time into its loop. */
const colX = (s: number) => 150 + V * (HIT - s);

/** The ball's x relative to the gap's centre, from when it passes the edge: at the row's speed, then slowing on the pink column. */
function gapX(s: number) {
  const d = s - S0,
    e = Math.min(Math.max(d - ROUND - FLY, 0), SETTLE);
  return -EDGE + V * (Math.min(d, ROUND + FLY) + e - (e * e) / (2 * SETTLE));
}

/** The ball's height from when it passes the edge until it lands: round the corner, then a parabola. */
function fallZ(s: number) {
  const d = s - S0;
  if (d < ROUND) return H + Math.sqrt(BR * BR - (V * d) ** 2);
  const f = d - ROUND;
  return H + BR * Math.cos(PHI) - V * Math.tan(PHI) * f - (G * f * f) / 2;
}

function ballX(s: number) {
  if (s < S0 || s >= UP + BACK) return 150;
  const carried = colX(s) + gapX(s);
  // Rolls back from going with the row, without a jolt as it sets off.
  return carried + (150 - carried) * back(s);
}

function frame(t: number): Item[] {
  const items: Item[] = [];
  // Column 0 is the missing one; the pink column stands in for it.
  for (let j = 1; j < N; j++) {
    const s = wrap(t + j * TS, T),
      h = rise(s) * H,
      f = fade(s);
    if (h < 0.5 || f <= 0) continue;
    items.push({
      kind: "box",
      center: [colX(s), 150, h / 2],
      half: [CW / 2, CW / 2, h / 2],
      pal: W,
      fade: f,
      edges: [0, 0, 1],
    });
  }

  const s = wrap(t, T);
  const sf = slideFade(s) * fade(s);
  if (sf > 0) {
    const h = lift(s) * rise(s);
    items.push({
      kind: "box",
      center: [colX(s), 150 + slide(s), h / 2],
      half: [CW / 2, CW / 2, h / 2],
      pal: P,
      fade: sf,
      edges: [0, 0, 1],
    });
  }

  const x = ballX(s);
  const z = s < S0 ? H + BR : s < CATCH ? fallZ(s) : s < UP ? lift(s) + BR : H + BR;
  items.push({
    kind: "ball",
    center: [x, 150, z],
    r: BR,
    // Rolls against the row: still while it's carried, catching up as it rolls back.
    q: quat([0, 1, 0], (x - 150 + V * t) / BR),
  });
  return items;
}

export const careCatch: SceneDef = {
  labels: ["MONITORING", "FIXES", "SUPPORT"],
  duration: T,
  // The ball falling, the pink column nearly under it.
  posterTime: CATCH - 0.12,
  // The row runs well past the plane, and the pink column slides in from +y.
  floor: [-360, -60, 720, 480],
  frame,
};
