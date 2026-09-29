"use client";

import { type Bezier, bezier } from "@/lib/bezier";
import { cn } from "@/lib/cn";
import { plotX, plotY } from "./CurvePlot";
import { usePlayhead } from "./playhead";
import { TONES, type Tone } from "./tone";

/** A dot on a <CurvePlot> where the doc's playhead puts an animation with this curve and timing. */
export function PlayheadDot({
  points,
  delay,
  duration,
  tone,
}: {
  points: Bezier;
  delay: number;
  duration: number;
  tone: Tone;
}) {
  const t = usePlayhead();
  const x = Math.min(1, Math.max(0, (t - delay) / duration));
  return (
    <circle
      cx={plotX(x)}
      cy={plotY(bezier(points)(x))}
      r={6}
      className={cn("fill-current stroke-paper-light", TONES[tone])}
      strokeWidth={2}
    />
  );
}
