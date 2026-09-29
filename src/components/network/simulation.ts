// The /network animation, first written with Paper.js for the old site. Each node
// wanders (Reynolds steering: it seeks a point that jitters on a small circle
// projected ahead of it), wraps at the edges, and any two nodes closer than
// MAX_LENGTH are joined by a line that fades as they part. Nodes also steer out of
// `avoid` rects (the quote), so they gather around the text, and the pointer pulls
// nearby nodes onto a ring around itself. Positions are CSS px.

/** One tick of the simulation, s. The motion was tuned per frame at 60fps. */
export const STEP = 1 / 60;

/** Nodes per px² of free canvas (outside the avoid rects): 600 felt right at 1920×1280. */
const DENSITY = 480 / 1_800_000;
const MIN_NODES = 20;
/** The pair search is O(n²), so very large screens stop here. */
const MAX_NODES = 1000;
const SPEED = 0.25;
const MIN_RADIUS = 2;
const MAX_RADIUS = 4;
const MAX_LENGTH = 120;
const MAX_FORCE = 0.4;
/** How far past the edge a node travels before wrapping, so it never pops. */
const OFFSET = 20;
const WANDER_RADIUS = 5;
const WANDER_DISTANCE = 100;
const WANDER_CHANGE = 0.4;
/** Nodes arrive one at a time, this far apart (s), each fading in over FADE_IN. New ones arrive the same way after a resize. */
const ARRIVAL = 0.01;
const FADE_IN = 0.4;
const LINE_RADIUS = 0.5;
/** The push out of an avoid rect. It turns a node's heading rather than shoving it. */
const AVOID_FORCE = 0.01;
/** Inside a rect, the push builds to full strength over this distance from its edge (px). */
const AVOID_MARGIN = 40;
/** Tries at placing a node outside the avoid rects before settling for anywhere. */
const PLACE_TRIES = 10;
/** Nodes within this distance of the pointer (px) are pulled toward a ring of RING_RADIUS around it. */
const PULL_RADIUS = 240;
const RING_RADIUS = 64;
/** The pull per px off the ring, per step, up to MAX_PULL (px per step). */
const PULL_STIFFNESS = 0.12;
const MAX_PULL = 6;
/** Pulled nodes also circle the pointer (px per step), so a moving pointer doesn't pile them up behind it. */
const ORBIT = 1;
/** Nodes the pointer pulls keep this far apart (px), spreading them around the ring. */
const SPACING = 16;
/** Passes at SPACING per step; one can't keep up with the pull. */
const SPREAD_PASSES = 2;

/** Floats per instance: x0, y0, x1, y1, radius, alpha. A node is a zero-length segment. */
export const STRIDE = 6;
/** Room for far more lines than the density makes (about 8 per node); any past it are skipped. */
const MAX_LINES = MAX_NODES * 40;
export const MAX_INSTANCES = MAX_LINES + MAX_NODES;

/** x0, y0, x1, y1 in canvas px. */
export type Rect = [x0: number, y0: number, x1: number, y1: number];

export type Network = {
  width: number;
  height: number;
  avoid: Rect[];
  /** Where the pointer is over the canvas, if it is. */
  pointer: [x: number, y: number] | null;
  /** Live nodes: the first `count` slots of each array. */
  count: number;
  /** Whether new nodes arrive one by one, or all at once (for a still frame). */
  stagger: boolean;
  /** When each node arrives (s, on the simulation clock). */
  born: Float32Array;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  theta: Float32Array;
  maxSpeed: Float32Array;
  radius: Float32Array;
};

const between = (min: number, max: number) => Math.random() * (max - min) + min;

const inside = (rects: Rect[], px: number, py: number) =>
  rects.some(([x0, y0, x1, y1]) => px >= x0 && px <= x1 && py >= y0 && py <= y1);

