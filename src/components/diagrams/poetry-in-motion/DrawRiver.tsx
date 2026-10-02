"use client";

import { type PointerEvent, useEffect, useState } from "react";
import { type Bezier, bezier } from "@/lib/bezier";
import { cn } from "@/lib/cn";
import { type Bank, bankPath, fitBank, mixBanks } from "./river";

// Draw a river: a panel down the side of the diagram showing one period of the
// float's bank, dotted. Draw a line down it and, on release (or where it crosses
// the bottom edge), the line is smoothed into whole-period sines with its ends
// matched (see fitBank), and the river morphs to it. Narrow, it folds into a
// pencil button that opens it over the diagram. It sits over the diagram's
// surface, not in it, so it stays at its own size and reachable by keyboard.

const MORPH = 800; // ms
const EASE = "--ease-out-expo";

type Point = [number, number];

/** The token's curve, read from the page. */
function easeToken(name: string) {
  const css = getComputedStyle(document.documentElement).getPropertyValue(name);
  return bezier((css.match(/-?[\d.]+/g) ?? []).map(Number) as unknown as Bezier);
}

/** The bank `set` last asked for, morphing to it from wherever it was. Returns [now, set, target]. */
export function useBankMorph(initial: Bank) {
  const [morph, setMorph] = useState({ from: initial, to: initial, at: 0, ease: (k: number) => k });
  const [now, setNow] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      setNow(t);
      if (t - morph.at < MORPH) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [morph]);

  const k = Math.min(1, Math.max(0, (now - morph.at) / MORPH));
  const current = k >= 1 ? morph.to : mixBanks(morph.from, morph.to, morph.ease(k));
  const set = (to: Bank) => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMorph({
      from: current,
      to,
      at: reduce ? Number.NEGATIVE_INFINITY : performance.now(),
      ease: easeToken(EASE),
    });
  };
  return [current, set, morph.to] as const;
}

/** The panel, absolutely placed: give it a positioned `@container` parent the diagram's size. */
export function DrawRiver({
  bank,
  custom,
  onDraw,
  onReset,
}: {
  bank: Bank;
  /** Whether the bank is a drawn one, for the reset. */
  custom: boolean;
  onDraw: (b: Bank) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [[w, h], setSize] = useState([0, 0]);

  useEffect(() => {
    if (!box) return;
    const ro = new ResizeObserver(([e]) => setSize([e.contentRect.width, e.contentRect.height]));
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);

  const finish = (points: Point[]) => {
    const b = fitBank(points);
    if (b) {
      onDraw(b);
      setOpen(false);
    }
    setStroke(null);
  };
  /** The pointer as [x, y] shares of the box, y unclamped so a cut at the bottom can be seen. */
  const point = (e: PointerEvent<HTMLDivElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.max(0, (e.clientY - r.top) / r.height)];
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Draw a river"
        className={cn(
          "frame absolute top-3 left-3 grid size-9 place-items-center bg-paper-light text-[18px] text-ink @2xl:hidden",
          open && "hidden",
        )}
      >
        <Pencil />
      </button>
      <div
        className={cn(
          "frame absolute inset-y-2 left-2 w-32 select-none flex-col gap-2 bg-paper-light p-2 @2xl:inset-y-5 @2xl:left-5 @2xl:flex @2xl:w-48 @2xl:gap-3 @2xl:p-3.5",
          open ? "flex" : "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-2 font-mono font-semibold text-[12px] text-ink leading-5">
          <span className="hidden @2xl:inline">Draw a river</span>
          <button
            type="button"
            onClick={onReset}
            disabled={!custom}
            className="rounded-[5px] border border-rule bg-paper px-1.5 py-px font-normal text-[11px] text-muted leading-4 tracking-label-tight enabled:hover:border-ink enabled:hover:text-ink disabled:opacity-40"
          >
            reset
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[18px] @2xl:hidden">
            <Close />
          </button>
        </div>
        <div
          ref={setBox}
          aria-hidden="true"
          className="relative flex-1 cursor-crosshair touch-none rounded-[3px] border border-ink/15 bg-paper"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setStroke([point(e)]);
          }}
          onPointerMove={(e) => {
            if (!stroke) return;
            const [x, y] = point(e);
            // Past the bottom edge: cut the line there.
            if (y >= 1) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              finish([...stroke, [x, 1]]);
            } else setStroke([...stroke, [x, y]]);
          }}
          onPointerUp={() => stroke && finish(stroke)}
          onPointerCancel={() => setStroke(null)}
        >
          {w > 0 && (
            <svg aria-hidden="true" className="absolute inset-0" width={w} height={h}>
              <path d={`${bankPath(w, h, bank)}L0 ${h}L0 0Z`} className="fill-pink/10" />
              <path
                d={bankPath(w, h, bank)}
                fill="none"
                className="stroke-pink"
                strokeWidth="2"
                strokeDasharray="0.1 5"
                strokeLinecap="round"
              />
              {stroke && stroke.length > 1 && (
                <polyline
                  points={stroke.map(([x, y]) => `${x * w},${y * h}`).join(" ")}
                  fill="none"
                  className="stroke-ink"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          )}
        </div>
        <span className="hidden font-mono text-[11px] text-muted leading-4 tracking-label-tight @2xl:inline">
          ↓ top to bottom
        </span>
      </div>
    </>
  );
}

/** Edit (Material Symbols, rounded fill), sized to the text. */
function Pencil() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[1em]">
      <path
        fill="currentColor"
        d="M4 21q-.425 0-.712-.288T3 20v-2.425q0-.4.15-.763t.425-.637L16.2 3.575q.3-.275.663-.425t.762-.15.775.15.65.45L20.425 5q.3.275.437.65T21 6.4q0 .4-.138.763t-.437.662l-12.6 12.6q-.275.275-.637.425t-.763.15zM17.6 7.8 19 6.4 17.6 5l-1.4 1.4z"
      />
    </svg>
  );
}

/** Close (Material Symbols, rounded fill), sized to the text. */
function Close() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[1em]">
      <path
        fill="currentColor"
        d="m12 13.4-4.9 4.9q-.275.275-.7.275t-.7-.275-.275-.7.275-.7l4.9-4.9-4.9-4.9q-.275-.275-.275-.7t.275-.7.7-.275.7.275l4.9 4.9 4.9-4.9q.275-.275.7-.275t.7.275.275.7-.275.7L13.4 12l4.9 4.9q.275.275.275.7t-.275.7-.7.275-.7-.275z"
      />
    </svg>
  );
}
