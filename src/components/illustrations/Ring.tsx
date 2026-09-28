import type { CSSProperties } from "react";
import { Box, P, Scene, Stage, W } from "./primitives";

// Tools for better work — a 3×3 grid of tall pillars around a pink hub. The
// outer eight rise and fall in a wave that rolls a pink icosphere around the
// ring. The ball's facets are re-shaded as it rolls (one background-colour
// keyframe per facet) and edged in pink. Generated exactly as in the handoff's
// t4(motion, false, pinkHub, edges) (1s).

type Vec = [number, number, number];

const T = 9; // loop length (s)
const R = 95; // ball's orbit radius (px)
const A = 24; // wave amplitude (px)
const H = 200; // hub height (px)
const BR = R / 2; // ball radius (px)
const HO = H - BR; // outer pillars' resting height (px)
const ZB = HO - A + BR; // ball centre height (px)
const NS = 36; // shading steps per loop
const S = 100; // facet element size before matrix3d (px)

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: Vec): Vec => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Icosahedron subdivided once and projected onto a sphere of radius r: 80 triangles. */
function icosphere(r: number): Vec[][] {
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

// Light direction and the pink ramp facets are shaded along.
const LIGHT = norm([-0.35, -0.55, 1]);
const STOPS: [number, Vec][] = [[0, [168, 23, 58]], [0.6, [255, 77, 106]], [1, [255, 170, 184]]];

function shade(n: Vec) {
  const k = 0.25 + 0.75 * Math.max(0, dot(n, LIGHT));
  let i = 0;
  while (i < STOPS.length - 2 && k > STOPS[i + 1][0]) i++;
  const [k0, c0] = STOPS[i], [k1, c1] = STOPS[i + 1];
  const u = Math.min(1, Math.max(0, (k - k0) / (k1 - k0)));
  return `rgb(${c0.map((x, j) => Math.round(x + (c1[j] - x) * u)).join(",")})`;
}

/** A facet normal at phase ph of the loop: rolled twice about X while orbiting once about Z. */
function orient(n: Vec, ph: number): Vec {
  const p = -2 * ph, cp = Math.cos(p), sp = Math.sin(p);
  const v: Vec = [n[0], n[1] * cp - n[2] * sp, n[1] * sp + n[2] * cp];
  const cf = Math.cos(ph), sf = Math.sin(ph);
  return [v[0] * cf - v[1] * sf, v[0] * sf + v[1] * cf, v[2]];
}

type Facet = { key: number; outer: CSSProperties; inner: CSSProperties };

function build() {
  const css: string[] = [
    `@keyframes okRingSpin{from{transform:rotateZ(0deg)}to{transform:rotateZ(360deg)}}`,
    `@keyframes okIcoRoll{from{transform:translate3d(${R}px,0,${ZB}px) rotateX(0deg)}to{transform:translate3d(${R}px,0,${ZB}px) rotateX(-720deg)}}`,
  ];
  const facets: Facet[] = icosphere(BR).map((tri, fi) => {
    let [a, b, c] = tri;
    const cen: Vec = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3) as Vec;
    if (dot(cross(sub(b, a), sub(c, a)), cen) < 0) [b, c] = [c, b];
    // Grow each facet slightly so neighbours overlap and no seams show.
    [a, b, c] = [a, b, c].map((v) => v.map((x, i) => cen[i] + (x - cen[i]) * 1.06) as Vec);
    const ex = sub(b, a).map((x) => x / S), ey = sub(c, a).map((x) => x / S);
    const n = norm(cross(sub(b, a), sub(c, a)));
    const m = [...ex, 0, ...ey, 0, ...n, 0, ...a, 1].map((x) => +x.toFixed(4)).join(",");
    const name = `okIco${fi}`;
    css.push(
      `@keyframes ${name}{${Array.from({ length: NS + 1 }, (_, k) => `${((k / NS) * 100).toFixed(2)}%{background-color:${shade(orient(n, (k / NS) * 2 * Math.PI))}}`).join("")}}`,
    );
    const fill: CSSProperties = { backgroundColor: shade(n), animation: `${name} ${T}s linear infinite` };
    return {
      key: fi,
      // The outer triangle, tinted pink, shows as the edge around the inset fill.
      outer: {
        position: "absolute",
        left: 0,
        top: 0,
        width: S,
        height: S,
        transformOrigin: "0 0",
        transform: `matrix3d(${m})`,
        clipPath: "polygon(0 0, 100% 0, 0 100%)",
        backfaceVisibility: "hidden",
        ...fill,
        backgroundImage: "linear-gradient(rgba(255,0,51,.4),rgba(255,0,51,.4))",
        backgroundBlendMode: "multiply",
      },
      inner: { position: "absolute", inset: 0, clipPath: "polygon(3.5% 3.5%, 93% 3.5%, 3.5% 93%)", ...fill },
    };
  });
  return { css: css.join("\n"), facets };
}

const { css: CSS, facets: FACETS } = build();

const PILLARS = Array.from({ length: 9 }, (_, i) => {
  const c = i % 3, r = Math.floor(i / 3);
  const x = c - 1, y = r - 1;
  const hub = !x && !y;
  // Each outer pillar's wave phase follows its angle around the ring.
  const delay = (((Math.atan2(y, x) / (2 * Math.PI) + 1) % 1) * T - T).toFixed(3);
  return { c, r, hub, delay };
});

export function Ring({ className }: { className?: string }) {
  return (
    <>
      <style href="ok-ring" precedence="default">
        {CSS}
      </style>
      <Stage labels={["VISIBILITY", "AUTOMATION", "MONITORING"]} className={className}>
        <Scene>
          {PILLARS.map(({ c, r, hub, delay }, i) => (
            <Box
              key={i}
              x={28 + c * 90}
              y={28 + r * 90}
              w={64}
              d={64}
              h={100}
              c={hub ? P : W}
              still={`translateZ(0) scale3d(1,1,${((hub ? H : HO) / 100).toFixed(3)})`}
              vars={{ "--a": ((HO - A) / 100).toFixed(3), "--b": ((HO + A) / 100).toFixed(3) }}
              anim={hub ? undefined : `okBar ${T}s ease-in-out ${delay}s infinite`}
            />
          ))}
          <div
            style={{
              position: "absolute",
              left: 150,
              top: 150,
              width: 0,
              height: 0,
              transformStyle: "preserve-3d",
              animation: `okRingSpin ${T}s linear infinite`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                transformStyle: "preserve-3d",
                transform: `translate3d(${R}px,0,${ZB}px)`,
                animation: `okIcoRoll ${T}s linear infinite`,
              }}
            >
              {FACETS.map((f) => (
                <div key={f.key} style={f.outer}>
                  <div style={f.inner} />
                </div>
              ))}
            </div>
          </div>
        </Scene>
      </Stage>
    </>
  );
}
