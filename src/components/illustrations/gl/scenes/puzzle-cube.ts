import { cross, sub, type Vec } from "../../icosphere";
import { P, W } from "../../primitives";
import { Q0, qmul, qrot, quat, type Quat } from "../math";
import { projectVec, rayAt, rayBox } from "../pick";
import { hull, planeToCanvas, type BoxItem, type Player, type SceneDef } from "../renderer";
import { bezier } from "../timeline";

// Home — a 3×3×3 puzzle cube. Each horizontal layer turns 180° about Z, then the
// cube scrambles with four slice turns and plays them back in reverse until
// solved. Same moves and timing as the handoff's rubik(). Faces take their
// shade from the light, so tops stay light and sides shaded as cubes turn.
//
// On the page it's also a toy (play()): drag a cube sideways to turn its
// horizontal layer, up or down to turn a vertical slice, and let go to have
// the slice coast into the nearest quarter turn. Left alone for a few
// seconds, it undoes the turns until the pink layer is whole, then loops again.

type Axis = 0 | 1 | 2;
type Move = [axis: Axis, layer: number, dir: number];

const MOVES: Move[] = [[0, 1, 1], [1, -1, 1], [2, 1, -1], [0, -1, -1]]; // x+1, y−1, z+1, x−1
const SEQ: Move[] = [...MOVES, ...MOVES.slice().reverse().map(([a, l, d]): Move => [a, l, -d])];
const AXES: Vec[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

const T = 10.4; // loop length (s)
const HOLD = 3; // layer spins + pause before the scramble starts (s)
const TURN = 0.6; // each slice turn (s)
const STEP = (T - HOLD - TURN) / (SEQ.length - 1); // the last turn lands at T
const SPIN = 1.5; // each layer's 180° turn (s)
const EASE = bezier(0.76, 0, 0.24, 1);
const PITCH = 90; // cube spacing (px)
const HALF = 32; // cube half-size (px)
const CENTER: Vec = [150, 150, 122]; // the cube's middle; the bottom layer sits on the floor
const QUARTER = Math.PI / 2;

const IDLE = 3; // untouched this long (s), it starts undoing
const FRICTION = 5; // a throw coasts as if slowed by this (1/s): how far a flick carries
const SPRING = 6; // the critically damped spring that lands a slice on its quarter (rad/s)
const MAX_SPIN = 25; // fastest throw (rad/s)
const LOCK = 6; // pointer travel before a drag picks its slice (canvas px)
const UNDO = 6; // most time the undoing takes (s), however many turns there are

/** Plane → canvas, for picking and dragging. */
const VIEW = planeToCanvas({});

/** Quarter turn of cube (x, y, z) about `axis`, in lattice units. */
function turn([x, y, z]: Vec, axis: number, d: number): Vec {
  if (axis === 0) return d > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return d > 0 ? [z, y, -x] : [-z, y, x];
  return d > 0 ? [-y, x, z] : [y, -x, z];
}

const mod4 = (n: number) => ((n % 4) + 4) % 4;

/** Where a cube sits on the lattice and how it's turned, at rest. */
type Cubie = { pos: Vec; q: Quat; pink: boolean };

const solved = (): Cubie[] =>
  [-1, 0, 1].flatMap((k) => [-1, 0, 1].flatMap((j) => [-1, 0, 1].map((i) => ({ pos: [i, j, k] as Vec, q: Q0, pink: k === 0 }))));

/** Every pink cube back in the middle layer. White cubes look alike, as do turned ones. */
const isSolved = (cube: Cubie[]) => cube.every((c) => !c.pink || c.pos[2] === 0);

/** Lands `n` quarter turns of a slice. */
function commit(cube: Cubie[], axis: Axis, layer: number, n: number) {
  const k = mod4(n);
  if (!k) return;
  const r = quat(AXES[axis], k * QUARTER);
  for (const c of cube) {
    if (c.pos[axis] !== layer) continue;
    for (let i = 0; i < k; i++) c.pos = turn(c.pos, axis, 1);
    const q = qmul(r, c.q), len = Math.hypot(...q);
    c.q = [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
  }
}

/** A slice part way through a turn of `a` (rad). */
type Slice = { axis: Axis; layer: number; a: number };

function draw(cube: Cubie[], slices: Slice[]): BoxItem[] {
  return cube.map((c) => {
    const s = slices.find((s) => c.pos[s.axis] === s.layer);
    const r = s ? quat(AXES[s.axis], s.a) : Q0;
    const off = qrot(r, [c.pos[0] * PITCH, c.pos[1] * PITCH, c.pos[2] * PITCH]);
    return {
      kind: "box",
      center: [CENTER[0] + off[0], CENTER[1] + off[1], CENTER[2] + off[2]],
      half: [HALF, HALF, HALF],
      q: qmul(r, c.q),
      pal: c.pink ? P : W,
      edges: [1, 1, 1],
    };
  });
}

/** The loop as timed slice turns: the layer spins, top first, then the scramble and its reverse. */
type Event = { at: number; axis: Axis; layer: number; n: number; dur: number };

const SCRIPT: Event[] = [
  ...[1, 0, -1].map((k): Event => ({ at: 0.25 + (1 - k) * 0.15, axis: 2, layer: k, n: 2, dur: SPIN })),
  ...SEQ.map(([axis, layer, n], m): Event => ({ at: HOLD + m * STEP, axis, layer, n, dur: TURN })),
];

function frame(t: number) {
  const cube = solved(), slices: Slice[] = [];
  for (const e of SCRIPT) {
    const u = (t - e.at) / e.dur;
    if (u >= 1) commit(cube, e.axis, e.layer, e.n);
    else if (u > 0) slices.push({ axis: e.axis, layer: e.layer, a: e.n * QUARTER * EASE(u) });
  }
  return draw(cube, slices);
}

type Turn = Slice & {
  /** Angular velocity (rad/s). */
  v: number;
  /** `script` eases to `to` over `dur` (s), `el` in; `spring` settles on `target`; `held` follows the pointer. */
  mode: "script" | "spring" | "held";
  to: number;
  dur: number;
  el: number;
  target: number;
  /** A turn undoing a move popped off the history: the move's quarters, so landing it pushes only what's left. */
  base: number;
};

type Drag = {
  cubie: number;
  hit: Vec;
  /** The grabbed face's axis. */
  face: Axis;
  /** Where the angle is measured from, and the pointer now (canvas px). */
  x0: number;
  y0: number;
  x: number;
  y: number;
  axis?: Axis;
  turn?: Turn;
  a0: number;
  /** How far the grabbed point moves per radian (canvas px). */
  s: [number, number];
  /** It waited for turns on another axis to land, so it starts from where the pointer is then. */
  waited: boolean;
  samples: [t: number, a: number][];
};

/** Where the grabbed point moves on screen per radian of turn about `axis`. */
function tangent(axis: Axis, hit: Vec): [number, number] {
  let r = sub(hit, CENTER);
  r[axis] = 0;
  // Grabbed on the axis (the top face's middle): turn as if by the corner nearest the viewer.
  if (Math.hypot(...r) < PITCH / 2) {
    r = [-PITCH, PITCH, 0];
    r[axis] = 0;
  }
  return projectVec(VIEW, cross(AXES[axis], r));
}

function play(): Player {
  const cube = solved();
  const turns: Turn[] = [];
  /** Quarter turns since the cube was last solved, merged where they can be (n = 1–3). */
  let history: { axis: Axis; layer: number; n: number }[] = [];
  let mode: "auto" | "user" | "restore" = "auto";
  let clock = puzzleCube.posterTime, next = 0;
  let time = 0, last = -1, idleSince = 0, undoDur = 0.5;
  let drag: Drag | null = null;
  let items = draw(cube, turns);

  function push(axis: Axis, layer: number, n: number) {
    n = mod4(n);
    if (!n) return;
    // Same-axis turns commute, so a turn joins its layer's anywhere in the trailing run on that axis.
    for (let i = history.length - 1; i >= 0 && history[i].axis === axis; i--) {
      if (history[i].layer !== layer) continue;
      const m = mod4(history[i].n + n);
      if (m) history[i].n = m;
      else history.splice(i, 1);
      return;
    }
    history.push({ axis, layer, n });
  }

  function land(t: Turn) {
    const n = Math.round(t.a / QUARTER);
    commit(cube, t.axis, t.layer, n);
    push(t.axis, t.layer, t.base + n);
    turns.splice(turns.indexOf(t), 1);
    if (isSolved(cube)) history = [];
  }

  function release(t: Turn, v: number) {
    t.mode = "spring";
    t.v = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, v));
    t.target = Math.round((t.a + t.v / FRICTION) / QUARTER) * QUARTER;
  }

  function start(axis: Axis, layer: number, to: number, dur: number, el: number, base = 0) {
    turns.push({ axis, layer, a: to * EASE(el / dur), v: 0, mode: "script", to, dur, el, target: 0, base });
  }

  function step(dt: number) {
    for (const t of turns.slice()) {
      if (t.mode === "script") {
        t.el += dt;
        if (t.el >= t.dur) {
          t.a = t.to;
          land(t);
        } else t.a = t.to * EASE(t.el / t.dur);
      } else if (t.mode === "spring") {
        for (let i = 0, h = dt / 4; i < 4; i++) {
          t.v += (-SPRING * SPRING * (t.a - t.target) - 2 * SPRING * t.v) * h;
          t.a += t.v * h;
        }
        if (Math.abs(t.a - t.target) < 1e-3 && Math.abs(t.v) < 0.05) {
          t.a = t.target;
          land(t);
        }
      }
    }
  }

  /** Runs the loop's clock, starting its turns as they come up. */
  function advance(dt: number) {
    clock += dt;
    for (;;) {
      while (next < SCRIPT.length && SCRIPT[next].at <= clock) {
        const e = SCRIPT[next++];
        start(e.axis, e.layer, e.n * QUARTER, e.dur, clock - e.at);
      }
      if (clock < T) break;
      clock -= T;
      next = 0;
    }
  }

  /** Undoes the latest move, or once solved, starts the loop over. */
  function undoNext() {
    const m = history.pop();
    if (!m) {
      mode = "auto";
      clock = next = 0;
      return;
    }
    start(m.axis, m.layer, (m.n === 1 ? -1 : m.n === 3 ? 1 : 2) * QUARTER, undoDur * (m.n === 2 ? 1.4 : 1), 0, m.n);
  }

  /** The drag's slice, once turns on any other axis have landed. */
  function grab(d: Drag) {
    if (d.axis === undefined || d.turn) return;
    const axis = d.axis;
    if (turns.some((t) => t.axis !== axis)) {
      d.waited = true;
      return;
    }
    const layer = cube[d.cubie].pos[axis];
    let t = turns.find((t) => t.axis === axis && t.layer === layer);
    if (!t) turns.push((t = { axis, layer, a: 0, v: 0, mode: "held", to: 0, dur: 0, el: 0, target: 0, base: 0 }));
    t.mode = "held";
    d.turn = t;
    d.a0 = t.a;
    d.s = tangent(axis, d.hit);
    if (d.waited) [d.x0, d.y0] = [d.x, d.y];
  }

  function follow(d: Drag, now: number) {
    if (!d.turn) return;
    const [sx, sy] = d.s;
    d.turn.a = d.a0 + ((d.x - d.x0) * sx + (d.y - d.y0) * sy) / (sx * sx + sy * sy);
    d.samples.push([now, d.turn.a]);
    while (d.samples[0][0] < now - 0.1) d.samples.shift();
  }

  function pick(x: number, y: number) {
    const ray = rayAt(VIEW, x, y);
    let i = -1, t = Infinity, normal: Vec = [0, 0, 1];
    for (let j = 0; j < items.length; j++) {
      const it = items[j], h = rayBox(ray, it.center, it.half, it.q ?? Q0);
      if (h && h.t < t) [i, t, normal] = [j, h.t, h.normal];
    }
    if (i < 0) return null;
    const abs = normal.map(Math.abs);
    return {
      i,
      hit: [ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t] as Vec,
      face: abs.indexOf(Math.max(...abs)) as Axis,
    };
  }

  return {
    frame(now) {
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, now - last));
      last = now;
      time += dt;
      step(dt);
      if (mode === "auto") advance(dt);
      if (drag) grab(drag);
      if (mode === "user") {
        if (drag || turns.length) idleSince = time;
        else if (time - idleSince > IDLE) {
          mode = "restore";
          undoDur = Math.min(0.5, Math.max(0.25, UNDO / history.length));
        }
      }
      if (mode === "restore" && !turns.length) undoNext();
      return (items = draw(cube, turns));
    },

    down(x, y) {
      if (drag) return false;
      const p = pick(x, y);
      if (!p) return false;
      // Hands on: the loop (or the undoing) stops, and whatever's turning coasts into place.
      if (mode !== "user") {
        mode = "user";
        for (const t of turns) {
          if (t.mode !== "script") continue;
          const u = t.el / t.dur, e = 1e-3;
          release(t, (t.to * (EASE(Math.min(1, u + e)) - EASE(u))) / (e * t.dur));
        }
      }
      drag = { cubie: p.i, hit: p.hit, face: p.face, x0: x, y0: y, x, y, a0: 0, s: [1, 0], waited: false, samples: [] };
      return true;
    },

    move(x, y, now) {
      const d = drag;
      if (!d) return;
      [d.x, d.y] = [x, y];
      if (d.axis === undefined) {
        const dx = x - d.x0, dy = y - d.y0;
        if (Math.hypot(dx, dy) < LOCK) return;
        // Sideways turns the horizontal layer. Up or down turns the vertical slice
        // the grabbed face belongs to; on the top face, the one moving most along the drag.
        const along = (a: Axis) => {
          const [sx, sy] = tangent(a, d.hit);
          return Math.abs(sx * dx + sy * dy) / Math.hypot(sx, sy);
        };
        d.axis = Math.abs(dx) >= Math.abs(dy) ? 2 : d.face === 0 ? 1 : d.face === 1 ? 0 : along(0) >= along(1) ? 0 : 1;
        grab(d);
      }
      follow(d, now);
    },

    up(now) {
      const d = drag;
      drag = null;
      if (!d?.turn) return;
      const s = d.samples.filter(([t]) => t >= now - 0.08);
      const dt = s.length > 1 ? s[s.length - 1][0] - s[0][0] : 0;
      release(d.turn, dt > 0 ? (s[s.length - 1][1] - s[0][1]) / dt : 0);
    },

    hover: (x, y) => pick(x, y) !== null,
  };
}

/** The solved cube's outline on the canvas, a little larger for slices turned out of line. */
function outline(): [number, number][] {
  const R = PITCH + HALF, PAD = 12;
  const corners = [-1, 1].flatMap((x) =>
    [-1, 1].flatMap((y) =>
      [-1, 1].map((z): [number, number] => {
        const [cx, cy] = projectVec(VIEW, [CENTER[0] + x * R, CENTER[1] + y * R, CENTER[2] + z * R]);
        return [cx + VIEW[12], cy + VIEW[13]];
      }),
    ),
  );
  const h = hull(corners);
  const mx = h.reduce((s, p) => s + p[0], 0) / h.length, my = h.reduce((s, p) => s + p[1], 0) / h.length;
  return h.map(([x, y]) => {
    const l = Math.hypot(x - mx, y - my);
    return [+(x + ((x - mx) / l) * PAD).toFixed(1), +(y + ((y - my) / l) * PAD).toFixed(1)];
  });
}

export const puzzleCube: SceneDef = {
  labels: ["MARKETERS", "ORGANIZATIONS", "TEAMS"],
  duration: T,
  posterTime: 0,
  frame,
  play,
  hitArea: outline(),
};