export function createNetwork(width: number, height: number, avoid: Rect[], stagger: boolean): Network {
  const n: Network = {
    width,
    height,
    avoid,
    pointer: null,
    count: 0,
    stagger,
    born: new Float32Array(MAX_NODES),
    x: new Float32Array(MAX_NODES),
    y: new Float32Array(MAX_NODES),
    vx: new Float32Array(MAX_NODES),
    vy: new Float32Array(MAX_NODES),
    theta: new Float32Array(MAX_NODES),
    maxSpeed: new Float32Array(MAX_NODES),
    radius: new Float32Array(MAX_NODES),
  };
  resize(n, width, height, avoid, 0);
  return n;
}

/** Sets the canvas size and avoid rects, adding or dropping nodes to keep the density. */
export function resize(n: Network, width: number, height: number, avoid: Rect[], clock: number) {
  Object.assign(n, { width, height, avoid });

  // Free area: the canvas less the part of each rect inside it.
  const covered = avoid.reduce(
    (sum, [x0, y0, x1, y1]) =>
      sum + Math.max(0, Math.min(x1, width) - Math.max(x0, 0)) * Math.max(0, Math.min(y1, height) - Math.max(y0, 0)),
    0,
  );
  const target = Math.min(MAX_NODES, Math.max(MIN_NODES, Math.round((width * height - covered) * DENSITY)));

  for (let i = n.count; i < target; i += 1) {
    place(n, i, n.stagger ? clock + (i - n.count) * ARRIVAL : clock - FADE_IN);
  }
  n.count = target;
}

/** Starts node `i` somewhere outside the avoid rects, heading anywhere. */
function place(n: Network, i: number, born: number) {
  const heading = between(0, Math.PI * 2);
  n.born[i] = born;
  n.maxSpeed[i] = between(SPEED, SPEED * 2);
  for (let t = 0; t < PLACE_TRIES && (t === 0 || inside(n.avoid, n.x[i], n.y[i])); t += 1) {
    n.x[i] = between(-OFFSET, n.width + OFFSET);
    n.y[i] = between(-OFFSET, n.height + OFFSET);
  }
  n.vx[i] = Math.cos(heading) * n.maxSpeed[i];
  n.vy[i] = Math.sin(heading) * n.maxSpeed[i];
  n.theta[i] = 0;
  n.radius[i] = Math.floor(between(MIN_RADIUS, MAX_RADIUS + 1));
}

/**
 * The push out of the avoid rects at (px, py), as a direction weighted 0–1: toward
 * the nearest edge, building from nothing at the edge to full strength AVOID_MARGIN
 * inside it, so nodes can drift over a rect's edges before turning back.
 */
function avoidance(rects: Rect[], px: number, py: number): [number, number] {
  let ax = 0;
  let ay = 0;

  for (const [x0, y0, x1, y1] of rects) {
    const left = px - x0;
    const right = x1 - px;
    const top = py - y0;
    const bottom = y1 - py;
    const edge = Math.min(left, right, top, bottom);
    if (edge <= 0) continue;

    const weight = Math.min(1, edge / AVOID_MARGIN);
    if (edge === left) ax -= weight;
    else if (edge === right) ax += weight;
    else if (edge === top) ay -= weight;
    else ay += weight;
  }

  return [ax, ay];
}

/**
 * How far to move a node at (px, py) toward the pointer's ring this step: a spring
 * toward the ring, at full strength out to RING_RADIUS from it and fading to nothing
 * at PULL_RADIUS, plus a drift around the pointer. It moves the node without touching
 * its velocity, so the node keeps wandering and slides around the ring rather than
 * sticking in place.
 */
function pull(pointer: Network["pointer"], px: number, py: number): [number, number] {
  if (!pointer) return [0, 0];
  const dx = px - pointer[0];
  const dy = py - pointer[1];
  const d = Math.hypot(dx, dy);
  if (d >= PULL_RADIUS || d === 0) return [0, 0];

  const weight = Math.min(1, (PULL_RADIUS - d) / (PULL_RADIUS - 2 * RING_RADIUS));
  const toRing = Math.min(MAX_PULL, Math.max(-MAX_PULL, (RING_RADIUS - d) * PULL_STIFFNESS)) * weight;
  const around = ORBIT * weight;
  return [(dx * toRing - dy * around) / d, (dy * toRing + dx * around) / d];
}

/** Indices of the nodes in the pointer's reach, reused each step. */
const pulled = new Int32Array(MAX_NODES);

