"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DiagramFigure } from "../DiagramFigure";
import { Chip, Surface } from "../parts";
import { useLoop } from "../useLoop";
import { FPS, FRAMES, frameTime, SHOTS } from "./film";
import { Scene } from "./Scene";

// The video-as-code note's second diagram: a flat schematic of fixing one shot.
// The ball shot's code changes,
// and only its frames are drawn again, one at a time, while the other shots' are
// kept as they were. The preview plays the frames on disk, so the fix shows up in
// it frame by frame. The loop makes the edit, then takes it back, so it has no seam.

const HALF = 6; // s: one edit
const LOOP = 2 * HALF;
const STILL = 4.4; // s: most of the shot redrawn, the preview on a fixed frame (the reduced-motion frame)
const START = 0.6; // s into an edit before the first frame is drawn again
const EACH = 0.55; // s per frame drawn
const SIZE = [1120, 630] as const;
const M = 48; // margin (px)
const THUMB = 104;
const GAP = 10;
const LABEL = 100;
const ROW = THUMB * (9 / 16);
const GRID_TOP = SIZE[1] - M - SHOTS * ROW - (SHOTS - 1) * 14;
const PREVIEW = 452;
const SHOT = 1; // the shot that's fixed

/** The edit `t` s into the loop: whether the fix is going in, and how far through the shot's frames the redraw is. */
function edit(t: number) {
  const fixing = t < HALF;
  const cursor = (t - (fixing ? 0 : HALF) - START) / EACH;
  return { fixing, cursor };
}

/** Whether frame `j` on disk has the fix, `t` s into the loop. */
function fixed(j: number, t: number) {
  const { fixing, cursor } = edit(t);
  const k = j - SHOT * FPS;
  if (k < 0 || k >= FPS) return false;
  const redrawn = cursor >= k + 0.5;
  return redrawn === fixing;
}

export function RerenderDiagram({ caption, time }: { caption: string; time?: number }) {
  const [ref, t] = useLoop<HTMLElement>(LOOP, { still: STILL, time });
  const { fixing, cursor } = edit(t);
  const playing = Math.floor(t * FPS) % FRAMES;
  const done = Math.min(FPS, Math.max(0, Math.floor(cursor + 0.5)));

  return (
    <DiagramFigure
      ref={ref}
      caption={caption}
      description="The ball shot's code changes, and only that shot's eight frames are drawn again, one by one; the title and chart frames are left as they were. The preview beside it plays the frames on disk, so the fix appears in it frame by frame."
    >
      <Surface size={SIZE}>
        {/* The code: the edit to the ball shot. */}
        <div
          className="absolute rounded-[14px] border border-ink/15 bg-paper-light p-5 font-mono text-[14px] text-ink leading-7"
          style={{ left: M, top: M, width: SIZE[0] - 3 * M - PREVIEW, height: PREVIEW * (9 / 16) }}
        >
          <div className="mb-2 flex items-center gap-2 font-semibold text-[12px] leading-5">
            shots/ball.js
            <Chip pink>
              render --frames {SHOT * FPS}–{SHOT * FPS + FPS - 1}
            </Chip>
          </div>
          <div className="text-muted">export function ball(u) {"{"}</div>
          <div className="pl-6">x = 22 + 116 * u</div>
          <div className="pl-6">y = bounce(u)</div>
          <Changed>r = {fixing ? 9 : 7}</Changed>
          <Changed>fill = {fixing ? "pink" : "ink"}</Changed>
          <div className="text-muted">{"}"}</div>
          <div className="mt-2 text-[12px] text-muted">
            redrawn {done} / {FPS} · {FRAMES - FPS} frames kept
          </div>
        </div>

        {/* The preview: the frames on disk, played. */}
        <div className="absolute" style={{ right: M, top: M, width: PREVIEW }}>
          <div className="relative overflow-hidden rounded-sm border border-ink/15 bg-paper-light">
            <Scene t={frameTime(playing)} width={PREVIEW} fix={fixed(playing, t)} className="block" />
          </div>
          <div className="mt-2 flex gap-px">
            {Array.from({ length: FRAMES }, (_, j) => (
              <span
                key={j}
                className={cn("h-1.5 flex-1", j === playing ? "bg-ink" : fixed(j, t) ? "bg-pink/50" : "bg-ink/15")}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[12px] text-muted">
            <span className="font-semibold text-ink">film.mp4</span>
            <span>{frameTime(playing).toFixed(3)}s</span>
          </div>
        </div>

        {/* The frames on disk, a shot a row. */}
        {Array.from({ length: SHOTS }, (_, shot) => (
          <div
            key={shot}
            className="absolute flex items-center"
            style={{ left: M, top: GRID_TOP + shot * (ROW + 14), height: ROW }}
          >
            <span
              className={cn("font-mono text-[12px]", shot === SHOT ? "font-semibold text-pink-ink" : "text-muted")}
              style={{ width: LABEL }}
            >
              {["title", "ball", "chart"][shot]}
            </span>
            <div className="flex" style={{ gap: GAP }}>
              {Array.from({ length: FPS }, (_, k) => {
                const j = shot * FPS + k;
                const drawing = shot === SHOT && cursor >= k && cursor < k + 1;
                return (
                  <div
                    key={j}
                    className={cn(
                      "relative overflow-hidden rounded-[3px] border bg-paper-light",
                      drawing ? "border-pink outline-2 outline-pink" : "border-ink/15",
                    )}
                    style={{ width: THUMB, height: ROW }}
                  >
                    <Scene t={frameTime(j)} width={THUMB} fix={fixed(j, t)} className="absolute -inset-px" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Surface>
    </DiagramFigure>
  );
}

function Changed({ children }: { children: ReactNode }) {
  return <div className="-mx-5 border-pink border-l-2 bg-pink/10 pr-5 pl-[42px] text-pink-ink">{children}</div>;
}
