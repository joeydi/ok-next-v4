"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A diagram's clock: seconds into a `duration`-second loop, running only while
 * the element on `ref` is near the viewport. Under prefers-reduced-motion it
 * holds at `still`, which is also the server-rendered frame. A `time` pins it
 * there instead, for the diagram lab's scrubber.
 */
export function useLoop<T extends Element>(
  duration: number,
  { still = 0, time }: { still?: number; time?: number } = {},
) {
  const pinned = time !== undefined;
  const ref = useRef<T>(null);
  const [clock, setTime] = useState(still);

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
      setTime((t) => (t + dt) % duration);
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

  return [ref, time ?? clock] as const;
}
