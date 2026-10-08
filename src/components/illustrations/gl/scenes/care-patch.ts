import { N, P, W } from "../../primitives";
import { quat, scale } from "../math";
import type { Item, SceneDef } from "../renderer";
import { bezier, track, wrap } from "../timeline";

// Website care, concept — a 3×3 grid of tiles. One at a time, a tile sags and
// dulls; the pink ball hops over to it, lands, and the tile springs back up
// with a pink flash. The ball tours the outer eight by knight's moves, so every
// hop is the same length and the tour closes on itself. Drawn at 120%. 16s loop.

const B = 2; // one patch (s)
const TOUR = [0, 5, 6, 1, 8, 3, 2, 7] as const; // knight's moves round the ring
const T = TOUR.length * B; // loop length (s)
const TH = 56; // tile height (px)
const SAG = 18; // a sagging tile's height (px)
const BR = 26; // ball radius (px)
const HOP = 130; // hop height above the higher end (px)
const SINK_AT = 0.1; // when the next tile starts to sag, into the beat (s)
const LIFT = 0.55; // when the ball takes off (s)
const LAND = 1.25; // when it lands and the tile springs (s)

const TILES = Array.from({ length: 9 }, (_, i) => ({ x: 60 + (i % 3) * 90, y: 60 + Math.floor(i / 3) * 90 }));

const EASE_IN = bezier(0.5, 0, 1, 1);
const EASE_OUT = bezier(0.2, 0.8, 0.3, 1);
const EASE_IO = bezier(0.45, 0, 0.55, 1);

// Per tile, by time since its beat began (the beat it's patched in).
const height = track([
  [SINK_AT, TH, EASE_IN],
  [SINK_AT + 0.4, SAG],
  [LAND, SAG, EASE_OUT],
  [LAND + 0.12, TH + 14, EASE_IO],
  [LAND + 0.32, TH - 4, EASE_IO],
  [LAND + 0.5, TH],
]);
const dull = track([
  [SINK_AT, 0],
  [SINK_AT + 0.4, 1],
  [LAND - 0.01, 1],
  [LAND, 0],
]);
const flash = track([
  [LAND - 0.01, 0],
  [LAND, 1],
  [LAND + 0.15, 1, bezier(0.3, 0, 0.6, 1)],
  [LAND + 0.8, 0],
]);
const hop = track([
  [LIFT, 0, EASE_IO],
  [LAND, 1],
]);

function frame(t: number): Item[] {
  const s = wrap(t, T),
    k = Math.floor(s / B),
    u = s - k * B;
  const at = TOUR[k],
    from = TOUR[(k + TOUR.length - 1) % TOUR.length];

  const heights = TILES.map(() => TH);
  const items: Item[] = TILES.map((p, i) => {
    const patched = i === at;
    const h = patched ? height(u) : TH;
    heights[i] = h;
    return {
      kind: "box",
      center: [p.x, p.y, h / 2],
      half: [38, 38, h / 2],
      pal: W,
      // Dulls toward N as it sags, then flashes pink as it's fixed.
      pal2: u >= LAND ? P : N,
      mix: patched ? (u >= LAND ? flash(u) : dull(u)) : 0,
      edges: [0, 0, 1],
    };
  });

  // The ball sits on the last tile it patched until it hops to this one.
  const h = hop(u),
    a = TILES[from],
    b = TILES[at];
  const z0 = TH + BR,
    z1 = heights[at] + BR;
  const arc = 4 * h * (1 - h) * HOP;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  items.push({
    kind: "ball",
    center: [a.x + dx * h, a.y + dy * h, z0 + (z1 - z0) * h + arc],
    r: BR,
    // One full roll per hop, about the axis across its path, so each hop ends where it began.
    q: quat([-dy, dx, 0], 2 * Math.PI * h),
  });
  return items;
}

export const carePatch: SceneDef = {
  labels: ["UPDATES", "FIXES", "SUPPORT"],
  duration: T,
  // Mid-hop, the tile below sagging and waiting.
  posterTime: 0.95,
  // A flat grid, so it's drawn larger to fill the frame like the others.
  pre: scale(1.2),
  frame,
};