/** Nudges apart any two pulled nodes closer than SPACING, half each. */
function spread(n: Network, count: number) {
  const { x, y } = n;
  for (let pass = 0; pass < SPREAD_PASSES; pass += 1) {
    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        const i = pulled[a];
        const j = pulled[b];
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const d = Math.hypot(dx, dy);
        if (d >= SPACING || d === 0) continue;
        const push = (SPACING - d) / d / 2;
        x[i] -= dx * push;
        y[i] -= dy * push;
        x[j] += dx * push;
        y[j] += dy * push;
      }
    }
  }
}

/** Advances every node that has arrived by one STEP. */
export function step(n: Network, clock: number) {
  const { born, x, y, vx, vy, theta, maxSpeed, width, height, pointer } = n;
  let reached = 0;

  for (let i = 0; i < n.count; i += 1) {
    if (born[i] > clock) continue;
    theta[i] += between(-WANDER_CHANGE, WANDER_CHANGE);

    // The wander target, relative to the node: straight ahead, nudged around a small circle.
    const speed = Math.hypot(vx[i], vy[i]) || 1;
    const tx = (vx[i] / speed) * WANDER_DISTANCE + WANDER_RADIUS * Math.cos(theta[i]);
    const ty = (vy[i] / speed) * WANDER_DISTANCE + WANDER_RADIUS * Math.sin(theta[i]);
    const distance = Math.hypot(tx, ty) || 1;

    // Seek it: steer from the current velocity toward full speed at the target, within MAX_FORCE.
    let sx = (tx / distance) * maxSpeed[i] - vx[i];
    let sy = (ty / distance) * maxSpeed[i] - vy[i];
    const force = Math.hypot(sx, sy);
    if (force > MAX_FORCE) {
      sx *= MAX_FORCE / force;
      sy *= MAX_FORCE / force;
    }

    const [ax, ay] = avoidance(n.avoid, x[i], y[i]);

    vx[i] += sx + ax * AVOID_FORCE;
    vy[i] += sy + ay * AVOID_FORCE;
    const v = Math.hypot(vx[i], vy[i]);
    if (v > maxSpeed[i]) {
      vx[i] *= maxSpeed[i] / v;
      vy[i] *= maxSpeed[i] / v;
    }

    const [px, py] = pull(pointer, x[i], y[i]);
    if (px || py) pulled[reached++] = i;

    x[i] += vx[i] + px;
    y[i] += vy[i] + py;

    if (x[i] < -OFFSET) x[i] = width + OFFSET;
    else if (x[i] > width + OFFSET) x[i] = -OFFSET;
    if (y[i] < -OFFSET) y[i] = height + OFFSET;
    else if (y[i] > height + OFFSET) y[i] = -OFFSET;
  }

  spread(n, reached);
}

/** Writes the lines, then the nodes over them, into `out`; returns the instance count. */
export function instances(n: Network, clock: number, out: Float32Array) {
  const { born, x, y, radius, count } = n;
  const fade = (i: number) => Math.min(1, Math.max(0, (clock - born[i]) / FADE_IN));
  let k = 0;

  const push = (x0: number, y0: number, x1: number, y1: number, r: number, alpha: number) => {
    const o = k * STRIDE;
    out[o] = x0;
    out[o + 1] = y0;
    out[o + 2] = x1;
    out[o + 3] = y1;
    out[o + 4] = r;
    out[o + 5] = alpha;
    k += 1;
  };

  for (let i = 0; i < count && k < MAX_LINES; i += 1) {
    if (born[i] > clock) continue;
    for (let j = i + 1; j < count && k < MAX_LINES; j += 1) {
      if (born[j] > clock) continue;
      const length = Math.hypot(x[j] - x[i], y[j] - y[i]);
      if (length < MAX_LENGTH) {
        push(x[i], y[i], x[j], y[j], LINE_RADIUS, (1 - length / MAX_LENGTH) * Math.min(fade(i), fade(j)));
      }
    }
  }

  for (let i = 0; i < count; i += 1) if (born[i] <= clock) push(x[i], y[i], x[i], y[i], radius[i], fade(i));

  return k;
}
