import { dot, sub, type Vec } from "../icosphere";
import { type Mat4, type Quat, qrot } from "./math";

// Pointer picking against the orthographic camera: canvas px back to lines
// through the plane's coordinates, and plane vectors forward to canvas px.

export type Ray = { o: Vec; d: Vec };

/** Canvas z the rays start from: in front of anything a scene draws. */
const FAR = 2000;

/**
 * The line of plane points under canvas px (cx, cy), pointing into the scene.
 * `m` must be rigid (planeToCanvas without a scaling `pre`), so its inverse is
 * its rotation transposed.
 */
export function rayAt(m: Mat4, cx: number, cy: number): Ray {
  const col = (c: number): Vec => [m[c * 4], m[c * 4 + 1], m[c * 4 + 2]];
  const v: Vec = [cx - m[12], cy - m[13], FAR - m[14]];
  return { o: [dot(col(0), v), dot(col(1), v), dot(col(2), v)], d: [-m[2], -m[6], -m[10]] };
}

/** A plane vector as a canvas-px offset. */
export const projectVec = (m: Mat4, [x, y, z]: Vec): [number, number] => [
  m[0] * x + m[4] * y + m[8] * z,
  m[1] * x + m[5] * y + m[9] * z,
];

/** Where the ray first enters a box (distance along it) and that face's outward normal, or null for a miss. */
export function rayBox(ray: Ray, center: Vec, half: Vec, q: Quat): { t: number; normal: Vec } | null {
  // Slab test in the box's own frame.
  const inv: Quat = [-q[0], -q[1], -q[2], q[3]];
  const o = qrot(inv, sub(ray.o, center)),
    d = qrot(inv, ray.d);
  let t0 = -Infinity,
    t1 = Infinity,
    axis = 0,
    sign = 0;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (Math.abs(o[a]) > half[a]) return null;
      continue;
    }
    const near = (-Math.sign(d[a]) * half[a] - o[a]) / d[a],
      far = (Math.sign(d[a]) * half[a] - o[a]) / d[a];
    if (near > t0) [t0, axis, sign] = [near, a, -Math.sign(d[a])];
    t1 = Math.min(t1, far);
  }
  if (t0 > t1 || t1 < 0) return null;
  const n: Vec = [0, 0, 0];
  n[axis] = sign;
  return { t: t0, normal: qrot(q, n) };
}
