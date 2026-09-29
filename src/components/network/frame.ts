import { createNetwork, instances, MAX_INSTANCES, type Rect, STEP, STRIDE, step } from "./simulation";

// A still of the network as SVG, for places that can't run WebGL (the social card).

/** A small seeded PRNG (mulberry32), so a frame comes out the same every time. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The network after `seconds` of wandering around the `avoid` rects, as an SVG document. */
export function networkSvg({
  width,
  height,
  avoid,
  color,
  seconds = 10,
  seed = 1,
}: {
  width: number;
  height: number;
  avoid: Rect[];
  color: string;
  seconds?: number;
  seed?: number;
}) {
  const n = createNetwork(width, height, avoid, false, seeded(seed));
  let clock = 0;
  while (clock < seconds) step(n, (clock += STEP));

  const data = new Float32Array(MAX_INSTANCES * STRIDE);
  const count = instances(n, clock, data);
  const shapes: string[] = [];
  for (let k = 0; k < count; k += 1) {
    const [x0, y0, x1, y1, r, alpha] = data.subarray(k * STRIDE, k * STRIDE + STRIDE);
    const a = alpha.toFixed(3);
    shapes.push(
      x0 === x1 && y0 === y1
        ? `<circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="${r}" fill-opacity="${a}"/>`
        : `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke-width="${r * 2}" stroke-opacity="${a}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="${color}" stroke="${color}" stroke-linecap="round">${shapes.join("")}</svg>`;
}
