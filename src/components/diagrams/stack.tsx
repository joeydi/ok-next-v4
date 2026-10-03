import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FloorGrid, Surface } from "./parts";

// The house view for a technique diagram: the page pulled apart into plates,
// stacked one gap apart on an iso floor grid, in a 16:9 frame. A plate's content
// sits in its window, under the header; with `overflow` it runs on past the plate
// and fades out above and below it. See .claude/skills/diagram/SKILL.md.

export const SIZE = [1120, 630] as const; // drawing surface (px)
export const PLATE = [380, 440] as const; // plate (px)
export const GAP = 70; // between plates (px)
const HEADER = 48; // window top, under the header (px)
const INSET = 16; // window inset (px)
/** The window under a plate's header (px): where it sits on the plate, and its size. */
export const WINDOW = { x: INSET, y: HEADER, w: PLATE[0] - 2 * INSET, h: PLATE[1] - HEADER - INSET } as const;
export const FADE = 260; // with overflow: how far past the window content fades out (px)
const RUN = 600; // with overflow: room to the right, for long lines (px)
const SIDE = 160; // with overflow: room to the left, for content moved by register() (px)

const CAMERA = { x: 52, z: -38 }; // deg: rotateX(x) rotateZ(z), roughly the GL illustrations' iso
// How much of a gap register() cancels: a little under all of it, as it ignores perspective.
const REGISTER = 0.8;

/** The stack: plates, back to front, as children. */
export function Stack({ children }: { children: ReactNode }) {
  return (
    <Surface size={SIZE}>
      <div className="absolute inset-0" style={{ perspective: 2200 }}>
        <div
          className="absolute"
          style={{
            left: (SIZE[0] - PLATE[0]) / 2,
            top: (SIZE[1] - PLATE[1]) / 2,
            width: PLATE[0],
            height: PLATE[1],
            transformStyle: "preserve-3d",
            transform: `rotateX(${CAMERA.x}deg) rotateZ(${CAMERA.z}deg)`,
          }}
        >
          <FloorGrid parent={PLATE} z={-GAP / 2} />
          {children}
        </div>
      </div>
    </Surface>
  );
}

const LOOKS = {
  /** The page's ground: the layer everything else sits on. */
  base: "border-ink/25 bg-paper-light shadow-sm",
  /** The subject, the thing the technique is about: in pink. */
  subject: "border-pink bg-pink/5",
  /** What the subject acts on, as the reader sees it: a faint paper page. */
  content: "border-ink/15 bg-paper/60",
};

/** One layer of the stack, `level` gaps up from the floor. */
export function Plate({ level, look, children }: { level: number; look: keyof typeof LOOKS; children: ReactNode }) {
  return (
    <div
      className={cn("absolute inset-0 rounded-[14px] border", LOOKS[look])}
      style={{ transform: `translateZ(${level * GAP}px)`, transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

/** The area under a plate's header. Clipped, or with `overflow`, open and faded out above and below. */
export function Window({ overflow = false, children }: { overflow?: boolean; children: ReactNode }) {
  const box = { left: INSET, top: HEADER, width: WINDOW.w, height: WINDOW.h };
  if (!overflow)
    return (
      <div className="absolute overflow-hidden" style={box}>
        {children}
      </div>
    );
  // A mask clips to its element's box, so the masked box reaches past the window by the fade (and to
  // either side, for long lines and moved content), and the content sits back at the window inside it.
  const fade = `linear-gradient(transparent, #000 ${FADE}px, #000 ${FADE + WINDOW.h}px, transparent)`;
  return (
    <div
      className="absolute"
      style={{
        left: INSET - SIDE,
        top: HEADER - FADE,
        width: SIDE + WINDOW.w + RUN,
        height: WINDOW.h + 2 * FADE,
        WebkitMaskImage: fade,
        maskImage: fade,
      }}
    >
      <div className="absolute" style={{ ...box, left: SIDE, top: FADE }}>
        {children}
      </div>
    </div>
  );
}

const rad = (d: number) => (d * Math.PI) / 180;

/** A vector in plate px through the camera, as CSS applies rotateX(x) rotateZ(z), to screen [x, y]. */
function toScreen([x, y, z]: [number, number, number]): [number, number] {
  const a = rad(CAMERA.x),
    c = rad(CAMERA.z);
  const x1 = x * Math.cos(c) - y * Math.sin(c),
    y1 = x * Math.sin(c) + y * Math.cos(c);
  return [x1, y1 * Math.cos(a) - z * Math.sin(a)];
}

/**
 * The move across a plate, [x, y] px, that cancels on screen its lift of `gaps`
 * gaps over another: content moved by it sits over the other plate's, as if the
 * two lay flat, so a wrap can be read against the shape it wraps.
 */
export function register(gaps = 1): [number, number] {
  return fromScreen(toScreen([0, 0, -REGISTER * gaps * GAP]));
}

/** The move across a plate, [x, y] px, that shows on screen as [x, y] px (ignoring perspective), for fine-tuning a register(). */
export function fromScreen([wx, wy]: [number, number]): [number, number] {
  const [ux, uy] = toScreen([1, 0, 0]);
  const [vx, vy] = toScreen([0, 1, 0]);
  const det = ux * vy - vx * uy;
  return [(wx * vy - vx * wy) / det, (ux * wy - wx * uy) / det];
}
