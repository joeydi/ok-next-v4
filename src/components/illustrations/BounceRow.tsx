import type { CSSProperties } from "react";
import { FACET, facets, shade, shadeKeyframes, type Vec } from "./icosphere";
import { P, Scene, Stage, W } from "./primitives";

// Creative production — a row of columns slides from top right to bottom left
// under a spinning pink ball. Each column fades in and rises out of the ground
// as it approaches, springs up and flashes pink as it reaches the centre,
// bouncing the ball back into the air, then sinks and fades out as it moves
// on. Generated exactly as in the handoff's t8(motion, smooth) (1u).

const TS = 1.5; // one column passes the centre every TS (s), and the ball bounces once
const N = 13; // columns in the row
const TC = N * TS; // loop length for one column (s)
const PITCH = 144; // column spacing (px)
const CW = 114; // column width (px)
const V = PITCH / TS; // row speed (px/s)
const X0 = 150 + 6 * PITCH; // first column's start x (px)
const TC_HIT = 6 * TS; // when a column reaches the centre (s into its loop)
const WALL = 100; // unscaled column height (px)
const HIT = 170; // column height at the moment it hits the ball (px)
const BR = 66; // ball radius (px)
const Z0 = HIT + BR; // ball centre height at the bottom of its bounce (px)
const JUMP = 110; // bounce height (px)
const SPIN = 6; // ball spin period (s)
const PAPER = "#F3EFE8"; // --color-paper: columns fade from/to the page

const pct = (s: number) => `${((s / TC) * 100).toFixed(3)}%`;
const rowX = (s: number) => `${(X0 - V * s - CW / 2).toFixed(1)}px`;
const EASE_IN = "animation-timing-function:cubic-bezier(.5,0,1,1)";
const EASE_OUT = "animation-timing-function:cubic-bezier(.2,.8,.3,1)";
const EASE_IO = "animation-timing-function:cubic-bezier(.45,0,.55,1)";
const height = (z: number) => `transform:translateZ(0) scale3d(1,1,${z})`;

/** A facet normal at angle a of the ball's spin about Y. */
const orient = (n: Vec, a: number): Vec => [n[0] * Math.cos(a) + n[2] * Math.sin(a), n[1], -n[0] * Math.sin(a) + n[2] * Math.cos(a)];

function build() {
  const t = TC_HIT;
  const css = [
    `@keyframes okBrMove{0%{transform:translate3d(${rowX(0)},${150 - CW / 2}px,0)}100%{transform:translate3d(${rowX(TC)},${150 - CW / 2}px,0)}}`,
    `@keyframes okBrHS{0%,${pct(t - 3.5)}{${height(0.001)};${EASE_IO}}${pct(t - 0.15)}{${height(1.1)};${EASE_IN}}${pct(t)}{${height(HIT / 100)};${EASE_OUT}}${pct(t + 0.12)}{${height(2)};${EASE_IO}}${pct(t + 0.3)}{${height(1.8)};${EASE_IO}}${pct(t + 0.45)}{${height(1.88)};${EASE_IO}}${pct(t + 0.6)}{${height(1.85)};${EASE_IO}}${pct(t + 3)},100%{${height(0.001)}}}`,
    `@keyframes okBrBall{0%{transform:translate3d(150px,150px,${Z0}px);animation-timing-function:cubic-bezier(.33,.66,.66,1)}50%{transform:translate3d(150px,150px,${Z0 + JUMP}px);animation-timing-function:cubic-bezier(.33,0,.66,.33)}100%{transform:translate3d(150px,150px,${Z0}px)}}`,
    `@keyframes okBrSpin{from{transform:rotateY(0deg)}to{transform:rotateY(360deg)}}`,
  ];
  // Face colours: paper → white → pink flash at the hit → white → paper.
  const face = (name: string, i: 0 | 1 | 2, edge: boolean) => {
    const c = (col: string, e: string) => `background-color:${col}${edge ? `;box-shadow:inset 0 0 0 1px ${e}` : ""}`;
    css.push(
      `@keyframes ${name}{0%,${pct(t - 3.5)}{${c(PAPER, PAPER)}}${pct(t - 3.25)},${pct(t - 0.01)}{${c(W[i], W[2])}}${pct(t)},${pct(t + 0.1)}{${c(P[i], P[2])};animation-timing-function:cubic-bezier(.3,0,.6,1)}${pct(t + 0.6)},${pct(t + 2.75)}{${c(W[i], W[2])}}${pct(t + 3)},100%{${c(PAPER, PAPER)}}}`,
    );
  };
  face("okBrTS", 0, true);
  face("okBr1S", 1, false);
  face("okBr2S", 2, false);

  const ball = facets(BR).map(({ n, matrix }, fi): CSSProperties => {
    const name = `okBrI${fi}`;
    css.push(shadeKeyframes(name, n, orient));
    return {
      position: "absolute",
      left: 0,
      top: 0,
      width: FACET,
      height: FACET,
      transformOrigin: "0 0",
      transform: `matrix3d(${matrix})`,
      clipPath: "polygon(0 0, 100% 0, 0 100%)",
      backfaceVisibility: "hidden",
      backgroundColor: shade(n),
      animation: `${name} ${SPIN}s linear infinite`,
    };
  });
  return { css: css.join("\n"), ball };
}

