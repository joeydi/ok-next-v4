"use client";

import { useEffect, useRef } from "react";
import { NetworkRenderer } from "./renderer";
import { createNetwork, instances, type Network, type Rect, resize, STEP, step } from "./simulation";

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
 * and steer out of any `[data-network-avoid]` element in that parent. It runs while on
 * screen; under prefers-reduced-motion it draws one still frame.
 */
export function NetworkCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) return;

    const renderer = new NetworkRenderer(gl, rgb(getComputedStyle(canvas).color));
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let network: Network | undefined;
    let clock = 0;
    let pending = 0;
    let last = 0;
    let raf = 0;

    const draw = () => {
      if (network) renderer.draw(instances(network, clock, renderer.data));
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Fixed steps keep the speed the same at any refresh rate; a long gap (a
      // background tab) resumes where it left off rather than catching up.
      pending += last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
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

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
