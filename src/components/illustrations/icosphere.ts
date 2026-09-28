// Pink faceted ball shared by Ring and BounceRow, ported from the handoff's
// ico() and the shading code in t4()/t8(). Each facet is a 100×100 element
// clipped to a triangle and placed with matrix3d; its colour is a flat shade
// of pink from a fixed light, re-computed per keyframe as the ball turns.

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

/** Facet element size before matrix3d (px). */
export const FACET = 100;

/** The ball's 80 facets: each one's outward normal and the matrix3d that places a FACET-square element on it. */
export function facets(r: number): { n: Vec; matrix: string }[] {
  return icosphere(r).map((tri) => {
    let [a, b, c] = tri;
    const cen: Vec = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot(cross(sub(b, a), sub(c, a)), cen) < 0) [b, c] = [c, b];
    // Grow each facet slightly so neighbours overlap and no seams show.
    [a, b, c] = [a, b, c].map((v) => v.map((x, i) => cen[i] + (x - cen[i]) * 1.06) as Vec);
    const ex = sub(b, a).map((x) => x / FACET), ey = sub(c, a).map((x) => x / FACET);
    const n = norm(cross(sub(b, a), sub(c, a)));
    const matrix = [...ex, 0, ...ey, 0, ...n, 0, ...a, 1].map((x) => +x.toFixed(4)).join(",");
    return { n, matrix };
  });
}

// Light direction and the pink ramp facets are shaded along.
export const LIGHT = norm([-0.35, -0.55, 1]);
const STOPS: [number, Vec][] = [[0, [168, 23, 58]], [0.6, [255, 77, 106]], [1, [255, 170, 184]]];

export function shade(n: Vec) {
  const k = 0.25 + 0.75 * Math.max(0, dot(n, LIGHT));
  let i = 0;
  while (i < STOPS.length - 2 && k > STOPS[i + 1][0]) i++;
  const [k0, c0] = STOPS[i], [k1, c1] = STOPS[i + 1];
  const u = Math.min(1, Math.max(0, (k - k0) / (k1 - k0)));
  return `rgb(${c0.map((x, j) => Math.round(x + (c1[j] - x) * u)).join(",")})`;
}

/** Keyframes that re-shade one facet over a loop; orient(n, angle) gives its normal at each of steps+1 angles over 2π. */
export function shadeKeyframes(name: string, n: Vec, orient: (n: Vec, angle: number) => Vec, steps = 36) {
  const frames = Array.from(
    { length: steps + 1 },
    (_, k) => `${((k / steps) * 100).toFixed(2)}%{background-color:${shade(orient(n, (k / steps) * 2 * Math.PI))}}`,
  );
  return `@keyframes ${name}{${frames.join("")}}`;
}
