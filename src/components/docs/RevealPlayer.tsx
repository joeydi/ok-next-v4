"use client";

import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { DocButton } from "./DocButton";
import { playhead, usePlayhead } from "./playhead";

// Two pages drawn at 1440 × 900 and scaled into the frame. .reveal-old and .reveal-new
// share the .page transition rules in globals.css, so their animations are the real
// ones: paused, and moved to the playhead through the Web Animations API.

const W = 1440;
const H = 900;
const SPEEDS = [
  ["1×", 1],
  ["½×", 0.5],
  ["¼×", 0.25],
  ["⅒×", 0.1],
] as const;

type Point = { x: number; y: number };

export function RevealPlayer({
  total,
  old,
  next,
  nav,
}: {
  total: number;
  old: ReactNode;
  next: ReactNode;
  nav: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const oldRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [origin, setOrigin] = useState<Point | null>(null);
  const [speed, setSpeed] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const t = usePlayhead();

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const ro = new ResizeObserver(() => setScale(frame.clientWidth / W));
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  // Place the circle and move every animation to the playhead.
  useEffect(() => {
    const frame = frameRef.current;
    const card = oldRef.current?.querySelector("[data-reveal-card]");
    if (!frame) return;
    // Until a click picks one, start where a click on the first card would.
    const at = origin ?? (card ? pointIn(frame, card, scale, 0.82, 0.28) : { x: W / 2, y: H / 2 });
    const reach = Math.hypot(Math.max(at.x, W - at.x), Math.max(at.y, H - at.y));
    for (const layer of [oldRef.current, newRef.current]) {
      if (!layer) continue;
      layer.style.setProperty("--reveal-x", `${at.x}px`);
      layer.style.setProperty("--reveal-y", `${at.y}px`);
      layer.style.setProperty("--reveal-reach", `${reach}px`);
      for (const a of layer.getAnimations()) {
        a.pause();
        a.currentTime = t;
      }
    }
    const mark = markRef.current;
    if (mark) {
      mark.style.left = `${at.x}px`;
      mark.style.top = `${at.y}px`;
      mark.style.opacity = t >= total ? "0" : "1";
    }
  });

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const ms = Math.min(total, playhead.get() + (now - last) * speed);
      last = now;
      playhead.set(ms);
      if (ms >= total) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total]);

  const play = (from?: number) => {
    if (from !== undefined || playhead.get() >= total) playhead.set(from ?? 0);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      playhead.set(total);
      return;
    }
    setPlaying(true);
  };

  // A click plays from the pointer; Enter on a card (a click with no pointer) from its centre.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const frame = e.currentTarget;
    const card = (e.target as Element).closest("[data-reveal-card]");
    const r = frame.getBoundingClientRect();
    setOrigin(
      e.detail === 0 && card
        ? pointIn(frame, card, scale, 0.5, 0.5)
        : { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale },
    );
    play(0);
  };

  return (
    <div className="doc-wide flex flex-col gap-fl-16">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the cards inside are the keyboard route; a click anywhere else is a pointer-only extra */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: as above */}
      <div
        ref={frameRef}
        onClick={onClick}
        className="relative aspect-[16/10] cursor-crosshair overflow-hidden rounded-lg border border-rule bg-paper"
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: W, height: H, scale }}>
          <div ref={oldRef} className="reveal-old absolute inset-0 bg-paper">
            {old}
          </div>
          <div ref={newRef} aria-hidden="true" className="reveal-new pointer-events-none absolute inset-0 bg-paper">
            {next}
          </div>
          {nav}
          <div
            ref={markRef}
            aria-hidden="true"
            className="absolute size-8 -translate-1/2 rounded-full border-3 border-pink-ink"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-fl-24 gap-y-3 font-mono text-fl-14">
        <DocButton on onClick={() => (playing ? setPlaying(false) : play())} className="w-24">
          {playing ? "Pause" : t >= total ? "Replay" : "Play"}
        </DocButton>
        <label className="flex min-w-60 flex-1 items-center gap-3">
          <span className="sr-only">Transition time in milliseconds</span>
          <input
            type="range"
            min={0}
            max={total}
            step={1}
            value={Math.round(t)}
            onChange={(e) => {
              setPlaying(false);
              playhead.set(Number(e.target.value));
            }}
            className="w-full accent-pink-ink"
          />
          <span className="w-16 text-right tabular-nums">{Math.round(t)}ms</span>
        </label>
        <fieldset className="flex gap-1.5">
          <legend className="sr-only">Playback speed</legend>
          {SPEEDS.map(([label, s]) => (
            <DocButton key={label} on={speed === s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {label}
            </DocButton>
          ))}
        </fieldset>
      </div>
      <p className="text-fl-14 text-muted">
        Click anywhere in the frame to navigate from that point, or tab to a card and press Enter to start from its
        centre. The timeline below follows the same playhead.
      </p>
    </div>
  );
}

/** A point inside `el` (fractions of its box), in the unscaled page's pixels. */
function pointIn(frame: Element, el: Element, scale: number, fx: number, fy: number): Point {
  const f = frame.getBoundingClientRect();
  const c = el.getBoundingClientRect();
  return { x: (c.left + c.width * fx - f.left) / scale, y: (c.top + c.height * fy - f.top) / scale };
}
