import { P, W } from "../../primitives";
import { qmul, quat } from "../math";
import type { Item, SceneDef } from "../renderer";
import { easeInOut, track, wrap } from "../timeline";

// Tools for better work — a 3×3 grid of tall pillars around a pink hub. The
// outer eight rise and fall in a wave that rolls a pink icosphere around the
// ring. Same geometry and timing as Ring.tsx (1s).

const T = 9; // loop length (s)
const R = 95; // ball's orbit radius (px)
const A = 24; // wave amplitude (px)
const H = 200; // hub height (px)
const BR = R / 2; // ball radius (px)
const HO = H - BR; // outer pillars' resting height (px)
const ZB = HO - A + BR; // ball centre height (px)

// Each outer pillar's wave phase follows its angle around the ring.
const PILLARS = Array.from({ length: 9 }, (_, i) => {
  const c = i % 3, r = Math.floor(i / 3);
  const x = c - 1, y = r - 1;
  return { cx: 60 + c * 90, cy: 60 + r * 90, hub: !x && !y, phase: ((Math.atan2(y, x) / (2 * Math.PI) + 1) % 1) * T };
});

// okBar: resting-low → high → low, ease-in-out each way.
const wave = track([[0, HO - A, easeInOut], [T / 2, HO + A, easeInOut], [T, HO - A]]);

function pillars(height: (p: (typeof PILLARS)[number]) => number): Item[] {
  return PILLARS.map((p) => {
    const h = height(p);
    return { kind: "box", center: [p.cx, p.cy, h / 2], half: [32, 32, h / 2], pal: p.hub ? P : W, edges: [0, 0, 1] };
  });
}

/** Orbits once about the hub while rolling twice about X. */
function ball(t: number): Item {
  const a = (2 * Math.PI * t) / T;
  return {
    kind: "ball",
    center: [150 + R * Math.cos(a), 150 + R * Math.sin(a), ZB],
    r: BR,
    q: qmul(quat([0, 0, 1], a), quat([1, 0, 0], -2 * a)),
    edge: 0.015,
  };
}

export const ring: SceneDef = {
  labels: ["VISIBILITY", "AUTOMATION", "MONITORING"],
  duration: T,
  posterTime: 0,
  frame: (t) => [...pillars((p) => (p.hub ? H : wave(wrap(t - p.phase, T)))), ball(t)],
};
