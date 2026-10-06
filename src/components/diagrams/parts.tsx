import type { ReactNode } from "react";

// Pieces every technique diagram shares: the drawing surface (scaled to its
// container), the floor grid, a plate's header row and its code chips, and the
// hatch the hidden shapes are drawn in. See .claude/skills/diagram/SKILL.md.

/**
 * A fixed `size` px drawing surface, scaled to its container's width (the illustrations' frame, any size).
 * It clips to its edges, unless `open`, for a diagram set straight on the page whose shadows can run past them.
 */
export function Surface({
  size: [w, h],
  open = false,
  children,
}: {
  size: readonly [w: number, h: number];
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className="ok-illo" style={{ aspectRatio: `${w} / ${h}` }}>
      <div
        className="ok-illo-canvas"
        style={{ width: w, height: h, scale: `tan(atan2(100cqw, ${w}px))`, overflow: open ? "visible" : undefined }}
      >
        {children}
      </div>
    </div>
  );
}

const GRID = 44; // grid cell (px)
const GRID_LINES =
  "linear-gradient(var(--color-guide) 1px, transparent 1px), linear-gradient(90deg, var(--color-guide) 1px, transparent 1px)";

/**
 * The grid as a floor in a 3D scene: a `size` px square centred on its parent,
 * `z` px below it, fading out in a circle. Its lines run through the parent's
 * corners, so a plate there sits on the grid.
 */
export function FloorGrid({
  parent,
  z = 0,
  size = 2400,
}: {
  parent: readonly [w: number, h: number];
  z?: number;
  size?: number;
}) {
  const x = parent[0] / 2 - size / 2,
    y = parent[1] / 2 - size / 2;
  const fade = "radial-gradient(closest-side, #000 35%, transparent)";
  return (
    <div
      className="absolute opacity-70"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        transform: `translateZ(${z}px)`,
        backgroundImage: GRID_LINES,
        backgroundSize: `${GRID}px ${GRID}px`,
        backgroundPosition: `${-x % GRID}px ${-y % GRID}px`,
        WebkitMaskImage: fade,
        maskImage: fade,
      }}
    />
  );
}

/** A mono code label, pink when it names the property doing the work. */
export function Chip({ children, pink = false }: { children: ReactNode; pink?: boolean }) {
  return (
    <span
      className={
        pink
          ? "rounded-[5px] border border-pink bg-pink/10 px-1.5 py-px font-mono text-[11px] text-pink-ink leading-4 tracking-label-tight"
          : "rounded-[5px] border border-rule bg-paper px-1.5 py-px font-mono text-[11px] text-muted leading-4 tracking-label-tight"
      }
    >
      {children}
    </span>
  );
}

/** A plate's header: its selector in bold mono, then its chips. */
export function PlateHeader({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3 font-mono font-semibold text-[12px] text-ink leading-5">
      {name}
      {children}
    </div>
  );
}

/** A diagonal pink hatch for the shapes the page never shows. `id` must be unique on the page. */
export function HatchDef({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0V7" className="stroke-pink" strokeWidth="1.5" />
      </pattern>
    </defs>
  );
}
