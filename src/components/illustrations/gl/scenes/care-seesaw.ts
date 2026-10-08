import { W } from "../../primitives";
import { qmul, qrot, quat } from "../math";
import type { Item, SceneDef } from "../renderer";
import { bezier, track, wrap } from "../timeline";

// Website care, concept — a plank balanced on a post on a plinth, with the pink ball at
// one end. The plank tips, the ball rolls the length of it and knocks it back
// the other way, then rolls home. Kept running, kept moving. 6s loop.

const T = 6; // loop length (s)
const PZ = 140; // pivot height (px)
const BASE = 16; // plinth height (px)
const PL = 170; // plank half-length (px)
const PT = 8; // plank half-thickness (px)
const BR = 30; // ball radius (px)
const S = PL - BR - 6; // how far along the plank the ball stops (px)
const A = 0.28; // tilt (rad)

const EASE_IO = bezier(0.45, 0, 0.55, 1);
const ROLL = bezier(0.55, 0, 0.45, 1);
const SETTLE = bezier(0.3, 0, 0.6, 1);

// Rotation about +y: positive dips the +x end. The ball lands and pushes it a touch further.
const tilt = track([
  [0.15, -A, EASE_IO],
  [0.75, A],
  [2.45, A, SETTLE],
  [2.6, A * 1.3, EASE_IO],
  [2.9, A],
  [3.15, A, EASE_IO],
  [3.75, -A],
  [5.45, -A, SETTLE],
  [5.6, -A * 1.3, EASE_IO],
  [5.9, -A],
]);
const along = track([
  [0.55, -S, ROLL],
  [2.45, S],
  [3.55, S, ROLL],
  [5.45, -S],
]);

function frame(t: number): Item[] {
  const s = wrap(t, T),
    q = quat([0, 1, 0], tilt(s)),
    x = along(s);
  const [bx, by, bz] = qrot(q, [x, 0, PT + BR]);
  return [
    { kind: "box", center: [150, 150, BASE / 2], half: [64, 64, BASE / 2], pal: W, edges: [0, 0, 1] },
    {
      kind: "box",
      center: [150, 150, (BASE + PZ - PT - 4) / 2],
      half: [20, 20, (PZ - PT - 4 - BASE) / 2],
      pal: W,
      edges: [0, 0, 1],
    },
    { kind: "box", center: [150, 150, PZ], half: [PL, 36, PT], q, pal: W, edges: [0, 0, 1] },
    {
      kind: "ball",
      center: [150 + bx, 150 + by, PZ + bz],
      r: BR,
      // Rolls without slipping, on the plank's tilt.
      q: qmul(q, quat([0, 1, 0], x / BR)),
    },
  ];
}

export const careSeesaw: SceneDef = {
  labels: ["MAINTENANCE", "HOURS", "BALANCE"],
  duration: T,
  // The ball halfway down the plank.
  posterTime: 1.5,
  floor: [-120, -60, 420, 360],
  frame,
};
