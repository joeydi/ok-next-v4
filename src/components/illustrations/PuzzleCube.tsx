import type { CSSProperties } from "react";
import { P, Scene, Stage, W } from "./primitives";

// Home — a 3×3×3 puzzle cube. Each horizontal layer turns 180° about Z, then the
// cube scrambles with four slice turns and plays them back in reverse until
// solved. Face colours swap as cubes move so tops stay light and sides shaded.
// Keyframes are generated per cube (okRs{ijk}) exactly as in the handoff's rubik().

type Axis = "x" | "y" | "z";
type Vec = [number, number, number];
type Move = [axis: Axis, layer: number, dir: number];

const MOVES: Move[] = [["x", 1, 1], ["y", -1, 1], ["z", 1, -1], ["x", -1, -1]];
const SEQ: Move[] = [...MOVES, ...MOVES.slice().reverse().map(([a, l, d]): Move => [a, l, -d])];
const AX = { x: 0, y: 1, z: 2 } as const;

const T = 10.4; // loop length (s)
const HOLD = 3.2; // layer spins + pause before the scramble starts
const STEP = (T - HOLD) / SEQ.length;
const TURN = 0.6; // each slice turn
const EASE = "cubic-bezier(.65,0,.35,1)";
const K = "okRs";

const FACES: [name: string, normal: Vec, transform: string][] = [
  ["t", [0, 0, 1], "translateZ(32px)"],
  ["b", [0, 0, -1], "rotateY(180deg) translateZ(32px)"],
  ["px", [1, 0, 0], "rotateY(90deg) translateZ(32px)"],
  ["nx", [-1, 0, 0], "rotateY(-90deg) translateZ(32px)"],
  ["py", [0, 1, 0], "rotateX(-90deg) translateZ(32px)"],
  ["ny", [0, -1, 0], "rotateX(90deg) translateZ(32px)"],
];

function rot([x, y, z]: Vec, a: Axis, d: number): Vec {
  if (a === "x") return d > 0 ? [x, -z, y] : [x, z, -y];
  if (a === "y") return d > 0 ? [z, y, -x] : [-z, y, x];
  return d > 0 ? [-y, x, z] : [y, -x, z];
}

const pct = (t: number) => `${((t / T) * 100).toFixed(3)}%`;

/** [time, moves applied, layer spin angle] keyframe stops for layer k. */
function times(k: number): [number, number, number][] {
  const s0 = 0.5 + (1 - k) * 0.3;
  const t: [number, number, number][] = [[0, 0, 0], [s0, 0, 0], [s0 + 1.3, 0, 180], [HOLD, 0, 180]];
  SEQ.forEach((_, m) => t.push([HOLD + m * STEP, m, 180], [HOLD + m * STEP + TURN, m + 1, 180]));
  t.push([T, SEQ.length, 180]);
  return t;
}

type Cube = { id: string; transform: string; faces: { key: string; style: CSSProperties }[] };

function build() {
  const css: string[] = [];
  const cubes: Cube[] = [];
  for (let k = -1; k <= 1; k++)
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const id = `${i + 1}${j + 1}${k + 1}`;
        const pal = k === 0 ? P : W;
        const ts = times(k);
        let p: Vec = [-i, -j, k];
        let ns: Vec[] = FACES.map(([, n]) => [-n[0], -n[1], n[2]]);
        const ang: number[] = [];
        const history: Vec[][] = [ns];
        for (const [a, l, d] of SEQ) {
          const inSlice = p[AX[a]] === l;
          ang.push(inSlice ? d * 90 : 0);
          if (inSlice) {
            p = rot(p, a, d);
            ns = ns.map((n) => rot(n, a, d));
          }
          history.push(ns);
        }
        const tf = (n: number, spin = 0) =>
          SEQ.map(([a], m) => `rotate${a.toUpperCase()}(${m < n ? ang[m] : 0}deg)`).reverse().join(" ") +
          ` rotateZ(${spin}deg) translate3d(${i * 90}px,${j * 90}px,${k * 90}px)`;
        const col = (n: Vec) => (n[2] ? pal[0] : n[1] ? pal[1] : pal[2]);

        css.push(`@keyframes ${K}${id}{${ts.map(([t, n, a]) => `${pct(t)}{transform:${tf(n, a)}}`).join("")}}`);
        const faces = FACES.map(([name, , transform], fi) => {
          const cs = history.map((st) => col(st[fi]));
          const animated = cs.some((c) => c !== cs[0]);
          if (animated)
            css.push(`@keyframes ${K}${id}${name}{${ts.map(([t, n]) => `${pct(t)}{background:${cs[n]}}`).join("")}}`);
          return {
            key: name,
            style: {
              position: "absolute",
              inset: 0,
              background: cs[0],
              boxShadow: `inset 0 0 0 1px ${pal[2]}`,
              transform,
              animation: animated ? `${K}${id}${name} ${T}s ${EASE} infinite` : undefined,
            } satisfies CSSProperties,
          };
        });
        cubes.push({ id, transform: tf(0), faces });
      }
  return { css: css.join("\n"), cubes };
}

const { css: CSS, cubes: CUBES } = build();

export function PuzzleCube({ className }: { className?: string }) {
  return (
    <>
      <style href="ok-puzzle-cube" precedence="default">
        {CSS}
      </style>
      <Stage labels={["MARKETERS", "ORGANIZATIONS", "TEAMS"]} guideEnd={620} className={className}>
        <Scene>
          <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "translateZ(122px)" }}>
            {CUBES.map((c) => (
              <div
                key={c.id}
                style={{
                  position: "absolute",
                  left: 118,
                  top: 118,
                  width: 64,
                  height: 64,
                  transformStyle: "preserve-3d",
                  transformOrigin: "32px 32px 0",
                  transform: c.transform,
                  animation: `${K}${c.id} ${T}s ${EASE} infinite`,
                }}
              >
                {c.faces.map((f) => (
                  <div key={f.key} style={f.style} />
                ))}
              </div>
            ))}
          </div>
        </Scene>
      </Stage>
    </>
  );
}
