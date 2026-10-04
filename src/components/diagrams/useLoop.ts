"use client";

import { useEffect, useRef, useState } from "react";

const SETTLE = 0.6; // s: how quickly a throw's speed eases back to playback speed (time constant)
const MAX_RATE = 24; // the fastest throw, in loop seconds per second

/** A loop's clock as the jog wheel drives it (see Jog.tsx). */
export type LoopJog = {
  time: number;
  duration: number;
  /** Take hold of the clock: it stops until `release`. */
  grab: () => void;
  /** Move the clock by `ds` seconds, either way. */
  scrub: (ds: number) => void;
  /** Let go at `rate` (loop seconds per second, negative to run back), which eases back to 1. */
  release: (rate: number) => void;
};

const wrap = (t: number, d: number) => ((t % d) + d) % d;

/**
 * A diagram's clock: seconds into a `duration`-second loop, running only while
 * the element on `ref` is near the viewport. Under prefers-reduced-motion it
 * holds at `still`, which is also the server-rendered frame. A `time` pins it
 * there instead, for the diagram lab's scrubber. The third value hands the clock
 * to a jog wheel, which can hold it, scrub it and throw it; it's undefined when
 * the clock is pinned.
 */
export function useLoop<T extends Element>(
  duration: number,
  { still = 0, time }: { still?: number; time?: number } = {},
) {
  const pinned = time !== undefined;
  const ref = useRef<T>(null);
  const [clock, setTime] = useState(still);
  // The wheel's hold on the clock, read by the frame loop. Under reduced motion there's no frame
  // loop, so a scrub moves the clock and a throw does nothing.
  const hand = useRef({ held: false, rate: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el || pinned) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0,
      last = 0,
      near = false;
    const tick = (now: number) => {
      // Read the step now: the updater may run after `last` moves on.
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const h = hand.current;
      let step = 0;
      if (!h.held) {
        // Ease the speed back to 1 and step by the average across the frame, so a throw's
        // distance doesn't depend on the frame rate.
        const k = Math.exp(-dt / SETTLE);
        step = dt + (h.rate - 1) * SETTLE * (1 - k);
        h.rate = 1 + (h.rate - 1) * k;
      }
      setTime((t) => wrap(t + step, duration));
      raf = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (reduce.matches) setTime(still);
      else if (near) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        update();
      },
      { rootMargin: "100px" },
    );
    io.observe(el);
    reduce.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      reduce.removeEventListener("change", update);
    };
  }, [duration, still, pinned]);

  const jog: LoopJog | undefined = pinned
    ? undefined
    : {
        time: clock,
        duration,
        grab: () => {
          hand.current.held = true;
        },
        scrub: (ds) => setTime((t) => wrap(t + ds, duration)),
        release: (rate) => {
          hand.current = { held: false, rate: Math.max(-MAX_RATE, Math.min(MAX_RATE, rate)) };
        },
      };

  return [ref, time ?? clock, jog] as const;
}
