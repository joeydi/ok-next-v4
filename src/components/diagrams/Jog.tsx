"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { LoopJog } from "./useLoop";

// The jog wheel along the bottom of a diagram: its loop's time as ticks on a
// drum, turning under a fixed playhead as the diagram plays. Grab it to hold the
// loop and scrub it, the ticks under the pointer following it 1:1; let go moving
// and the throw carries on, either way, easing back into normal playback (see
// useLoop). The drum is seen in a little perspective, so the ticks crowd, shrink
// and fade towards its sides. A sideways swipe on a touchpad scrubs it too, and
// arrow keys step it.

const PX = 120; // px of drum per second of loop, at the playhead
const MINOR = 0.1; // s between ticks: every 5th is longer, every 10th (a second) labelled
const LIMIT = 1.2; // rad either side of the playhead the drum is drawn to, where its ticks fade out
const DEPTH = 10; // the camera's distance from the drum, in radii
const THROW = 80; // ms of pointer movement a throw's speed is read from
const IDLE = 120; // ms without a wheel event that ends a swipe
const KEY_STEP = [MINOR, 1]; // s an arrow key steps, and with shift

/** How a point `theta` rad round the drum from the playhead shows: [x in radii, scale]. */
function onDrum(theta: number): [number, number] {
  const s = DEPTH / (DEPTH + 1 - Math.cos(theta));
  return [Math.sin(theta) * s, s];
}
// The drum's radius per half width: its drawn edge reaches the track's.
const REACH = onDrum(LIMIT)[0];

/** A gesture's recent x positions (px), by time (ms), for the scrub and the throw. */
type Trail = [ms: number, x: number][];

/** Moves the trail on to `x` at `ms`, keeping the last THROW ms of it. Returns the move (px). */
function follow(trail: Trail, ms: number, x: number) {
  const dx = x - trail[trail.length - 1][1];
  trail.push([ms, x]);
  while (trail.length > 2 && ms - trail[0][0] > THROW) trail.shift();
  return dx;
}

/** The loop's rate for a throw at the trail's speed: moving left runs it forward. */
function throwRate(trail: Trail) {
  const [t0, x0] = trail[0];
  const [t1, x1] = trail[trail.length - 1];
  return t1 > t0 ? (-(x1 - x0) / (t1 - t0)) * (1000 / PX) : 0;
}

