"use client";

import { type ComponentProps, type PointerEvent, useEffect, useEffectEvent, useRef } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_DOCK, type DockSettings, dockTargets, dockTransforms, stepSpring } from "./dock";
import { LOGO_LETTERS, LOGO_VIEWBOX } from "./letters";

type Anim = { px: number | null; lastPx: number; s: number[]; v: number[]; raf: number; last: number };

/**
 * The wordmark with a macOS dock swell: letters near a mouse pointer grow on springs
 * and push their neighbours aside (see dock.ts). It draws past its box rather than
 * reflowing the nav. Touch and reduced motion get the still logo. `settings` is for
 * the admin lab; the site uses DEFAULT_DOCK.
 */
export function DockLogo({
  settings = DEFAULT_DOCK,
  className,
  ...props
}: ComponentProps<"svg"> & { settings?: DockSettings }) {
  const svg = useRef<SVGSVGElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const settingsRef = useRef(settings);
  const anim = useRef<Anim>({ px: null, lastPx: 0, s: [], v: [], raf: 0, last: 0 });

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []);

  // The logo can miss its pointerleave: a page transition covers the page with its
  // snapshots, so moving off the logo mid-transition never reaches it. While it's
  // swollen, any move outside its box (or leaving the window) lets it go too.
  const watch = useEffectEvent((e: globalThis.PointerEvent | FocusEvent) => {
    if (anim.current.px === null) return;
    const r = svg.current?.getBoundingClientRect();
    if (
      !r ||
      !("clientX" in e) ||
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    ) {
      leave();
    }
  });

  useEffect(() => {
    window.addEventListener("pointermove", watch, { passive: true });
    window.addEventListener("blur", watch);
    return () => {
      window.removeEventListener("pointermove", watch);
      window.removeEventListener("blur", watch);
    };
  }, []);

  function tick(now: number) {
    const a = anim.current;
    const s = settingsRef.current;
    const dt = Math.min((now - a.last) / 1000, 1 / 30);
    a.last = now;
    const targets = dockTargets(a.px, s);
    let moving = a.px !== null;
    for (let i = 0; i < targets.length; i++) {
      [a.s[i], a.v[i]] = stepSpring(a.s[i], a.v[i], targets[i], dt, s);
      if (Math.abs(a.s[i] - 1) > 1e-4 || Math.abs(a.v[i]) > 1e-3) moving = true;
    }
    if (!moving) {
      for (const p of paths.current) p?.removeAttribute("transform");
      a.raf = 0;
      return;
    }
    const transforms = dockTransforms(a.s, a.lastPx, s);
    paths.current.forEach((p, i) => {
      p?.setAttribute("transform", transforms[i]);
    });
    a.raf = requestAnimationFrame(tick);
  }

  function start() {
    const a = anim.current;
    if (a.raf) return;
    if (a.s.length === 0) {
      a.s = LOGO_LETTERS.map(() => 1);
      a.v = LOGO_LETTERS.map(() => 0);
    }
    a.last = performance.now();
    a.raf = requestAnimationFrame(tick);
  }

  function move(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const a = anim.current;
    a.px = ((e.clientX - r.left) / r.width) * LOGO_VIEWBOX.w;
    a.lastPx = a.px;
    start();
  }

  function leave() {
    if (anim.current.px === null) return;
    anim.current.px = null;
    start();
  }

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
      role="img"
      aria-label="okayplus"
      onPointerMove={move}
      onPointerLeave={leave}
      {...props}
      className={cn("h-6 w-auto overflow-visible lg:h-7", className)}
    >
      {LOGO_LETTERS.map((l, i) => (
        <path
          key={l.char}
          ref={(el) => {
            paths.current[i] = el;
          }}
          fill="currentColor"
          d={l.d}
        />
      ))}
    </svg>
  );
}
