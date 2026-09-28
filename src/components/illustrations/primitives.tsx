import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The frame every illustration sits in: a fixed 620×660 px drawing surface that
// scales to fit its container, with dashed guides and three mono labels, as in
// the design handoff's frame(). GLIllustration draws the scene inside it.

export type Palette = readonly [top: string, side1: string, side2: string];

export const W: Palette = ["#FAF7F4", "#D8CCBF", "#C8BAAB"];
export const P: Palette = ["#FF4D6A", "#D62A4A", "#E63757"];
export const N: Palette = ["#E8DFD6", "#D3C6B8", "#C2B3A3"];

/** 620×660 frame with dashed guides and the three mono labels. */
export function Stage({
  labels,
  guideEnd = 560,
  className,
  children,
}: {
  labels: readonly [string, string, string];
  guideEnd?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={cn("ok-illo", className)}>
      <div className="ok-illo-canvas">
        <Guide x={116} y1={60} y2={guideEnd} color="#CDC0B2" />
        <Guide x={484} y1={60} y2={guideEnd} color="#CDC0B2" />
        <Guide x={300} y1={20} y2={guideEnd + 40} color="#FF4D6A" />
        {children}
        <Label y={110} n="01" text={labels[0]} />
        <Label y={205} n="02" text={labels[1]} color="#D01F3E" />
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

function Label({ y, n, text, color = "#746759" }: { y: number; n: string; text: string; color?: string }) {
  return (
    <div className="ok-illo-label" style={{ top: y, color }}>
      <span>/ {n}</span>
      <span style={{ color: "#1D1A17" }}>{text}</span>
    </div>
  );
}
