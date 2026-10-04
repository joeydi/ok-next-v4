"use client";

import { useId } from "react";
import { DiagramFigure } from "../DiagramFigure";
import { Chip, HatchDef, PlateHeader } from "../parts";
import { FADE, fromScreen, GAP, Plate, register, Stack, WINDOW, Window } from "../stack";
import { useLoop } from "../useLoop";
import { DrawRiver, useBankMorph } from "./DrawRiver";
import { bank as river0, shapePath } from "./river";
import { type PoemLayout, poemOffsets, ScrollingPoem } from "./ScrollingPoem";

// The "poetry in motion" note's diagram (src/content/notes/poetry-in-motion.mdx):
// the page pulled apart into plates. Back to front: the parallax background, the
// float with its shape drawn in (the page never shows it), and the poem, wrapped
// by a real shape-outside float of the same outline that slides up faster than
// the text scrolls, so every line re-wraps to follow the bank. A panel down the
// side lets the reader draw their own bank (see DrawRiver).

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
// The poem moves over the river it wraps, cancelling the gap between their plates, then a little
// down and left on screen, by eye, so its lines meet the bank (tune it in /admin/diagrams).
const REGISTER = register();
export const NUDGE: [number, number] = [-4, 8];

export function RiverDiagram({
  caption,
  time,
  nudge = NUDGE,
}: {
  caption: string;
  time?: number;
  /** The poem's nudge on screen (px), for the lab. */
  nudge?: [number, number];
}) {
  const [ref, t, jog] = useLoop<HTMLElement>(LOOP, { time });
  const hatch = useId();
  const [bank, setBank, target] = useBankMorph(river0);
  const path = shapePath(FW, PERIODS * P, PERIODS, bank);
  const phase = t / LOOP;
  const { river } = poemOffsets(phase, LAYOUT, PAD);
  const [nx, ny] = fromScreen(nudge);
  const shift: [number, number] = [REGISTER[0] + nx, REGISTER[1] + ny];

  return (
    <DiagramFigure
      ref={ref}
      jog={jog}
      caption={caption}
      description="An exploded view of the page: a background layer, the invisible river-shaped float above it, and the poem's lines above that. As the float slides up, every line shifts sideways to follow the river's bank. A panel beside it lets you draw a new bank, and the lines follow that instead."
    >
      <div className="@container relative">
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
                <path d={path} className="fill-pink/15" />
                <path d={path} fill={`url(#${hatch})`} className="stroke-pink" strokeWidth="2" />
              </svg>
            </Window>
          </Plate>

          {/* The poem: nowrap lines, wrapped by an invisible float of the same shape. */}
          <Plate level={2} look="content">
            <PlateHeader name=".line">
              <Chip pink>white-space: nowrap</Chip>
            </PlateHeader>
            <Window overflow>
              <ScrollingPoem phase={phase} layout={LAYOUT} pad={PAD} offset={shift} bank={bank} />
            </Window>
          </Plate>
        </Stack>
        <DrawRiver bank={bank} custom={target !== river0} onDraw={setBank} onReset={() => setBank(river0)} />
      </div>
    </DiagramFigure>
  );
}
