"use client";

import { useEffect, useId, useRef } from "react";
import { Stage } from "../primitives";
import { posterPath, posterSrcSet } from "./poster";
import {
  DEFAULT_SETTINGS,
  type Player,
  planeToCanvas,
  Renderer,
  type SceneDef,
  type Settings,
  type Stroke,
} from "./renderer";
import { SCENES, type SceneName } from "./scenes";

/** Drawing-buffer budget: up to 2× density, less for very large illustrations. */
const MAX_PIXELS = 2.5e6;
/** Matches the hero layouts: about half the viewport on desktop, full width below. */
const DEFAULT_SIZES = "(min-width: 1024px) 50vw, 100vw";

/** Draws a player's strokes into the SVGs under and over the canvas, reusing their paths. */
function paintStrokes(back: SVGSVGElement, front: SVGSVGElement, strokes: Stroke[]) {
  for (const [svg, side] of [
    [back, "back"],
    [front, "front"],
  ] as const) {
    strokes.forEach((s, i) => {
      const path =
        (svg.children[i] as SVGPathElement | undefined) ??
        svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path"));
      path.setAttribute("d", s[side]);
      path.setAttribute("opacity", s.opacity.toFixed(3));
    });
    while (svg.children.length > strokes.length) svg.lastChild!.remove();
  }
}

/**
 * The floor plane as an SVG matrix(): the camera is orthographic, so the iso
 * plane is a flat 2D affine map. Same matrix the renderer projects with, minus
 * the scene's `pre`, so every scene sits on the same grid.
 */
function floorMatrix(scene: SceneDef) {
  const m = planeToCanvas({ ...scene, pre: undefined }),
    z = scene.floorZ ?? 0;
  return [m[0], m[1], m[4], m[5], m[12] + m[8] * z, m[13] + m[9] * z].map((x) => +x.toFixed(4)).join(" ");
}

type Props = {
  scene: SceneName;
  className?: string;
  /** `sizes` for the poster's srcset. */
  sizes?: string;
  /** Pins the loop to this time (s) instead of running the clock. */
  time?: number;
  settings?: Settings;
};

/**
 * A WebGL illustration in the usual Stage (guides + labels). Its poster — the
 * scene's posterTime frame — is server-rendered in place, so something shows
 * at once. The renderer starts when the page is idle and the illustration is
 * near the viewport, then takes over on the poster's own frame. It stops off
 * screen; under prefers-reduced-motion, or without WebGL2, the poster stays.
 * A scene with a player (`play`) runs that instead of its loop, and takes
 * drags inside its `hitArea` once live.
 */
