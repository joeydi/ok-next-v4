import { P, W } from "../../primitives";
import type { Item, SceneDef } from "../renderer";
import { bezier, track, wrap } from "../timeline";

// Agencies — a tower of five slabs, the layers of a site. One
// layer at a time, a fresh pink slab slides in and pushes the old one out the
// far side; the layers above lift to let it through, settle, and the new slab
// cools from pink to paper once it's in. 11s loop.

const B = 2.2; // one update (s)
const ORDER = [1, 3, 0, 4, 2] as const; // which layer is swapped on each beat, bottom = 0
const T = ORDER.length * B; // loop length (s)
const SH = 14; // slab half-height (px)
const GAP = 8; // between slabs (px)
const HALF = 70; // slab half-size (px)
const PUSH = 2 * HALF + 40; // how far a swap moves the layer (px)
const LIFT = 10; // how far the layers above rise as it passes (px)
const MOVE = 0.35; // when the swap starts, into the beat (s)
const DUR = 1; // how long it takes (s)

const EASE_IO = bezier(0.65, 0, 0.35, 1);

const slide = track([
  [MOVE, 0, EASE_IO],
  [MOVE + DUR, 1],
]);
const lift = track([
  [MOVE - 0.1, 0, EASE_IO],
  [MOVE + 0.25, 1],
  [MOVE + DUR - 0.2, 1, bezier(0.3, 0, 0.6, 1.6)],
  [MOVE + DUR + 0.2, 0],
]);
// The new slab is pink as it arrives and cools once settled.
const cool = track([
  [MOVE + DUR + 0.3, 1, bezier(0.3, 0, 0.6, 1)],
  [B + MOVE + DUR, 0],
]);

const slab = (x: number, z: number, mix: number, fade = 1): Item => ({
  kind: "box",
  center: [x, 150, z],
  half: [HALF, HALF, SH],
  pal: W,
  pal2: P,
  mix,
  fade,
  edges: [0, 0, 1],
});

function frame(t: number): Item[] {
  const s = wrap(t, T),
    k = Math.floor(s / B),
    u = s - k * B;
  const layer = ORDER[k],
    prev = ORDER[(k + ORDER.length - 1) % ORDER.length];
  const p = slide(u),
    up = lift(u) * LIFT;
  const items: Item[] = [];
  for (let i = 0; i < ORDER.length; i++) {
    const z = SH + i * (2 * SH + GAP) + (i > layer ? up : 0);
    if (i === layer) {
      // Old slab out along +x, new one in from −x, the two moving as one.
      items.push(slab(150 + PUSH * p, z, 0, 1 - Math.max(0, p - 0.6) / 0.4));
      items.push(slab(150 - PUSH * (1 - p), z, cool(u), Math.min(1, p / 0.4)));
    } else {
      // The last beat's slab is still cooling.
      items.push(slab(150, z, i === prev ? cool(u + B) : 0));
    }
  }
  return items;
}

export const careStack: SceneDef = {
  labels: ["OVERFLOW", "SPECIAL BUILDS", "AFTER LAUNCH"],
  duration: T,
  // Mid-swap: both slabs half in, the layers above lifted.
  posterTime: 0.85,
  floor: [-120, -60, 420, 360],
  frame,
};
