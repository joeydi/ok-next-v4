import type { SizeToken } from "@/lib/tokens";

// The page's frame at one viewport width, shared by <PageGrid> and its live row:
// the container, capped at --container-page, the gutter either side and grid-12's
// columns. Plain maths and SVG, so it runs on the client too: sizeAt is repeated
// here because src/lib/tokens.ts reads files.

export type GridSpec = { gutter: SizeToken; gap: SizeToken; columns: number; cap: number };

/** The container, gutter, column gap and column width in px at a viewport width. */
export function gridAt(vw: number, { gutter, gap, columns, cap }: GridSpec) {
  const at = (t: SizeToken) => Math.min(t.max, Math.max(t.min, t.base + t.slope * vw));
  const container = Math.min(vw, cap);
  const g = at(gutter);
  const c = at(gap);
  return { vw, container, gutter: g, gap: c, column: (container - 2 * g - (columns - 1) * c) / columns, columns };
}

/**
 * One viewport drawn `w` wide, whatever its width, so rows compare as proportions:
 * the window as a dashed outline, the container in guide and its columns in pink.
 */
export function GridRow({
  grid,
  x,
  y,
  w,
  h,
}: {
  grid: ReturnType<typeof gridAt>;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const k = w / grid.vw;
  const left = x + ((grid.vw - grid.container) / 2) * k;
  return (
    <g>
      <rect x={left} y={y} width={grid.container * k} height={h} className="fill-guide/50" />
      {Array.from({ length: grid.columns }, (_, i) => (
        <rect
          key={i}
          x={left + (grid.gutter + i * (grid.column + grid.gap)) * k}
          y={y}
          width={grid.column * k}
          height={h}
          className="fill-pink/35"
        />
      ))}
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={w - 1}
        height={h - 1}
        fill="none"
        className="stroke-muted"
        strokeDasharray="4 3"
      />
    </g>
  );
}
