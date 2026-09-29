"use client";

import { useEffect, useRef } from "react";
import { NetworkRenderer } from "./renderer";
import { createNetwork, instances, type Network, SETTLED, STEP, step } from "./simulation";

/** Any CSS colour as 0–1 sRGB, by painting a pixel with it. */
function rgb(color: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/**
 * Canvas that fills its positioned parent. Nodes and lines take the canvas's text colour.
 * It runs while on screen; under prefers-reduced-motion it draws one still frame.
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
    // Stills skip the nodes' staggered arrival.
    let clock = still ? SETTLED : 0;
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

    const ro = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      renderer.resize(dpr);
      if (network) Object.assign(network, { width, height });
      else network = createNetwork(width, height);
      draw();
    });
    ro.observe(canvas);

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
