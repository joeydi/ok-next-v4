import type { ReactNode } from "react";
import type { Bezier } from "@/lib/bezier";
import { TONES, type Tone } from "./tone";

// Plot of one or two easing curves: progress (up) against time (across), with the
// control handles, and linear dashed behind for comparison. No hooks, so a server
// component can draw it and a client one can overlay dots that move (<PlayheadDot>).

const S = 200;
const PAD = { l: 28, t: 10, r: 12, b: 28 };

/** Plot coordinates for time `x` and progress `y`, both 0–1. */
export const plotX = (x: number) => PAD.l + x * S;
export const plotY = (y: number) => PAD.t + (1 - y) * S;

export function CurvePlot({
  curves,
  end = "time →",
  label,
  children,
}: {
  curves: { points: Bezier; tone?: Tone }[];
  /** Label at the end of the time axis, like "800ms". */
  end?: string;
  /** Accessible name: the curve's title and value. */
  label: string;
  children?: ReactNode;
}) {
  const quarters = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg
      viewBox={`0 0 ${PAD.l + S + PAD.r} ${PAD.t + S + PAD.b}`}
      role="img"
      aria-label={label}
      className="block h-auto w-full font-mono text-[10px]"
    >
      <g className="stroke-rule" strokeWidth={1}>
        {quarters.map((v) => (
          <g key={v}>
            <line x1={plotX(0)} x2={plotX(1)} y1={plotY(v)} y2={plotY(v)} />
            <line x1={plotX(v)} x2={plotX(v)} y1={plotY(0)} y2={plotY(1)} />
          </g>
        ))}
      </g>
      <rect x={plotX(0)} y={plotY(1)} width={S} height={S} fill="none" className="stroke-guide" />
      <line
        x1={plotX(0)}
        y1={plotY(0)}
        x2={plotX(1)}
        y2={plotY(1)}
        className="stroke-muted-light"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <g className="fill-muted">
        <text x={plotX(0) - 8} y={plotY(1) + 4} textAnchor="end">
          1
        </text>
        <text x={plotX(0) - 8} y={plotY(0) + 4} textAnchor="end">
          0
        </text>
        <text x={plotX(0)} y={plotY(0) + 18}>
          0
        </text>
        <text x={plotX(1)} y={plotY(0) + 18} textAnchor="end">
          {end}
        </text>
      </g>
      {curves.map(({ points: [x1, y1, x2, y2], tone = "pink" }, i) => (
        <g key={i} className={TONES[tone]}>
          <path
            d={`M${plotX(0)} ${plotY(0)}L${plotX(x1)} ${plotY(y1)}M${plotX(1)} ${plotY(1)}L${plotX(x2)} ${plotY(y2)}`}
            className="stroke-muted"
            strokeWidth={1}
          />
          <path
            d={`M${plotX(0)} ${plotY(0)}C${plotX(x1)} ${plotY(y1)} ${plotX(x2)} ${plotY(y2)} ${plotX(1)} ${plotY(1)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {[
            [x1, y1],
            [x2, y2],
          ].map(([x, y]) => (
            <circle
              key={`${x},${y}`}
              cx={plotX(x)}
              cy={plotY(y)}
              r={4.5}
              className="fill-paper-light stroke-ink"
              strokeWidth={1.5}
            />
          ))}
        </g>
      ))}
      <circle cx={plotX(0)} cy={plotY(0)} r={3} className="fill-ink" />
      <circle cx={plotX(1)} cy={plotY(1)} r={3} className="fill-ink" />
      {children}
    </svg>
  );
}