export function GLIllustration({ scene: name, className, sizes = DEFAULT_SIZES, time, settings }: Props) {
  const scene = SCENES[name];
  const gridId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<SVGSVGElement>(null);
  const frontRef = useRef<SVGSVGElement>(null);
  const props = useRef({ time, settings });
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    props.current = { time, settings };
    redraw.current();
  }, [time, settings]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = canvas.closest<HTMLElement>(".ok-illo")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const hit = hitRef.current;
    const back = backRef.current,
      front = frontRef.current;
    let r: Renderer | null = null;
    let player: Player | null = null;
    let loading = false,
      disposed = false,
      near = false,
      // No renderer to be had (no WebGL2, software only, or it failed to start): the poster stays for good.
      failed = false,
      // Between a lost context and its restore, when there's nothing to start a renderer on.
      lostContext = false;
    let raf = 0,
      origin = 0,
      last: number | null = null;
    let held: number | null = null;
    let cancelStart = () => {};

    const draw = (now: number) => {
      if (!r) return;
      last = now;
      const { time, settings = DEFAULT_SETTINGS } = props.current;
      // The clock starts on the poster's frame, so the hand-over doesn't jump.
      origin ||= now;
      const items =
        time === undefined && scene.play
          ? (player ??= scene.play()).frame(now / 1000)
          : scene.frame(time ?? (scene.posterTime + (now - origin) / 1000) % scene.duration);
      r.render(scene, items, settings);
      if (player?.strokes && back && front) paintStrokes(back, front, player.strokes());
      if (!("live" in box.dataset)) box.dataset.live = "";
    };
    const tick = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    const resize = () => {
      if (!r) return;
      const w = box.clientWidth;
      const dpr = Math.min(devicePixelRatio, 2, Math.sqrt(MAX_PIXELS / (w * w * (660 / 620))));
      // Resizing clears the canvas: redraw the last frame now, before the browser paints, or it flickers.
      if (r.resize(Math.round(w * dpr), Math.round(((w * 660) / 620) * dpr)) && last !== null) draw(last);
    };
    const start = () => {
      if (loading || r || failed || lostContext) return;
      loading = true;
      const go = async () => {
        let created: Renderer | null = null;
        try {
          created = await Renderer.create(canvas);
        } catch (e) {
          console.warn("Illustration stays a poster:", e);
        } finally {
          loading = false;
        }
        if (disposed) return created?.dispose();
        // An expected fallback, so it stays quiet. Nothing will start now, so stop watching.
        if (!created) {
          failed = true;
          ro.disconnect();
          io.disconnect();
          return;
        }
        r = created;
        resize();
        update();
      };
      // Idle time first, so compiling shaders doesn't compete with the page loading.
      // Safari has no requestIdleCallback.
      if (typeof window.requestIdleCallback === "function") {
        const id = requestIdleCallback(go, { timeout: 2000 });
        cancelStart = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(go, 200);
        cancelStart = () => clearTimeout(id);
      }
    };
    const update = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) {
        delete box.dataset.live;
        return;
      }
      if (!near) return;
      if (!r) return start();
      raf = requestAnimationFrame(props.current.time === undefined ? tick : draw);
    };
    redraw.current = update;

    const ro = new ResizeObserver(() => {
      resize();
      update();
    });
    ro.observe(box);
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        update();
      },
      { rootMargin: "100px" },
    );
    io.observe(box);
    reduce.addEventListener("change", update);
    // If the GPU drops the context, fall back to the poster and start over when it's back.
    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      r = null;
      lostContext = true;
      delete box.dataset.live;
    };
    const restored = () => {
      lostContext = false;
      update();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);

    // Pointer input for the player, in canvas px. The canvas's box includes the Stage's scaling.
    const at = (e: PointerEvent): [number, number] => {
      const b = canvas.getBoundingClientRect();
      return [((e.clientX - b.left) / b.width) * 620, ((e.clientY - b.top) / b.height) * 660];
    };
    const cursor = (e: PointerEvent) => {
      if (hit && e.pointerType === "mouse")
        hit.style.cursor = held !== null ? "grabbing" : player?.hover(...at(e)) ? "grab" : "";
    };
    const down = (e: PointerEvent) => {
      if (!player || held !== null || !player.down(...at(e), e.timeStamp / 1000)) return;
      e.preventDefault();
      held = e.pointerId;
      hit!.setPointerCapture(held);
      cursor(e);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === held) player?.move(...at(e), e.timeStamp / 1000);
      else if (held === null) cursor(e);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== held) return;
      held = null;
      player?.up(e.timeStamp / 1000);
      // Only a mouse hovers: a finger's done once it lifts.
      if (e.pointerType !== "mouse") player?.leave();
      cursor(e);
    };
    const leave = () => {
      if (held === null) player?.leave();
    };
    hit?.addEventListener("pointerdown", down);
    hit?.addEventListener("pointermove", move);
    hit?.addEventListener("pointerup", up);
    hit?.addEventListener("pointercancel", up);
    hit?.addEventListener("lostpointercapture", up);
    hit?.addEventListener("pointerleave", leave);

    return () => {
      if (held !== null && hit?.hasPointerCapture(held)) hit.releasePointerCapture(held);
      hit?.removeEventListener("pointerdown", down);
      hit?.removeEventListener("pointermove", move);
      hit?.removeEventListener("pointerup", up);
      hit?.removeEventListener("pointercancel", up);
      hit?.removeEventListener("lostpointercapture", up);
      hit?.removeEventListener("pointerleave", leave);
      disposed = true;
      cancelAnimationFrame(raf);
      cancelStart();
      ro.disconnect();
      io.disconnect();
      reduce.removeEventListener("change", update);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      redraw.current = () => {};
      r?.dispose();
      delete box.dataset.live;
    };
  }, [scene]);

  return (
    <Stage labels={scene.labels} guideEnd={scene.guideEnd} className={className}>
      {/* The grid, as vector under the poster and canvas: baked into the poster it was 80% of its bytes. */}
      <svg className="ok-illo-gl ok-illo-floor" viewBox="0 0 620 660" aria-hidden="true">
        <defs>
          <pattern id={gridId} width="44" height="44" x="-90" y="-90" patternUnits="userSpaceOnUse">
            <path d="M0 .5H44M.5 0V44" className="stroke-guide" />
          </pattern>
        </defs>
        <rect
          x="-1500"
          y="-1500"
          width="3300"
          height="3300"
          fill={`url(#${gridId})`}
          opacity="0.7"
          transform={`matrix(${floorMatrix(scene)})`}
        />
      </svg>
      <picture>
        <source type="image/avif" srcSet={posterSrcSet(name, "avif")} sizes={sizes} />
        {/* A plain img: the posters are pre-sized in public/, so next/image has nothing to add. */}
        <img
          className="ok-illo-gl ok-illo-poster"
          src={posterPath(name, 1240, "webp")}
          srcSet={posterSrcSet(name, "webp")}
          sizes={sizes}
          width={620}
          height={660}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      {/* A player's strokes go half under the canvas, where the scene hides them, and half over it. */}
      {scene.play && (
        <svg ref={backRef} className="ok-illo-gl ok-illo-strokes" viewBox="0 0 620 660" aria-hidden="true" />
      )}
      <canvas ref={canvasRef} className="ok-illo-gl" />
      {scene.play && (
        <svg ref={frontRef} className="ok-illo-gl ok-illo-strokes" viewBox="0 0 620 660" aria-hidden="true" />
      )}
      {scene.hitArea && (
        <div
          ref={hitRef}
          className="ok-illo-gl ok-illo-hit"
          style={{ clipPath: `polygon(${scene.hitArea.map(([x, y]) => `${x}px ${y}px`).join(", ")})` }}
        />
      )}
    </Stage>
  );
}
