"use client";

import { useId } from "react";
import { DiagramFigure } from "../DiagramFigure";
import { Chip, HatchDef, PlateHeader } from "../parts";
import { FADE, GAP, Plate, register, Stack, WINDOW, Window } from "../stack";
import { useLoop } from "../useLoop";
import { shapePath } from "./river";
import { type PoemLayout, poemOffsets, ScrollingPoem } from "./ScrollingPoem";

// The "poetry in motion" note's diagram (src/content/notes/poetry-in-motion.mdx):
// the page pulled apart into plates. Back to front: the parallax background, the
// float with its shape drawn in (the page never shows it), and the poem, wrapped
// by a real shape-outside float of the same outline that slides up faster than
// the text scrolls, so every line re-wraps to follow the bank.

const LOOP = 8; // s: the river gains one period on the text
const P = WINDOW.h; // one period of the river: a window's height (px)
const FW = Math.round(WINDOW.w * 0.55); // float width (px)

const LAYOUT: PoemLayout = {
  height: P,
  lineHeight: 23.5,
  block: 9,
  period: P,
  floatWidth: FW,
  shapeMargin: 14,
  text: "text-[15px] text-ink",
};
// The content reaches past the window by the fade, and by the poem's move across its plate.
const PAD = FADE + 2 * GAP;
const { periods: PERIODS } = poemOffsets(0, LAYOUT, PAD);
const PATH = shapePath(FW, PERIODS * P, PERIODS);
// The poem moves over the river it wraps, cancelling the gap between their plates.
const SHIFT = register();

export function RiverDiagram({ caption, time }: { caption: string; time?: number }) {
  const [ref, t] = useLoop<HTMLElement>(LOOP, { time });
  const hatch = useId();
  const phase = t / LOOP;
  const { river } = poemOffsets(phase, LAYOUT, PAD);

  return (
    <DiagramFigure
      ref={ref}
      caption={caption}
      description="An exploded view of the page: a background layer, the invisible river-shaped float above it, and the poem's lines above that. As the float slides up, every line shifts sideways to follow the river's bank."
    >
      <Stack>
        {/* Background: the photo behind everything, on its own slower scroll. */}
        <Plate level={0} look="base">
          <PlateHeader name=".background">
            <Chip>parallax</Chip>
          </PlateHeader>
          <Window>
            <div
              className="stripes absolute inset-0 rounded-md opacity-40"
              style={{ backgroundPosition: `0 ${phase * -17 * 4}px` }}
            />
          </Window>
        </Plate>

        {/* The float: the shape the browser wraps the text around. */}
        <Plate level={1} look="subject">
          <PlateHeader name="img.river">
            <Chip pink>shape-outside</Chip>
            <Chip>opacity: 0</Chip>
          </PlateHeader>
          <Window overflow>
            <svg
              aria-hidden="true"
              className="absolute top-0 left-0 overflow-visible"
              width={FW}
              height={PERIODS * P}
              style={{ transform: `translateY(${river}px)` }}
            >
              <HatchDef id={hatch} />
              <path d={PATH} className="fill-pink/15" />
              <path d={PATH} fill={`url(#${hatch})`} className="stroke-pink" strokeWidth="2" />
            </svg>
          </Window>
        </Plate>

        {/* The poem: nowrap lines, wrapped by an invisible float of the same shape. */}
        <Plate level={2} look="content">
          <PlateHeader name=".line">
            <Chip pink>white-space: nowrap</Chip>
          </PlateHeader>
          <Window overflow>
            <ScrollingPoem phase={phase} layout={LAYOUT} pad={PAD} offset={SHIFT} />
          </Window>
        </Plate>
      </Stack>
    </DiagramFigure>
  );
}
