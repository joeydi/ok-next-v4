import type { CSSProperties, ReactNode } from "react";

// Isometric block illustrations, ported from the design handoff's logic class
// (frame / scene / grid / box). Everything is plain CSS 3D — no JS at runtime.
// The drawing surface is a fixed 620×660 px canvas that Stage scales to fit
// its container, so all coordinates below match the handoff exactly.

export type Palette = readonly [top: string, side1: string, side2: string];

export const W: Palette = ["#FBF8F3", "#D8CFC1", "#C4B9A8"];
export const P: Palette = ["#FF4D6A", "#D62A4A", "#E63757"];
export const N: Palette = ["#E9E2D7", "#CFC5B6", "#BFB3A1"];

type Vars = Record<`--${string}`, string | number>;
export type Style = CSSProperties & Vars;

/** 620×660 frame with dashed guides and the three mono labels. */
export function Stage({
  labels,
  guideEnd = 560,
  className = "",
  children,
}: {
  labels: readonly [string, string, string];
  guideEnd?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={`ok-illo ${className}`}>
      <div className="ok-illo-canvas">
        <Guide x={116} y1={60} y2={guideEnd} color="#C9BFB0" />
        <Guide x={484} y1={60} y2={guideEnd} color="#C9BFB0" />
        <Guide x={300} y1={20} y2={guideEnd + 40} color="#FF4D6A" />
        {children}
        <Label y={110} n="01" text={labels[0]} />
        <Label y={205} n="02" text={labels[1]} color="#D4203F" />
        <Label y={300} n="03" text={labels[2]} />
      </div>
    </div>
  );
}

function Guide({ x, y1, y2, color }: { x: number; y1: number; y2: number; color: string }) {
  return (
    <div
      style={{ position: "absolute", left: x, top: y1, height: y2 - y1, borderLeft: `1px dashed ${color}` }}
    />
  );
}

function Label({ y, n, text, color = "#6B645B" }: { y: number; n: string; text: string; color?: string }) {
  return (
    <div className="ok-illo-label" style={{ top: y, color }}>
      <span>/ {n}</span>
      <span style={{ color: "#1C1916" }}>{text}</span>
    </div>
  );
}

/** Faint grid under the isometric plane. */
export function Grid() {
  return <div className="ok-illo-grid" />;
}

/** The 300×300 isometric plane centred at (300, 400). */
export function Scene({ children }: { children: ReactNode }) {
  return (
    <div className="ok-illo-scene">
      <Grid />
      {children}
    </div>
  );
}

export type BoxProps = {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  c: Palette;
  rot?: number;
  /** CSS animation shorthand; dropped under prefers-reduced-motion. */
  anim?: string;
  /** Transform used when not animating (overrides the default placement). */
  still?: string;
  vars?: Vars;
};

/** Solid box: a top face plus four walls. */
export function Box({ x, y, z = 0, w, d, h, c, rot = 0, anim, still, vars }: BoxProps) {
  const [top, s1, s2] = c;
  const style: Style = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: d,
    transformStyle: "preserve-3d",
    transformOrigin: "50% 50% 0",
    transform: still ?? `translate3d(0,0,${z}px) rotateZ(${rot}deg)`,
    "--z": `${z}px`,
    "--r": `${rot}deg`,
    ...vars,
    animation: anim,
  };
  const face = (s: CSSProperties) => ({ position: "absolute", ...s }) as CSSProperties;
  return (
    <div style={style}>
      <div style={face({ left: 0, top: d, width: w, height: h, background: s1, transformOrigin: "top", transform: "rotateX(90deg)" })} />
      <div style={face({ left: 0, top: 0, width: w, height: h, background: s1, transformOrigin: "top", transform: "rotateX(90deg)" })} />
      <div style={face({ left: w, top: 0, width: h, height: d, background: s2, transformOrigin: "left", transform: "rotateY(-90deg)" })} />
      <div style={face({ left: 0, top: 0, width: h, height: d, background: s2, transformOrigin: "left", transform: "rotateY(-90deg)" })} />
      <div style={face({ left: 0, top: 0, width: w, height: d, background: top, transform: `translateZ(${h}px)`, boxShadow: `inset 0 0 0 1px ${s2}` })} />
    </div>
  );
}
