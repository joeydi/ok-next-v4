"use client";

import { useEffect, useRef } from "react";
import { NetworkRenderer } from "./renderer";
import { createNetwork, instances, type Network, type Rect, resize, STEP, step } from "./simulation";

/** How long after its last move the pointer still counts as moving (ms). */
const MOVING = 100;

/** Any CSS colour as 0–1 sRGB, by painting a pixel with it. */
function rgb(color: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/**
 * Canvas that fills its positioned parent. Nodes and lines take the canvas's text colour,
 * steer out of any `[data-network-avoid]` element in that parent, and gather around the
 * pointer. It runs while on screen; under prefers-reduced-motion it draws one still frame.
 * Without hardware WebGL2 it stays empty.
 */
export function NetworkCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    // Software rendering counts as none: drawn on the CPU, the loop pins the main thread.
    const gl = canvas.getContext("webgl2", { antialias: false, failIfMajorPerformanceCaveat: true });
    if (!gl) return;

    const renderer = new NetworkRenderer(gl, rgb(getComputedStyle(canvas).color));
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let network: Network | undefined;
    let clock = 0;
    let pending = 0;
    let last = 0;
    let raf = 0;
    /** The pointer in client px, while it's over the page (or a finger is down). */
    let client: [number, number] | null = null;
    /** When it last moved (ms); it counts as moving for a beat after, to bridge gaps between events. */
    let movedAt = Number.NEGATIVE_INFINITY;

    const draw = () => {
      if (network) renderer.draw(instances(network, clock, renderer.data));
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Fixed steps keep the speed the same at any refresh rate; a long gap (a
      // background tab) resumes where it left off rather than catching up.
      pending += last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (network) {
        const r = canvas.getBoundingClientRect();
        const over =
          client && client[0] >= r.left && client[0] <= r.right && client[1] >= r.top && client[1] <= r.bottom;
        network.pointer = client && over ? [client[0] - r.left, client[1] - r.top] : null;
        network.moving = now - movedAt < MOVING;
      }
      for (; pending >= STEP; pending -= STEP) {
        clock += STEP;
        if (network) step(network, clock);
      }
      draw();
    };

    const targets = [...(canvas.parentElement?.querySelectorAll("[data-network-avoid]") ?? [])];

    // Also runs when an avoided element reflows (e.g. once the web fonts load).
    const ro = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      const { width, height } = bounds;
      const dpr = Math.min(devicePixelRatio, 2);
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        renderer.resize(dpr);
      }

      const avoid = targets.map((el): Rect => {
        const r = el.getBoundingClientRect();
        return [r.left - bounds.left, r.top - bounds.top, r.right - bounds.left, r.bottom - bounds.top];
      });
      // Stills skip the nodes' staggered arrival.
      if (network) resize(network, width, height, avoid, clock);
      else network = createNetwork(width, height, avoid, !still);
      draw();
    });
    ro.observe(canvas);
    for (const el of targets) ro.observe(el);

    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      last = 0;
      if (entry.isIntersecting && !still) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    // The canvas lets pointer events through to the text, so watch the window.
    const track = (e: PointerEvent) => {
      client = [e.clientX, e.clientY];
      movedAt = e.timeStamp;
    };
    const release = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") client = null;
    };
    const clear = () => {
      client = null;
    };
    const root = document.documentElement;
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerdown", track, { passive: true });
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", clear);
    window.addEventListener("blur", clear);
    root.addEventListener("pointerleave", clear);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerdown", track);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", clear);
      window.removeEventListener("blur", clear);
      root.removeEventListener("pointerleave", clear);
      ro.disconnect();
      io.disconnect();
      renderer.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
