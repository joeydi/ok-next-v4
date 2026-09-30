"use client";

import { useSyncExternalStore } from "react";

// A line in <FluidScalePlot> at the window's own width, so resizing the window shows
// where on the scale the page is. `vw` in CSS is the window's width, scrollbar and all.

const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

export function ViewportMarker({
  d0,
  d1,
  x0,
  x1,
  top,
  bottom,
}: {
  /** The plot's viewport range, and where it sits across the SVG. */
  d0: number;
  d1: number;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}) {
  const vw = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => null,
  );
  if (vw === null) return null;
  const x = x0 + ((Math.min(d1, Math.max(d0, vw)) - d0) / (d1 - d0)) * (x1 - x0);
  return (
    <g className="text-ink">
      <line x1={x} x2={x} y1={top} y2={bottom} stroke="currentColor" strokeWidth={1} />
      {/* At the foot, clear of the design line's label at the top, and on the
          line's right when there's no room on its left. */}
      <text
        x={x - x0 < 140 ? x + 6 : x - 6}
        y={bottom - 4}
        textAnchor={x - x0 < 140 ? "start" : "end"}
        fill="currentColor"
      >
        This window · {vw}
      </text>
    </g>
  );
}
