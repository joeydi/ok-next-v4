"use client";

import { useSyncExternalStore } from "react";
import { GridRow, type GridSpec, gridAt } from "./pageGrid";

// <PageGrid>'s last row: the frame at the window's own width, so resizing it shows
// the gutter and columns change. `vw` in CSS is the window's width, scrollbar and all.

const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

export function PageGridLive({ spec, x, y, w, h }: { spec: GridSpec; x: number; y: number; w: number; h: number }) {
  const vw = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => null,
  );
  if (vw === null) return null;
  const grid = gridAt(vw, spec);
  return (
    <g>
      <text x={x - 10} y={y + h / 2} textAnchor="end" dominantBaseline="central" className="fill-ink">
        {vw}
      </text>
      <GridRow grid={grid} x={x} y={y} w={w} h={h} />
      <text x={x} y={y + h + 14} dominantBaseline="central" className="fill-ink">
        This window · gutter {Math.round(grid.gutter)} · gap {Math.round(grid.gap)} · column {Math.round(grid.column)}
      </text>
    </g>
  );
}
