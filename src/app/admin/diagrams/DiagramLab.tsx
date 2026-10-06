"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { DIAGRAMS, type DiagramEntry, type Nudge } from "./registry";

// Every diagram (see registry.tsx), each on its own clock with
// play/pause, a scrubber and speeds, at the width a note shows it. A diagram that
// fine-tunes its registration by eye also gets a nudge, to copy back into its code.

export function DiagramLab() {
  return (
    <div className="pt-fl-56 pb-fl-96 font-mono text-[12px]">
      <header className="mb-fl-32 flex flex-col gap-fl-8 border-rule border-b pb-fl-24">
        <span className="mono-label text-muted">/ Admin · dev only</span>
        <h1 className="display text-fl-48 leading-heading-48 tracking-display-48">Diagrams</h1>
        <p className="font-mono text-fl-14 text-muted">
          {DIAGRAMS.length} {DIAGRAMS.length === 1 ? "diagram" : "diagrams"}
        </p>
      </header>
      <div className="flex flex-col gap-fl-56">
        {DIAGRAMS.map((d) => (
          <Entry key={`${d.href}/${d.title}`} entry={d} />
        ))}
      </div>
    </div>
  );
}

const NUDGE_RANGE = 40; // px either way

function Entry({ entry: { href, title, loop, nudge: initial, render } }: { entry: DiagramEntry }) {
  const [playing, setPlaying] = useState(true);
  const [nudge, setNudge] = useState(initial);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      // Read the step now: the updater may run after `last` moves on.
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setTime((t) => (t + dt) % loop);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, loop]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="mono-label text-ink">
        {title} ·{" "}
        <Link href={href} className="text-pink-ink">
          {href}
        </Link>
      </h2>
      <div className="flex flex-col gap-2">
        <Row label="Time">
          <Toggle on={playing} onClick={() => setPlaying(!playing)}>
            {playing ? "Pause" : "Play"}
          </Toggle>
          <input
            type="range"
            min={0}
            max={loop}
            step={0.01}
            value={time}
            onChange={(e) => {
              setPlaying(false);
              setTime(+e.target.value);
            }}
            className="w-48"
          />
          <span className="w-12 tabular-nums">{time.toFixed(2)}s</span>
        </Row>
        <Row label="Speed">
          {[0.25, 0.5, 1, 2].map((s) => (
            <Toggle key={s} on={s === speed} onClick={() => setSpeed(s)}>
              {s}×
            </Toggle>
          ))}
        </Row>
        {initial && nudge && (
          <Row label="Nudge">
            {(["x", "y"] as const).map((axis, i) => (
              <label key={axis} className="flex items-center gap-2">
                {axis}
                <input
                  type="range"
                  min={-NUDGE_RANGE}
                  max={NUDGE_RANGE}
                  step={1}
                  value={nudge[i]}
                  onChange={(e) => {
                    const next: Nudge = [...nudge];
                    next[i] = +e.target.value;
                    setNudge(next);
                  }}
                  className="w-32"
                />
              </label>
            ))}
            <span className="tabular-nums">
              [{nudge[0]}, {nudge[1]}]
            </span>
            <Toggle on={false} onClick={() => setNudge(initial)}>
              Reset
            </Toggle>
          </Row>
        )}
      </div>
      {/* About a wide note figure's width at 1440. */}
      <div className="max-w-280">{render(time, nudge)}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-muted">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1",
        on ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}
