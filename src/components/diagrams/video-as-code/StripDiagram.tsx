"use client";

import { useId } from "react";
import { DiagramFigure } from "../DiagramFigure";
import { Chip, HatchDef, PlateHeader } from "../parts";
import { fromScreen, Plate, register, Stack, WINDOW, Window } from "../stack";
import { useLoop } from "../useLoop";
import { capture, clamp, easeOut, FPS, FRAMES, filmTime, frameTime } from "./film";
import { Scene } from "./Scene";

// The video-as-code note's diagram (src/content/notes/video-as-code.mdx): the
// capture pulled apart into plates. Back to front: the clock, a frame counter;
// the scene, as seek(t) draws it (in pink, as the browser has it before the
// screenshot); and a film strip of frames. The clock and the scene run in steady
// time, slower than the film, as the capture keeps its own pace. Only the strip
// steps, right to left: each frame comes in empty, settles over the scene, takes
// its screenshot at the moment the scene reaches its time, and moves on as the
// next empty frame comes in. The strip isn't faded: it runs off the surface.

const STEP = 1; // s per frame captured
const MOVE = 0.75; // of a step: the strip's move, eased in and out; then the frame rests
const SHOT = MOVE + 0.25 * (1 - MOVE); // of a step: the screenshot, once the frame has settled
const SHOW = 0.5; // steps the screenshot takes to fade in, on into the next move
const STILL = 13.1 * STEP; // s: a ball frame just captured, before the strip moves on (the reduced-motion frame)
export const LOOP = FRAMES * STEP;
const W = WINDOW.w;
const H = W * (9 / 16);
const Y = (WINDOW.h - H) / 2; // the scene's top in a window (px)
const PITCH = W + 14; // film strip: frame to frame (px)
const SPAN = 4; // frames either side of the scene: enough to run off the surface
const TICK = 30; // clock: frame to frame (px)
const REGISTER = register();
// The strip moves over the scene it captures, cancelling the gap between their plates, then a
// little on screen, by eye, so each screenshot lands on its scene (tune it in /admin/diagrams).
export const NUDGE: [number, number] = [-4, 4];
// The strip's plate sits nearer the camera than the scene's, so perspective draws its frames
// bigger: this shrinks them (measured in the browser) to match the scene on screen.
const SCALE = 0.947;

export function StripDiagram({
  caption,
  time,
  nudge = NUDGE,
}: {
  caption: string;
  time?: number;
  /** The strip's nudge on screen (px), for the lab. */
  nudge?: [number, number];
}) {
  const [ref, t] = useLoop<HTMLElement>(LOOP, { still: STILL, time });
  const hatch = useId();
  const { i, s } = capture(t, STEP, MOVE);
  const u = t / STEP; // steps into the loop
  const p = i - 1 + s; // the frame over the scene: the next one arrives through the step
  const now = u - SHOT; // the scene's time, in frames: frame i's at its screenshot
  const ticks = Math.ceil(WINDOW.h / 2 / TICK) + 1;
  const [nx, ny] = fromScreen(nudge);
  const shift = [REGISTER[0] + nx, REGISTER[1] + ny];

  return (
    <DiagramFigure
      ref={ref}
      caption={caption}
      description="An exploded view of the capture: a clock and the scene the browser draws for it, both running steadily, and a film strip of empty frames stepping across the scene. Each frame stops over the scene, takes a screenshot of it as the scene reaches that frame's time, and slides on as the next empty frame arrives."
    >
      <Stack>
        {/* The clock: not the wall clock, a frame counter, in steady time with the scene. */}
        <Plate level={0} look="base">
          <PlateHeader name="t">
            <Chip>frame / {FPS}</Chip>
          </PlateHeader>
          <Window>
            {Array.from({ length: 2 * ticks + 1 }, (_, k) => {
              const j = Math.floor(now) - ticks + k;
              const mark = clamp(1 - Math.abs(j - now)); // the mark, handing over as the ticks move
              const label = `${frameTime(j).toFixed(3)}s`;
              return (
                <div
                  key={j}
                  className="absolute inset-x-0 font-mono text-[12px] leading-none"
                  style={{ top: WINDOW.h / 2 + (j - now) * TICK - TICK / 2, height: TICK }}
                >
                  <Tick className="h-px w-5 bg-ink/30" label={label} labelClass="text-muted" opacity={1 - mark} />
                  {mark > 0 && (
                    <Tick
                      className="h-0.5 w-10 bg-pink"
                      label={label}
                      labelClass="font-semibold text-pink-ink"
                      opacity={mark}
                    />
                  )}
                </div>
              );
            })}
          </Window>
        </Plate>

        {/* The scene, as seek(t) leaves the page, in steady time. */}
        <Plate level={1} look="subject">
          <PlateHeader name="scene.html">
            <Chip pink>seek(t)</Chip>
          </PlateHeader>
          <Window>
            <svg aria-hidden="true" className="absolute size-0">
              <HatchDef id={hatch} />
            </svg>
            <div className="absolute inset-x-0 rounded-sm border border-pink/40" style={{ top: Y, height: H }}>
              <Scene t={filmTime(now / FPS)} width={W} look="subject" hatch={hatch} className="absolute -inset-px" />
            </div>
          </Window>
        </Plate>

        {/* The strip: empty frames in from the right, each captured over the scene. Open, not faded,
            so the frames run on past the plate and off the surface. */}
        <Plate level={2} look="content">
          <PlateHeader name="frame_%04d.png">
            <Chip>screenshot()</Chip>
          </PlateHeader>
          <div
            className="absolute"
            style={{ left: WINDOW.x, top: WINDOW.y, scale: SCALE, transformOrigin: `${W / 2}px ${Y + H / 2}px` }}
          >
            {Array.from({ length: 2 * SPAN + 1 }, (_, k) => {
              const j = i - SPAN + k;
              const shot = easeOut((u - j - SHOT) / SHOW); // since frame j's screenshot
              return (
                <div
                  key={j}
                  className="absolute rounded-sm border border-ink/25 bg-paper-light/40"
                  style={{
                    left: (j - p) * PITCH,
                    top: Y,
                    width: W,
                    height: H,
                    translate: `${shift[0]}px ${shift[1]}px`,
                  }}
                >
                  {/* Captured: the screenshot, framed in pink, comes in over the empty frame. */}
                  {shot > 0 && (
                    <div
                      className="absolute -inset-px overflow-hidden rounded-sm border border-pink bg-paper-light/70"
                      style={{ opacity: shot }}
                    >
                      <Scene t={frameTime(j)} width={W} className="absolute -inset-px opacity-80" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Plate>
      </Stack>
    </DiagramFigure>
  );
}

/** A row of the clock, one look of it: the tick and its time. */
function Tick({
  className,
  label,
  labelClass,
  opacity,
}: {
  className: string;
  label: string;
  labelClass: string;
  opacity: number;
}) {
  return (
    <div className="absolute inset-0 flex items-center gap-3" style={{ opacity }}>
      <span className={className} />
      <span className={labelClass}>{label}</span>
    </div>
  );
}
