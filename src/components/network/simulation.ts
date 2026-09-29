// The /network animation, first written with Paper.js for the old site. Each node
// wanders (Reynolds steering: it seeks a point that jitters on a small circle
// projected ahead of it), wraps at the edges, and any two nodes closer than
// MAX_LENGTH are joined by a line that fades as they part. Positions are CSS px.

/** One tick of the simulation, s. The motion was tuned per frame at 60fps. */
export const STEP = 1 / 60;

const NODE_COUNT = 60;
const SPEED = 0.125;
const MIN_RADIUS = 2;
const MAX_RADIUS = 4;
const MAX_LENGTH = 120;
const MAX_FORCE = 0.4;
/** How far past the edge a node travels before wrapping, so it never pops. */
const OFFSET = 20;
const WANDER_RADIUS = 5;
const WANDER_DISTANCE = 100;
const WANDER_CHANGE = 0.4;
/** Nodes arrive one at a time, this far apart (s), each fading in over FADE_IN. */
const ARRIVAL = 0.1;
const FADE_IN = 0.4;
const LINE_RADIUS = 0.5;

/** By the time every node has arrived and faded in (s). */
export const SETTLED = NODE_COUNT * ARRIVAL + FADE_IN;

/** Floats per instance: x0, y0, x1, y1, radius, alpha. A node is a zero-length segment. */
export const STRIDE = 6;
export const MAX_INSTANCES = (NODE_COUNT * (NODE_COUNT - 1)) / 2 + NODE_COUNT;

export type Network = {
  width: number;
  height: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  theta: Float32Array;
  maxSpeed: Float32Array;
  radius: Float32Array;
};

const between = (min: number, max: number) => Math.random() * (max - min) + min;

export function createNetwork(width: number, height: number): Network {
  const n: Network = {
    width,
    height,
    x: new Float32Array(NODE_COUNT),
    y: new Float32Array(NODE_COUNT),
    vx: new Float32Array(NODE_COUNT),
    vy: new Float32Array(NODE_COUNT),
    theta: new Float32Array(NODE_COUNT),
    maxSpeed: new Float32Array(NODE_COUNT),
    radius: new Float32Array(NODE_COUNT),
  };

  for (let i = 0; i < NODE_COUNT; i += 1) {
    const heading = between(0, Math.PI * 2);
    n.maxSpeed[i] = between(SPEED, SPEED * 2);
    n.x[i] = between(-OFFSET, width + OFFSET);
    n.y[i] = between(-OFFSET, height + OFFSET);
    n.vx[i] = Math.cos(heading) * n.maxSpeed[i];
    n.vy[i] = Math.sin(heading) * n.maxSpeed[i];
    n.radius[i] = Math.floor(between(MIN_RADIUS, MAX_RADIUS + 1));
  }

  return n;
}

/** How many nodes have arrived at `clock` (s). */
const arrived = (clock: number) => Math.min(NODE_COUNT, Math.floor(clock / ARRIVAL) + 1);

/** Advances every node that has arrived by one STEP. */
export function step(n: Network, clock: number) {
  const { x, y, vx, vy, theta, maxSpeed, width, height } = n;

  for (let i = 0, count = arrived(clock); i < count; i += 1) {
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

    vx[i] += sx;
    vy[i] += sy;
    const v = Math.hypot(vx[i], vy[i]);
    if (v > maxSpeed[i]) {
      vx[i] *= maxSpeed[i] / v;
      vy[i] *= maxSpeed[i] / v;
    }

    x[i] += vx[i];
    y[i] += vy[i];

    if (x[i] < -OFFSET) x[i] = width + OFFSET;
    else if (x[i] > width + OFFSET) x[i] = -OFFSET;
    if (y[i] < -OFFSET) y[i] = height + OFFSET;
    else if (y[i] > height + OFFSET) y[i] = -OFFSET;
  }
}

/** Writes the lines, then the nodes over them, into `out`; returns the instance count. */
export function instances(n: Network, clock: number, out: Float32Array) {
  const { x, y, radius } = n;
  const count = arrived(clock);
  const fade = (i: number) => Math.min(1, Math.max(0, (clock - i * ARRIVAL) / FADE_IN));
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

  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const length = Math.hypot(x[j] - x[i], y[j] - y[i]);
      if (length < MAX_LENGTH) {
        push(x[i], y[i], x[j], y[j], LINE_RADIUS, (1 - length / MAX_LENGTH) * Math.min(fade(i), fade(j)));
      }
    }
  }

  for (let i = 0; i < count; i += 1) push(x[i], y[i], x[i], y[i], radius[i], fade(i));

  return k;
}
