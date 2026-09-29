"use client";

import { type Bezier, bezier, progress } from "@/lib/bezier";
import { cn } from "@/lib/cn";
import { usePlayhead } from "./playhead";
import { TONES, type Tone } from "./tone";

export type ResolvedRow =
  | { group: string; pseudo: string; tone: Tone }
  | {
      name: string;
      note: string;
      duration: number;
      delay: number;
      ease: string;
      points: Bezier;
      value?: { label: string; from: number; to: number; unit: string; digits: number };
      change?: string;
    };

/** The curve as a path across a 100 × 30 box, for a bar stretched to the animation's length. */
function curvePath(points: Bezier) {
  const at = bezier(points);
  let d = "";
  for (let i = 0; i <= 48; i++) {
    const x = i / 48;
    d += `${i ? "L" : "M"}${(x * 100).toFixed(2)} ${(30 - at(x) * 30).toFixed(2)}`;
  }
  return d;
}

const GRID = "grid gap-x-fl-24 gap-y-2 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_9rem] md:items-center";

/** Drawn by <Timeline> (Timeline.tsx), which resolves the rows' token names on the server. */
export function TimelineView({
  rows,
  total,
  step,
  live,
}: {
  rows: ResolvedRow[];
  total: number;
  step: number;
  live: boolean;
}) {
  const t = usePlayhead();
  const pct = (ms: number) => `${(ms / total) * 100}%`;
  const ticks = Array.from({ length: total / step + 1 }, (_, i) => i * step);
  const playheadLine = live && (
    <span
      aria-hidden="true"
      className="absolute inset-y-0 w-px bg-pink-ink"
      style={{ left: pct(Math.min(t, total)) }}
    />
  );
  // Each animation takes the colour of the group above it.
  const tones: Tone[] = [];
  for (const r of rows) tones.push("group" in r ? r.tone : (tones.at(-1) ?? "ink"));

  return (
    <div className="doc-wide flex flex-col font-mono text-fl-14 text-ink-2">
      <div className={cn(GRID, "max-md:hidden")}>
        <span />
        <div className="relative h-6">
          {ticks.map(
            (ms, i) =>
              i % 2 === 0 && (
                <span
                  key={ms}
                  className={cn(
                    "absolute bottom-1 -translate-x-1/2 text-fl-12 text-muted",
                    i === ticks.length - 1 && "-translate-x-full",
                  )}
                  style={{ left: pct(ms) }}
                >
                  {ms}
                  {i === ticks.length - 1 && "ms"}
                </span>
              ),
          )}
        </div>
        <span />
      </div>
      {rows.map((r, i) => {
        const tone = tones[i];
        if ("group" in r) {
          return (
            <div key={r.group} className="flex flex-wrap items-baseline gap-x-3 border-t border-rule pt-fl-20 pb-2">
              <span className={cn("size-2.5 self-center rounded-full bg-current", TONES[r.tone])} />
              <span className="mono-label text-ink">{r.group}</span>
              <code className="text-fl-12 text-muted">{r.pseudo}</code>
            </div>
          );
        }
        const line = curvePath(r.points);
        const p = progress(bezier(r.points), t, r.delay, r.duration);
        const v = r.value;
        return (
          <div key={`${tone}-${r.name}`} className={cn(GRID, "py-2")}>
            <div className="flex flex-col">
              <span className="text-ink">{r.name}</span>
              <span className="font-sans text-fl-14 leading-[1.4] text-muted">{r.note}</span>
            </div>
            <div className="relative h-10">
              {ticks.map((ms) => (
                <span key={ms} className="absolute inset-y-0 w-px bg-rule/60" style={{ left: pct(ms) }} />
              ))}
              <div
                className={cn("absolute inset-y-1 overflow-hidden rounded-sm bg-current/10", TONES[tone])}
                style={{ left: pct(r.delay), width: pct(r.duration) }}
              >
                <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" className="size-full">
                  <path d={`${line}L100 30L0 30Z`} className="fill-current/15" />
                  <path d={line} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              {playheadLine}
            </div>
            <div className="flex flex-col text-fl-12 leading-[1.5] text-muted">
              {live && v && (
                <span className="text-ink">
                  {v.label} {(v.from + (v.to - v.from) * p).toFixed(v.digits)}
                  {v.unit}
                </span>
              )}
              <span>
                {r.delay}–{r.delay + r.duration}ms
              </span>
              <span>{r.ease === "ease" ? "ease" : `--ease-${r.ease}`}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