/** The wheel, absolutely placed along the bottom of a positioned `@container` parent. */
export function Jog({ jog: { time, duration, grab, scrub, release } }: { jog: LoopJog }) {
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const [[w, h], setSize] = useState([0, 0]);
  const [held, setHeld] = useState(false);
  // The drag's trail, empty when there's none.
  const trail = useRef<Trail>([]);
  // The swipe's trail, as the sum of its wheel events, and the timer that ends it.
  const swipe = useRef<{ trail: Trail; idle: number } | null>(null);

  useEffect(() => {
    if (!track) return;
    const ro = new ResizeObserver(([e]) => setSize([e.contentRect.width, e.contentRect.height]));
    ro.observe(track);
    return () => ro.disconnect();
  }, [track]);

  const onWheel = useEffectEvent((e: WheelEvent) => {
    // Only a sideways swipe, so the page still scrolls under a vertical one; once one is
    // taken, its events are kept to its end, its momentum included.
    if (!swipe.current && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (!swipe.current) {
      grab();
      swipe.current = { trail: [[e.timeStamp, 0]], idle: 0 };
    }
    const sw = swipe.current;
    // A swipe left scrolls right (deltaX > 0), so it moves the ticks left, as a drag left does.
    const dx = e.deltaX * (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1);
    scrub(-follow(sw.trail, e.timeStamp, sw.trail[sw.trail.length - 1][1] - dx) / PX);
    // The system's momentum after the fingers lift comes as more events, slowing, so the
    // swipe ends when they stop, and lets go at the speed they ended at.
    clearTimeout(sw.idle);
    sw.idle = window.setTimeout(() => {
      release(throwRate(sw.trail));
      swipe.current = null;
    }, IDLE);
  });

  useEffect(() => {
    if (!track) return;
    // Not passive, so a swipe taken doesn't also scroll the page or go back in history.
    const wheel = (e: WheelEvent) => onWheel(e);
    track.addEventListener("wheel", wheel, { passive: false });
    return () => {
      track.removeEventListener("wheel", wheel);
      clearTimeout(swipe.current?.idle);
    };
  }, [track]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    trail.current = [[e.timeStamp, e.clientX]];
    setHeld(true);
    grab();
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const t = trail.current;
    if (!t.length) return;
    // Dragging left brings later time under the playhead, as the ticks run while it plays.
    scrub(-follow(t, e.timeStamp, e.clientX) / PX);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const t = trail.current;
    if (!t.length) return;
    // Held still before letting go: no throw, so the loop picks up from a stop.
    const moving = e.timeStamp - t[t.length - 1][0] < THROW / 2;
    release(moving ? throwRate(t) : 0);
    trail.current = [];
    setHeld(false);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    scrub(dir * KEY_STEP[e.shiftKey ? 1 : 0]);
  };

  return (
    <div
      ref={setTrack}
      role="slider"
      tabIndex={0}
      aria-label="Scrub through the diagram"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={Math.round(time * 10) / 10}
      aria-valuetext={`${time.toFixed(1)} of ${duration} seconds`}
      className={cn(
        "frame absolute inset-x-2 bottom-2 h-11 touch-pan-y select-none bg-paper-light @2xl:inset-x-[14.5rem] @2xl:bottom-5 @2xl:h-14",
        held ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      {w > 0 && <Drum time={time} duration={duration} width={w} height={h} />}
    </div>
  );
}

/** The ticks round the drum at `time`, and the playhead. */
function Drum({ time, duration, width, height }: { time: number; duration: number; width: number; height: number }) {
  const r = width / 2 / REACH; // px
  const cx = width / 2,
    cy = height / 2;
  const base = height - 11; // where the ticks stand (px)
  const span = (LIMIT * r) / PX / MINOR; // ticks either side of the playhead
  const first = Math.ceil(time / MINOR - span),
    last = Math.floor(time / MINOR + span);
  // The drum's vertical, shrunk by the scale towards its middle.
  const y = (v: number, s: number) => cy + (v - cy) * s;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={width} height={height}>
      {Array.from({ length: last - first + 1 }, (_, i) => {
        const k = first + i;
        const theta = ((k * MINOR - time) * PX) / r;
        const [x, s] = onDrum(theta);
        const fade = Math.cos((theta / LIMIT) * (Math.PI / 2)) ** 1.5;
        const major = k % 10 === 0;
        const len = major ? 14 : k % 5 === 0 ? 9 : 5;
        const sec = Math.round(((((k / 10) % duration) + duration) % duration) * 10) / 10;
        const seam = major && sec === 0;
        return (
          <g key={k} opacity={fade}>
            <line
              x1={cx + x * r}
              x2={cx + x * r}
              y1={y(base, s)}
              y2={y(base - len, s)}
              className={seam ? "stroke-pink" : major ? "stroke-ink/60" : "stroke-ink/30"}
              strokeWidth={major ? 1.25 : 1}
            />
            {major && (
              <text
                transform={`translate(${cx + x * r} ${y(base - len - 6, s)}) scale(${Math.cos(theta) * s} ${s})`}
                textAnchor="middle"
                className={cn("font-mono text-[9px] tracking-label-tight", seam ? "fill-pink-ink" : "fill-muted")}
              >
                {sec.toFixed(1).padStart(4, "0")}
              </text>
            )}
          </g>
        );
      })}
      {/* The playhead: fixed, the drum turning under it. */}
      <line x1={cx} x2={cx} y1={6} y2={height - 6} className="stroke-pink" strokeWidth="1.5" />
      <circle cx={cx} cy={base} r={3.5} className="fill-pink" />
    </svg>
  );
}
