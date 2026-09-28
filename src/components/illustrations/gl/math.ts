import type { Vec } from "../icosphere";

// Column-major 4×4 matrices (the layout WebGL expects) and x,y,z,w quaternions.

export type Mat4 = Float32Array;
export type Quat = [number, number, number, number];

export function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** a · b */
function mul2(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

/** m[0] · m[1] · … — read right to left, like a CSS transform list. */
export const mul = (...ms: Mat4[]) => ms.reduce(mul2);

export function translate(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function scale(x: number, y = x, z = x): Mat4 {
  const m = identity();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

/** Same matrix as CSS rotateX() (y down, z toward the viewer). */
export function rotateX(rad: number): Mat4 {
  const m = identity(), c = Math.cos(rad), s = Math.sin(rad);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

/** Same matrix as CSS rotateZ(). */
export function rotateZ(rad: number): Mat4 {
  const m = identity(), c = Math.cos(rad), s = Math.sin(rad);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

export const deg = (d: number) => (d * Math.PI) / 180;

export function ortho(l: number, r: number, b: number, t: number, n: number, f: number): Mat4 {
  const m = identity();
  m[0] = 2 / (r - l);
  m[5] = 2 / (t - b);
  m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(f + n) / (f - n);
  return m;
}

const vsub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vcross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnorm = (v: Vec): Vec => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

export function lookAt(eye: Vec, target: Vec, up: Vec): Mat4 {
  const z = vnorm(vsub(eye, target));
  const x = vnorm(vcross(up, z));
  const y = vcross(z, x);
  const m = identity();
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
  m[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  m[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  m[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  return m;
}

export const Q0: Quat = [0, 0, 0, 1];

export function quat(axis: Vec, rad: number): Quat {
  const [x, y, z] = vnorm(axis), s = Math.sin(rad / 2);
  return [x * s, y * s, z * s, Math.cos(rad / 2)];
}

/** a · b: rotate by b, then by a. */
export function qmul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/**
 * Writes T(c) · R(q) · S(sx, sy, sz) · T(o) into `out`: a model matrix built in
 * place, without four intermediate matrices per object per frame. `o` offsets
 * the mesh's origin (e.g. -0.5 centres a unit cube).
 */
export function trs(out: Mat4, c: Vec, [x, y, z, w]: Quat, sx: number, sy: number, sz: number, o: Vec = [0, 0, 0]): Mat4 {
  const r = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
  const s = [sx, sy, sz];
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) out[j * 4 + i] = r[j * 3 + i] * s[j];
    out[j * 4 + 3] = 0;
  }
  for (let i = 0; i < 3; i++) out[12 + i] = c[i] + out[i] * o[0] + out[4 + i] * o[1] + out[8 + i] * o[2];
  out[15] = 1;
  return out;
}
