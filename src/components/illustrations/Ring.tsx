import type { CSSProperties } from "react";
import { FACET, facets, shade, shadeKeyframes, type Vec } from "./icosphere";
import { Box, P, Scene, Stage, W } from "./primitives";

// Tools for better work — a 3×3 grid of tall pillars around a pink hub. The
// outer eight rise and fall in a wave that rolls a pink icosphere around the
// ring. The ball's facets are re-shaded as it rolls (one background-colour
// keyframe per facet) and edged in pink. Generated exactly as in the handoff's
// t4(motion, false, pinkHub, edges) (1s).

const T = 9; // loop length (s)
const R = 95; // ball's orbit radius (px)
const A = 24; // wave amplitude (px)
const H = 200; // hub height (px)
const BR = R / 2; // ball radius (px)
const HO = H - BR; // outer pillars' resting height (px)
const ZB = HO - A + BR; // ball centre height (px)

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
  const list: Facet[] = facets(BR).map(({ n, matrix }, fi) => {
    const name = `okIco${fi}`;
    css.push(shadeKeyframes(name, n, orient));
    const fill: CSSProperties = { backgroundColor: shade(n), animation: `${name} ${T}s linear infinite` };
    return {
      key: fi,
      // The outer triangle, tinted pink, shows as the edge around the inset fill.
      outer: {
        position: "absolute",
        left: 0,
        top: 0,
        width: FACET,
        height: FACET,
        transformOrigin: "0 0",
        transform: `matrix3d(${matrix})`,
        clipPath: "polygon(0 0, 100% 0, 0 100%)",
        backfaceVisibility: "hidden",
        ...fill,
        backgroundImage: "linear-gradient(rgba(255,0,51,.4),rgba(255,0,51,.4))",
        backgroundBlendMode: "multiply",
      },
      inner: { position: "absolute", inset: 0, clipPath: "polygon(3.5% 3.5%, 93% 3.5%, 3.5% 93%)", ...fill },
    };
  });
  return { css: css.join("\n"), facets: list };
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
