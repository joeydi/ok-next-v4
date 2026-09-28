// The pink faceted ball in Ring and BounceRow, from the handoff's ico(): an
// icosahedron subdivided once. The renderer builds its mesh from this.

export type Vec = [number, number, number];

export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (v: Vec): Vec => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Icosahedron subdivided once and projected onto a sphere of radius r: 80 triangles. */
export function icosphere(r: number): Vec[][] {
  const g = (1 + Math.sqrt(5)) / 2;
  const V: Vec[] = ([
    [-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g],
    [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1],
  ] as Vec[]).map(norm);
  const F = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const mid = new Map<string, number>();
  const mp = (a: number, b: number) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (!mid.has(k)) {
      V.push(norm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2]));
      mid.set(k, V.length - 1);
    }
    return mid.get(k)!;
  };
  const F2: number[][] = [];
  F.forEach(([a, b, c]) => {
    const ab = mp(a, b), bc = mp(b, c), ca = mp(c, a);
    F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  });
  return F2.map((f) => f.map((i) => V[i].map((x) => x * r) as Vec));
}

/** The light the ball's pink ramp is shaded by (the design's; the shader has the ramp). */
export const LIGHT = norm([-0.35, -0.55, 1]);
