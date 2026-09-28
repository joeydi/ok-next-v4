"use client";

import { useEffect, useId, useRef } from "react";
import { Stage } from "../primitives";
import { posterPath, posterSrcSet } from "./poster";
import { DEFAULT_SETTINGS, planeToCanvas, Renderer, type SceneDef, type Settings } from "./renderer";
import { SCENES, type SceneName } from "./scenes";

/** Drawing-buffer budget: up to 2× density, less for very large illustrations. */
const MAX_PIXELS = 2.5e6;
/** Matches the hero layouts: about half the viewport on desktop, full width below. */
const DEFAULT_SIZES = "(min-width: 1024px) 50vw, 100vw";

/**
 * The floor plane as an SVG matrix(): the camera is orthographic, so the iso
 * plane is a flat 2D affine map. Same matrix the renderer projects with, minus
 * the scene's `pre`, so every scene sits on the same grid.
 */
function floorMatrix(scene: SceneDef) {
  const m = planeToCanvas({ ...scene, pre: undefined }), z = scene.floorZ ?? 0;
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
 */
export function GLIllustration({ scene: name, className, sizes = DEFAULT_SIZES, time, settings }: Props) {
  const scene = SCENES[name];
  const gridId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    let r: Renderer | null = null;
    let loading = false, disposed = false, near = false;
    let raf = 0, origin = 0;
    let cancelStart = () => {};

    const draw = (now: number) => {
      if (!r) return;
      const { time, settings = DEFAULT_SETTINGS } = props.current;
      // The clock starts on the poster's frame, so the hand-over doesn't jump.
      origin ||= now;
      const t = time ?? (scene.posterTime + (now - origin) / 1000) % scene.duration;
      r.render(scene, scene.frame(t), settings);
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
      r.resize(Math.round(w * dpr), Math.round(((w * 660) / 620) * dpr));
    };
    const start = () => {
      if (loading || r) return;
      loading = true;
      const go = async () => {
        try {
          const created = await Renderer.create(canvas);
          if (disposed) return created.dispose();
          r = created;
        } catch (e) {
          console.warn("Illustration stays a poster:", e);
          return;
        } finally {
          loading = false;
        }
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
      delete box.dataset.live;
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", update);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelStart();
      ro.disconnect();
      io.disconnect();
      reduce.removeEventListener("change", update);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", update);
      redraw.current = () => {};
      r?.dispose();
      delete box.dataset.live;
    };
  }, [scene]);

  return (
    <Stage labels={scene.labels} guideEnd={scene.guideEnd} className={className}>
      {/* The grid, as vector under the poster and canvas: baked into the poster it was 80% of its bytes. */}
      <svg className="ok-illo-gl ok-illo-floor" viewBox="0 0 620 660">
        <defs>
          <pattern id={gridId} width="44" height="44" x="-90" y="-90" patternUnits="userSpaceOnUse">
            <path d="M0 .5H44M.5 0V44" stroke="#CDC0B2" />
          </pattern>
        </defs>
        <rect x="-1500" y="-1500" width="3300" height="3300" fill={`url(#${gridId})`} opacity="0.7" transform={`matrix(${floorMatrix(scene)})`} />
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
      <canvas ref={canvasRef} className="ok-illo-gl" />
    </Stage>
  );
}