const { css: CSS, ball: BALL } = build();

// Walls fade into the ground; the top face carries the edge line.
const fade = (dir: string) => `linear-gradient(${dir}, ${PAPER} 0%, rgba(243,239,232,0) 75%)`;
const WALLS: [key: string, style: CSSProperties, shade: 1 | 2, dir: string][] = [
  ["fy", { left: 0, top: CW, width: CW, height: WALL, transformOrigin: "top", transform: "rotateX(90deg)" }, 1, "to bottom"],
  ["by", { left: 0, top: 0, width: CW, height: WALL, transformOrigin: "top", transform: "rotateX(90deg)" }, 1, "to bottom"],
  ["fx", { left: CW, top: 0, width: WALL, height: CW, transformOrigin: "left", transform: "rotateY(-90deg)" }, 2, "to right"],
  ["bx", { left: 0, top: 0, width: WALL, height: CW, transformOrigin: "left", transform: "rotateY(-90deg)" }, 2, "to right"],
];

/** Height of column j when motion is off: the centre one mid-bounce, its neighbours rising/sinking, the rest hidden. */
const stillHeight = (j: number) => (j === 6 ? 1.85 : Math.abs(j - 6) === 1 ? 0.9 : 0.001);

export function BounceRow({ className }: { className?: string }) {
  return (
    <>
      <style href="ok-bounce-row" precedence="default">
        {CSS}
      </style>
      <Stage labels={["AGENCIES", "CAMPAIGNS", "REPORTING"]} className={className}>
        <Scene>
          {Array.from({ length: N }, (_, j) => {
            const anim = (name: string) => `${name} ${TC}s linear ${(-j * TS).toFixed(3)}s infinite`;
            return (
              <div
                key={j}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: CW,
                  height: CW,
                  transformStyle: "preserve-3d",
                  transform: `translate3d(${X0 - PITCH * j - CW / 2}px,${150 - CW / 2}px,0)`,
                  animation: anim("okBrMove"),
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transformStyle: "preserve-3d",
                    transformOrigin: "50% 50% 0",
                    transform: `translateZ(0) scale3d(1,1,${stillHeight(j)})`,
                    animation: anim("okBrHS"),
                  }}
                >
                  {WALLS.map(([key, style, i, dir]) => (
                    <div
                      key={key}
                      style={{
                        position: "absolute",
                        ...style,
                        backgroundColor: W[i],
                        backgroundImage: fade(dir),
                        animation: anim(`okBr${i}S`),
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: CW,
                      height: CW,
                      background: W[0],
                      boxShadow: `inset 0 0 0 1px ${W[2]}`,
                      transform: `translateZ(${WALL}px)`,
                      animation: anim("okBrTS"),
                    }}
                  />
                </div>
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              transformStyle: "preserve-3d",
              transform: `translate3d(150px,150px,${Z0 + 20}px)`,
              animation: `okBrBall ${TS}s linear infinite`,
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
                animation: `okBrSpin ${SPIN}s linear infinite`,
              }}
            >
              {BALL.map((style, fi) => (
                <div key={fi} style={style} />
              ))}
            </div>
          </div>
        </Scene>
      </Stage>
    </>
  );
}
