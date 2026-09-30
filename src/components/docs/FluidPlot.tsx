import { type SizeToken, sizeAt } from "@/lib/tokens";
import { ViewportMarker } from "./ViewportMarker";

// A fluid scale's tokens as lines of px against viewport width, shared by the
// Typography doc's sizes and the Spacing doc's steps.

const r1 = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Each token's px across viewport widths: a straight line between its floor and
 * ceiling, crossing its design px at the comp width. Unused tokens are dashed, and
 * `highlight` ones drawn in pink. A marker follows the window's own width.
 */
export function FluidPlot({
  sizes,
  design,
  from,
  to,
  uses,
  label,
  highlight,
  ariaLabel,
}: {
  sizes: SizeToken[];
  design: number;
  from: number;
  to: number;
  /** How often the site uses a token. */
  uses: (t: SizeToken) => number;
  /** Its name at the line's end and in its tooltip. */
  label: (t: SizeToken) => string;
  highlight?: (t: SizeToken) => boolean;
  ariaLabel: string;
}) {
  const W = 720;
  const H = 440;
  const m = { t: 16, r: 52, b: 40, l: 52 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const d0 = from - 160;
  const d1 = to + 160;
  const top = Math.ceil(Math.max(...sizes.map((s) => s.max)) / 40) * 40;
  const x = (vw: number) => m.l + ((vw - d0) / (d1 - d0)) * iw;
  const y = (px: number) => m.t + (1 - px / top) * ih;
  const line = (t: SizeToken) =>
    [d0, from, to, d1].map((vw, i) => `${i ? "L" : "M"}${x(vw).toFixed(1)} ${y(sizeAt(t, vw)).toFixed(1)}`).join("");

  // Labels at the right end, largest first, pushed apart so they never touch.
  const GAP = 12;
  const labels = [...sizes].sort((a, b) => b.max - a.max).map((t) => ({ t, y: y(t.max) }));
  // Down from the top, then back up from the foot, so a crowd at the bottom only
  // lifts the labels it needs to.
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + GAP);
  labels[labels.length - 1].y = Math.min(labels[labels.length - 1].y, m.t + ih);
  for (let i = labels.length - 2; i >= 0; i--) labels[i].y = Math.min(labels[i].y, labels[i + 1].y - GAP);

  const ticks = [from, 768, 1024, design, to];

  return (
    // Scrolls sideways on a phone rather than shrinking its labels past reading.
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="block h-auto w-full min-w-[34rem] font-mono text-[11px]"
      >
        <rect x={x(d0)} y={m.t} width={x(from) - x(d0)} height={ih} className="fill-sand" />
        <rect x={x(to)} y={m.t} width={x(d1) - x(to)} height={ih} className="fill-sand" />
        {Array.from({ length: top / 40 + 1 }, (_, i) => i * 40).map((px) => (
          <g key={px}>
            <line x1={m.l} x2={m.l + iw} y1={y(px)} y2={y(px)} className={px ? "stroke-rule" : "stroke-guide"} />
            <text x={m.l - 8} y={y(px)} textAnchor="end" dominantBaseline="central" className="fill-muted">
              {px}px
            </text>
          </g>
        ))}
        {ticks.map((vw) => (
          <g key={vw}>
            <line
              x1={x(vw)}
              x2={x(vw)}
              y1={m.t}
              y2={m.t + ih}
              className={vw === design ? "stroke-pink" : "stroke-rule"}
              strokeDasharray={vw === design ? "6 4" : undefined}
              strokeWidth={vw === design ? 1.5 : 1}
            />
            <text
              x={x(vw)}
              y={m.t + ih + 18}
              textAnchor="middle"
              className={vw === design ? "fill-pink-ink" : "fill-muted"}
            >
              {vw}
            </text>
          </g>
        ))}
        <text x={m.l + iw} y={H - 4} textAnchor="end" className="fill-ink">
          Viewport →
        </text>
        <text x={x(design) + 6} y={m.t + 10} className="fill-pink-ink">
          Design
        </text>
        <ViewportMarker d0={d0} d1={d1} x0={m.l} x1={m.l + iw} top={m.t} bottom={m.t + ih} />
        {sizes.map((t) => {
          const n = uses(t);
          const pink = highlight?.(t);
          const title = `${label(t)}\n${r1(t.min)}px at ${from} · ${r1(sizeAt(t, design))}px at ${design} · ${r1(t.max)}px at ${to}\n${n ? `${n} ${n === 1 ? "use" : "uses"}` : "Unused"}`;
          return (
            <g key={t.name}>
              <path
                d={line(t)}
                fill="none"
                className={pink ? "stroke-pink" : n ? "stroke-ink-2" : "stroke-muted-light"}
                strokeWidth={n ? 1.5 : 1}
                strokeDasharray={n ? undefined : "4 4"}
              />
              <circle cx={x(design)} cy={y(sizeAt(t, design))} r={3} className="fill-pink" />
              <path d={line(t)} fill="none" stroke="transparent" strokeWidth={10}>
                <title>{title}</title>
              </path>
            </g>
          );
        })}
        {labels.map(({ t, y: ly }) => (
          <text
            key={t.name}
            x={m.l + iw + 8}
            y={ly}
            dominantBaseline="central"
            className={highlight?.(t) ? "fill-pink-ink" : uses(t) ? "fill-ink-2" : "fill-muted-light"}
          >
            {label(t)}
          </text>
        ))}
      </svg>
    </div>
  );
}
