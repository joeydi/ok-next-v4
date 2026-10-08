import { P, W } from "../../primitives";
import { quat } from "../math";
import type { Item, SceneDef } from "../renderer";
import { bezier, track, wrap } from "../timeline";

// Website care, concept — two rings of low tiles, 8 and 16, round the pink
// ball. Every beat the ball dips and sends out a ping that lifts each ring in
// turn, blushing it pink, and dies away at the edge. Always watching. 2.4s loop.

const T = 2.4; // one ping (s)
const RINGS = [
  [8, 70],
  [16, 132],
] as const; // tiles per ring, and its radius (px)
const HALF = 20; // tile half-size (px)
const TH = 20; // resting tile height (px)
const A = 46; // ring height at the centre (px)
const V = 120; // ring speed (px/s)
const BR = 34; // ball radius (px)
const BZ = 150; // ball centre height at rest (px)
const DIP = 26; // how far the ball dips to ping (px)

// Each tile faces the middle.
const TILES = RINGS.flatMap(([n, d]) =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * (i + 0.5)) / n;
    return { x: 150 + d * Math.cos(a), y: 150 + d * Math.sin(a), d, q: quat([0, 0, 1], a) };
  }),
);
const REACH = RINGS.at(-1)![1];

// A tile's lift, by time since the ring reached it.
const ring = track([
  [0, 0, bezier(0.2, 0.8, 0.3, 1)],
  [0.18, 1, bezier(0.5, 0, 0.5, 1)],
  [0.7, 0],
]);
const dip = track([
  [0, 0, bezier(0.2, 0.8, 0.3, 1)],
  [0.12, 1, bezier(0.5, 0, 0.5, 1)],
  [0.7, 0],
]);

function frame(t: number): Item[] {
  const items: Item[] = TILES.map((p) => {
    // The ring leaves the ball as it bottoms out, and fades as it spreads.
    const lift = ring(wrap(t - 0.12 - p.d / V, T)) * (1 - (0.6 * p.d) / REACH);
    const h = TH + A * lift;
    return {
      kind: "box",
      center: [p.x, p.y, h / 2],
      half: [HALF, HALF, h / 2],
      q: p.q,
      pal: W,
      pal2: P,
      mix: Math.min(1, lift * 1.6),
      edges: [0, 0, 1],
    };
  });
  const s = wrap(t, T);
  items.push({
    kind: "ball",
    center: [150, 150, BZ - DIP * dip(s)],
    r: BR,
    // A full turn per loop, so it closes.
    q: quat([0, 0, 1], (2 * Math.PI * t) / T),
  });
  return items;
}

export const carePing: SceneDef = {
  labels: ["UPTIME", "SECURITY", "PERFORMANCE"],
  duration: T,
  // The ping just past the inner ring, reaching the outer.
  posterTime: 1.1,
  frame,
};
