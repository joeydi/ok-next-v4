import type { Vec } from "../../icosphere";
import { P, W } from "../../primitives";
import { qmul, qrot, quat, type Quat } from "../math";
import type { Item, SceneDef } from "../renderer";
import { bezier, track } from "../timeline";

// Home — a 3×3×3 puzzle cube. Each horizontal layer turns 180° about Z, then the
// cube scrambles with four slice turns and plays them back in reverse until
// solved. Same moves and timing as the handoff's rubik(). Faces take their
// shade from the light, so tops stay light and sides shaded as cubes turn.

type Move = [axis: 0 | 1 | 2, layer: number, dir: number];

const MOVES: Move[] = [[0, 1, 1], [1, -1, 1], [2, 1, -1], [0, -1, -1]]; // x+1, y−1, z+1, x−1
const SEQ: Move[] = [...MOVES, ...MOVES.slice().reverse().map(([a, l, d]): Move => [a, l, -d])];
const AXES: Vec[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

const T = 10.4; // loop length (s)
const HOLD = 3.2; // layer spins + pause before the scramble starts (s)
const STEP = (T - HOLD) / SEQ.length; // one slice turn every STEP (s)
const TURN = 0.6; // each slice turn (s)
const SPIN = 1.3; // each layer's 180° turn (s)
const EASE = bezier(0.65, 0, 0.35, 1);
const PITCH = 90; // cube spacing (px)
const CENTER: Vec = [150, 150, 122]; // the cube's middle; the bottom layer sits on the floor

/** Quarter turn of cube (x, y, z) about `axis`, in lattice units. */
function turn([x, y, z]: Vec, axis: number, d: number): Vec {
  if (axis === 0) return d > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return d > 0 ? [z, y, -x] : [-z, y, x];
  return d > 0 ? [-y, x, z] : [y, -x, z];
}

const CUBES = [-1, 0, 1].flatMap((k) =>
  [-1, 0, 1].flatMap((j) =>
    [-1, 0, 1].map((i) => {
      // Where the cube is after its layer's 180° spin, then which slice turns carry it.
      let p: Vec = [-i, -j, k];
      const angles = SEQ.map(([a, l, d]) => {
        if (p[a] !== l) return 0;
        p = turn(p, a, d);
        return (d * Math.PI) / 2;
      });
      const start = 0.5 + (1 - k) * 0.3; // top layer spins first
      return { home: [i * PITCH, j * PITCH, k * PITCH] as Vec, pink: k === 0, angles, spin: track([[start, 0, EASE], [start + SPIN, Math.PI]]) };
    }),
  ),
);

/** 0 → 1 over slice turn m. */
const progress = (t: number, m: number) => EASE(Math.min(1, Math.max(0, (t - HOLD - m * STEP) / TURN)));

function frame(t: number): Item[] {
  return CUBES.map((c) => {
    // Spin first, then each slice turn in order, all about the cube's middle.
    let q: Quat = quat([0, 0, 1], c.spin(t));
    c.angles.forEach((a, m) => {
      if (a) q = qmul(quat(AXES[SEQ[m][0]], a * progress(t, m)), q);
    });
    const off = qrot(q, c.home);
    return {
      kind: "box",
      center: [CENTER[0] + off[0], CENTER[1] + off[1], CENTER[2] + off[2]],
      half: [32, 32, 32],
      q,
      pal: c.pink ? P : W,
      edges: [1, 1, 1],
    };
  });
}

export const puzzleCube: SceneDef = {
  labels: ["MARKETERS", "ORGANIZATIONS", "TEAMS"],
  guideEnd: 620,
  duration: T,
  posterTime: 0,
  frame,
};
