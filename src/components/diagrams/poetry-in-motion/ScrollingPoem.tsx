import type { ReactNode } from "react";
import { type Bank, LINES, lineOpacity, shapePolygon } from "./river";

// The demo in miniature, inside a plate's window: the poem scrolls up a block of
// lines per loop while the float slides up faster, as its margin-top scrubs, so
// every line re-wraps to follow the bank. Lines fade out over the top half, as in
// the demo. The river gains one period on the screen per loop, so the loop has no
// seam.

export type PoemLayout = {
  /** Viewport height (px). */
  height: number;
  lineHeight: number;
  /** Lines the poem scrolls per loop. */
  block: number;
  /** One period of the river (px): more than a block, so the float outruns the text. */
  period: number;
  floatWidth: number;
  /** `shape-margin`: how far the lines keep off the bank (px). */
  shapeMargin: number;
  /** Classes for a line's text. */
  text: string;
};

/**
 * Where things are `phase` (0–1) of the way through the loop (px), and how much
 * there is of them. `pad` is how far past the viewport, above and below, the
 * content must reach, so its ends, where the loop wraps, stay out of sight.
 */
export function poemOffsets(phase: number, layout: PoemLayout, pad: number) {
  const { height: H, lineHeight: LH, block, period: P } = layout;
  const d = block * LH;
  // Whole blocks above the viewport: at least one, and enough to cover the pad.
  const above = Math.ceil(pad / d) + 1;
  const scroll = d * (above + phase);
  const margin = -(P - d) * phase;
  // The float reaches from above the content's top to the pad below the viewport, all loop.
  const periods = Math.ceil((above * d + H + pad + P) / P);
  const rows = Math.ceil(((above + 1) * d + H + pad) / LH) + 1;
  return { scroll, margin, periods, rows, river: margin - scroll };
}

type Props = {
  phase: number;
  layout: PoemLayout;
  /** How far past the viewport the content must reach (see poemOffsets). */
  pad: number;
  /** Moves everything by [x, y] px without changing where the lines are in their fade. */
  offset?: [number, number];
  /** The float's bank, the demo's by default. */
  bank?: Bank;
  /** Drawn inside the float, at its size. */
  children?: ReactNode;
};

/** The scrolling content: put it in a positioned viewport `layout.height` tall that fades out within `pad`. */
export function ScrollingPoem({ phase, layout, pad, offset = [0, 0], bank, children }: Props) {
  const { height: H, lineHeight: LH, block, period, floatWidth, shapeMargin, text } = layout;
  const { scroll, margin, periods, rows } = poemOffsets(phase, layout, pad);

  return (
    <div
      className="absolute inset-x-0 top-0"
      style={{ transform: `translate(${offset[0]}px, ${offset[1] - scroll}px)` }}
    >
      <div
        className="relative float-left"
        style={{
          width: floatWidth,
          height: periods * period,
          marginTop: margin,
          // The wrap is clipped to the margin box: room for the shape margin where the bank reaches the edge.
          marginRight: shapeMargin,
          shapeOutside: shapePolygon(periods, bank),
          shapeMargin,
        }}
      >
        {children}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`display whitespace-nowrap ${text}`}
          style={{ height: LH, lineHeight: `${LH}px`, opacity: lineOpacity((H - (i * LH - scroll)) / (H + LH)) }}
        >
          {LINES[i % block]}
        </div>
      ))}
    </div>
  );
}
