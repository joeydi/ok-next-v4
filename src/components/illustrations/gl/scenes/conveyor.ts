import { N, P, W } from "../../primitives";
import { mul, scale, translate } from "../math";
import type { Item, SceneDef } from "../renderer";
import { bezier, track, wrap } from "../timeline";

// CMS & integrations — five platforms ride a continuous conveyor along the iso
// diagonal. Each fades in and rises out of the floor with its tiles popping on
// one by one, passes the old platform just as a pink tile hops across into its
// gap, then travels half a step further before sinking back and fading out.
// The scene is zoomed to 125% and shifted left. 7.5s loop, platforms offset by
// 1.5s. Same timing as the handoff's c8() (1v).

const T = 7.5; // loop length (s)
const STAGGER = 1.5; // gap between platforms (s)
const SPEED = 80; // conveyor speed (px/s)
const RISE = 0.85; // when a platform starts to rise (s)
const LAND = 3.75; // when the hopping tile lands in the gap (s)
const STOP = 6.75; // when a platform stops at the end of the belt, sunk (s)
const PH = 40; // platform height (px)
const TILE = 36; // tile size (px)
const TH = 14; // tile height (px)
const HOP = 110; // hop height (px)
const GAP = 170; // hop distance, old platform to new (px)

const SLOTS = [[10, 10], [54, 10], [10, 54], [54, 54]] as const;
// Which slot is missing on each of the five platforms.
const MISSING = [0, 1, 3, 2, 1] as const;

const EASE_OUT = bezier(0.2, 0.8, 0.3, 1);
const EASE_IN = bezier(0.7, 0, 0.8, 0.2);
const EASE_IO = bezier(0.45, 0, 0.55, 1);

// Per platform, by time into its loop.
const rise = track([[RISE, 0, EASE_OUT], [RISE + 0.6, 1], [6.15, 1, EASE_IO], [STOP, 0]]);
const fade = track([[RISE, 0], [RISE + 0.25, 1], [6.5, 1], [STOP, 0]]);
// Each tile pops on in turn; the missing one appears the instant the hop lands.
const TILES = MISSING.map((miss) =>
  SLOTS.map((_, k) => {
    const out = 5.7 + k * 0.12;
    if (k === miss) return track([[LAND - 0.01, 0], [LAND, 1], [out, 1, EASE_IN], [out + 0.3, 0]]);
    const pop = RISE + 0.25 + (k - (k > miss ? 1 : 0)) * 0.14;
    return track([[pop, 0, EASE_OUT], [pop + 0.3, 1], [out, 1, EASE_IN], [out + 0.3, 0]]);
  }),
);
// The hopping tile: pops on the old platform, arcs across, and hands over to the gap tile on landing.
const hopScale = track([[0.75, 0, EASE_OUT], [1.05, 1], [LAND, 1], [LAND + 0.01, 0]]);
const hopZ = track([[2.8, 0, bezier(0.33, 0.66, 0.66, 1)], [3.275, HOP, bezier(0.33, 0, 0.66, 0.33)], [LAND, 0]]);
const hopX = track([[2.8, 0, bezier(0.4, 0, 0.6, 1)], [LAND, GAP]]);

/** A tile scaled by `s` about its bottom centre. */
const tile = (x: number, y: number, z: number, s: number, zScale = 1): Item => ({
  kind: "box",
  center: [x, y, z + (TH * s * zScale) / 2],
  half: [(TILE * s) / 2, (TILE * s) / 2, (TH * s * zScale) / 2],
  pal: P,
  edges: [0, 0, 1],
});

function frame(t: number): Item[] {
  // The old platform, where tiles hop from.
  const items: Item[] = [{ kind: "box", center: [65, 150, PH / 2], half: [50, 50, PH / 2], pal: N, edges: [0, 0, 1] }];
  MISSING.forEach((miss, j) => {
    const s = wrap(t + j * STAGGER, T);
    const y = 300 - SPEED * Math.min(s, STOP); // belt offset
    const r = rise(s);
    if (r > 0.005) {
      items.push({ kind: "box", center: [235, 150 + y, (PH * r) / 2], half: [50, 50, (PH * r) / 2], pal: W, fade: fade(s), edges: [0, 0, 1] });
      SLOTS.forEach(([sx, sy], k) => {
        const sc = TILES[j][k](s);
        if (sc > 0.01) items.push(tile(185 + sx + TILE / 2, 100 + y + sy + TILE / 2, PH * r, sc, r));
      });
    }
    const hs = hopScale(s);
    if (hs > 0.01) {
      const [sx, sy] = SLOTS[miss];
      items.push(tile(15 + sx + TILE / 2 + hopX(s), 100 + sy + TILE / 2, PH + hopZ(s), hs));
    }
  });
  return items;
}

export const conveyor: SceneDef = {
  labels: ["CONTENT", "INTEGRATIONS", "PLATFORM"],
  duration: T,
  // Mid-hop: the moment that explains the scene.
  posterTime: 3.2,
  pre: mul(translate(-60, 0, 0), scale(1.25)),
  // The belt runs along y; this covers where platforms are up, plus AO reach.
  floor: [-120, -300, 420, 600],
  frame,
};
