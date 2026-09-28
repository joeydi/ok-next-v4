import { Box, N, P, Scene, Stage, W, type Style } from "./primitives";

// CMS & integrations — five platforms ride a continuous conveyor along the iso
// diagonal. Each fades in and rises out of the floor with its tiles popping on
// one by one, passes the old platform just as a pink tile hops across into its
// gap, then travels half a step further before sinking back and fading out.
// The scene is zoomed to 125% and shifted left. 7.5s loop, platforms offset by
// 1.5s. Keyframes are generated exactly as in the handoff's c8() (1v).

const T = 7.5; // loop length (s)
const STAGGER = 1.5; // gap between platforms (s)
const SPEED = 80; // conveyor speed (px/s)
const RISE = 0.85; // when a platform starts to rise (s)
const LAND = 3.75; // when the hopping tile lands in the gap (s)
const PAPER = "#F3EFE8"; // --color-paper: platforms fade from/to the page

const SLOTS = [[10, 10], [54, 10], [10, 54], [54, 54]] as const;
// Which slot is missing on each of the five platforms.
const MISSING = [0, 1, 3, 2, 1] as const;
// Resting Y offset of each platform along the conveyor when motion is off.
const STILL_Y = [-120, 240, 120, 0, -240] as const;

const pct = (s: number) => `${((s / T) * 100).toFixed(3)}%`;
const beltY = (s: number) => `${(300 - SPEED * s).toFixed(1)}px`;

const EASE_OUT = "animation-timing-function:cubic-bezier(.2,.8,.3,1)";
const EASE_IN = "animation-timing-function:cubic-bezier(.7,0,.8,.2)";
const EASE_IO = "animation-timing-function:cubic-bezier(.45,0,.55,1)";
const HIDDEN = "transform:translate3d(0,0,var(--z)) scale3d(.001,.001,.001)";
const SHOWN = "transform:translate3d(0,0,var(--z)) scale3d(1,1,1)";

function build() {
  // Platform face colour: paper → its white shade → paper. The top face also fades its edge line.
  const fade = (i: 0 | 1 | 2) => {
    const c = (col: string, edge: string) => `background-color:${col}${i ? "" : `;box-shadow:inset 0 0 0 1px ${edge}`}`;
    return `@keyframes okFadeU${i}{0%,${pct(RISE)}{${c(PAPER, PAPER)}}${pct(RISE + 0.25)},${pct(6.5)}{${c(W[i], W[2])}}${pct(6.75)},100%{${c(PAPER, PAPER)}}}`;
  };
  const css = [
    `@keyframes okConvN{0%{transform:translate3d(0,${beltY(0)},0)}${pct(6.75)},100%{transform:translate3d(0,${beltY(6.75)},0)}}`,
    `@keyframes okRiseU{0%,${pct(RISE)}{transform:scale3d(1,1,.001);${EASE_OUT}}${pct(RISE + 0.6)},${pct(6.15)}{transform:scale3d(1,1,1);${EASE_IO}}${pct(6.75)},100%{transform:scale3d(1,1,.001)}}`,
    fade(0),
    fade(1),
    fade(2),
    // The hop's height and its sideways travel run as two animations so each gets its own easing.
    `@keyframes okHopN{0%,${pct(0.75)}{${HIDDEN};${EASE_OUT}}${pct(1.05)},${pct(2.8)}{${SHOWN};animation-timing-function:cubic-bezier(.33,.66,.66,1)}${pct(3.275)}{transform:translate3d(0,0,calc(var(--z) + 110px)) scale3d(1,1,1);animation-timing-function:cubic-bezier(.33,0,.66,.33)}${pct(LAND)}{${SHOWN}}${pct(3.76)},100%{${HIDDEN}}}`,
    `@keyframes okHopNX{0%,${pct(2.8)}{translate:0 0;animation-timing-function:cubic-bezier(.4,0,.6,1)}${pct(LAND)},100%{translate:var(--dx) 0}}`,
  ];
  // Per-tile pop in / pop out. The missing tile appears the instant the hop lands.
  MISSING.forEach((miss, j) => {
    SLOTS.forEach((_, k) => {
      const inS = k === miss ? LAND : RISE + 0.25 + (k - (k > miss ? 1 : 0)) * 0.14;
      const inE = k === miss ? LAND : inS + 0.3;
      const outS = 5.7 + k * 0.12;
      const first = k === miss ? `0%,${pct(3.74)}{${HIDDEN}}${pct(LAND)}` : `0%,${pct(inS)}{${HIDDEN};${EASE_OUT}}${pct(inE)}`;
      css.push(`@keyframes okU${j}${k}{${first},${pct(outS)}{${SHOWN};${EASE_IN}}${pct(outS + 0.3)},100%{${HIDDEN}}}`);
    });
  });
  return css.join("\n");
}

const CSS = build();

export function Conveyor({ className }: { className?: string }) {
  return (
    <>
      <style href="ok-conveyor" precedence="default">
        {CSS}
      </style>
      <Stage labels={["CONTENT", "INTEGRATIONS", "PLATFORM"]} className={className}>
        <Scene pre="translateX(-60px) scale3d(1.25,1.25,1.25)">
          <Box x={15} y={100} w={100} d={100} h={40} c={N} />
          {MISSING.map((miss, j) => {
            const delay = -j * STAGGER;
            const anim = (name: string) => `${name} ${T}s linear ${delay}s infinite`;
            const platform: Style = {
              position: "absolute",
              left: 185,
              top: 100,
              width: 100,
              height: 100,
              transformStyle: "preserve-3d",
              transform: `translate3d(0,${STILL_Y[j]}px,0)`,
              animation: anim("okConvN"),
            };
            const riser: Style = {
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              transformOrigin: "50% 50% 0",
              // The fifth platform sits flat off the end of the belt when motion is off.
              transform: j === 4 ? "scale3d(1,1,.001)" : "none",
              animation: anim("okRiseU"),
            };
            const [sx, sy] = SLOTS[miss];
            return [
              <div key={`pl${j}`} style={platform}>
                <div style={riser}>
                  <Box
                    x={0}
                    y={0}
                    w={100}
                    d={100}
                    h={40}
                    c={W}
                    faceAnim={[anim("okFadeU0"), anim("okFadeU1"), anim("okFadeU2")]}
                  />
                  {SLOTS.map(([x, y], k) => (
                    <Box key={k} x={x} y={y} z={40} w={36} d={36} h={14} c={P} anim={anim(`okU${j}${k}`)} />
                  ))}
                </div>
              </div>,
              <Box
                key={`t${j}`}
                x={15 + sx}
                y={100 + sy}
                z={40}
                w={36}
                d={36}
                h={14}
                c={P}
                still="translate3d(0,0,40px) scale3d(.001,.001,.001)"
                vars={{ "--dx": "170px" }}
                anim={`${anim("okHopN")}, ${anim("okHopNX")}`}
              />,
            ];
          })}
        </Scene>
      </Stage>
    </>
  );
}
