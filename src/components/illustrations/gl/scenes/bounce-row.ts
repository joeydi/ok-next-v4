import { P, W } from "../../primitives";
import { quat } from "../math";
import type { Item, SceneDef } from "../renderer";
import { bezier, track, wrap } from "../timeline";

// Creative production — a row of columns slides from top right to bottom left
// under a spinning pink ball. Each column fades in and rises out of the ground
// as it approaches, springs up and flashes pink as it reaches the centre,
// bouncing the ball back into the air, then sinks and fades out as it moves
// on. Same timing as the handoff's t8(motion, smooth) (1u).

const TS = 1.5; // one column passes the centre every TS (s), and the ball bounces once
const N = 13; // columns in the row
const TC = N * TS; // loop length for one column (s)
const PITCH = 144; // column spacing (px)
const CW = 114; // column width (px)
const V = PITCH / TS; // row speed (px/s)
const X0 = 150 + 6 * PITCH; // a column's x at the start of its loop (px)
const HIT = 6 * TS; // when a column reaches the centre (s into its loop)
const WALL = 100; // unscaled column height (px)
const BR = 66; // ball radius (px)
const Z0 = 170 + BR; // ball centre height at the bottom of its bounce: on a column 170px tall (px)
const JUMP = 110; // bounce height (px)
const SPIN = 6; // ball spin period (s)

const EASE_IN = bezier(0.5, 0, 1, 1);
const EASE_OUT = bezier(0.2, 0.8, 0.3, 1);
const EASE_IO = bezier(0.45, 0, 0.55, 1);
// Columns rise off the ground and settle (ease-out), then sink slowly and speed into it (ease-in).
const RISE = bezier(0, 0, 0.58, 1);
const SINK = bezier(0.42, 0, 1, 1);

// Per column, by time into its loop: height (× WALL), fade from paper, and the pink flash at the hit.
const height = track([
  [HIT - 3.5, 0, RISE],
  [HIT - 0.15, 1.1, EASE_IN],
  [HIT, 1.7, EASE_OUT],
  [HIT + 0.12, 2, EASE_IO],
  [HIT + 0.3, 1.8, EASE_IO],
  [HIT + 0.45, 1.88, EASE_IO],
  [HIT + 0.6, 1.85, SINK],
  [HIT + 3, 0],
]);
// Fades in over its first second of rising and out over its last second of sinking
// (the handoff's 0.25s fades happen while it's nearly flat).
const fade = track([[HIT - 3.5, 0], [HIT - 2.5, 1], [HIT + 2, 1], [HIT + 3, 0]]);
const flash = track([[HIT - 0.01, 0], [HIT, 1], [HIT + 0.1, 1, bezier(0.3, 0, 0.6, 1)], [HIT + 0.6, 0]]);

// The ball: up and back down once per column.
const bounce = track([[0, Z0, bezier(0.33, 0.66, 0.66, 1)], [TS / 2, Z0 + JUMP, bezier(0.33, 0, 0.66, 0.33)], [TS, Z0]]);

function frame(t: number): Item[] {
  const items: Item[] = [];
  for (let j = 0; j < N; j++) {
    const s = wrap(t + j * TS, TC);
    const h = height(s) * WALL, f = fade(s);
    if (h < 0.5 || f <= 0) continue;
    items.push({
      kind: "box",
      center: [X0 - V * s, 150, h / 2],
      half: [CW / 2, CW / 2, h / 2],
      pal: W,
      pal2: P,
      mix: flash(s),
      fade: f,
      groundFade: 0.75,
      edges: [0, 0, 1],
    });
  }
  items.push({ kind: "ball", center: [150, 150, bounce(wrap(t, TS))], r: BR, q: quat([0, 1, 0], (2 * Math.PI * t) / SPIN) });
  return items;
}

export const bounceRow: SceneDef = {
  labels: ["AGENCIES", "CAMPAIGNS", "REPORTING"],
  // Column, bounce and spin loops all line up every 78s.
  duration: 78,
  // The centre column at its hit, flashing pink under the ball.
  posterTime: 0,
  // The row runs well past the plane; this covers where columns are up, plus AO reach.
  floor: [-360, -60, 720, 360],
  frame,
};
