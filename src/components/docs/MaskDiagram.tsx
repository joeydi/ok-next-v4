// The two page masks' alpha against distance from where the circle opens. The stops
// mirror the radial-gradients on ::view-transition-old/new(.page) in globals.css:
// they're geometry rather than tokens, so change both together.

const NEW_STOPS: [number, number][] = [
  [0, 1],
  [0.4, 1],
  [0.55, 0.84],
  [0.7, 0.5],
  [0.85, 0.16],
  [1, 0],
];
const OLD_STOPS: [number, number][] = [
  [0, 0],
  [0.4, 0],
  [0.7, 1],
  [1, 1],
];

const L = 48;
const R = 620;
const T = 20;
const B = 210;
const x = (r: number) => L + r * (R - L);
const y = (a: number) => B - a * (B - T);
const line = (stops: [number, number][]) => stops.map(([r, a]) => `${x(r)},${y(a)}`).join(" ");
const radius = (r: number) => (r === 1 ? "r" : r === 0 ? "0" : `${r}r`);

/** Where each page shows as the circle's radius r grows; the band is where both show. */
export function MaskDiagram() {
  return (
    <svg
      viewBox="0 0 640 262"
      role="img"
      aria-label="Mask alpha against distance from the start point. The new page is fully visible up to 0.4 r and fades to nothing at r. The old page is hidden up to 0.4 r and fully visible from 0.7 r."
      className="block h-auto w-full font-mono text-[11px]"
    >
      <rect x={x(0.4)} y={T} width={x(0.7) - x(0.4)} height={B - T} className="fill-sand" />
      <g className="stroke-rule">
        <line x1={L} x2={R} y1={y(1)} y2={y(1)} />
        <line x1={L} x2={R} y1={y(0.5)} y2={y(0.5)} />
        <line x1={x(0.4)} x2={x(0.4)} y1={T} y2={B} strokeDasharray="3 4" />
        <line x1={x(0.7)} x2={x(0.7)} y1={T} y2={B} strokeDasharray="3 4" />
      </g>
      <line x1={L} x2={R} y1={B} y2={B} className="stroke-guide" />
      <polyline points={line(OLD_STOPS)} fill="none" className="stroke-muted-light" strokeWidth={3} />
      <polyline points={line(NEW_STOPS)} fill="none" className="stroke-pink" strokeWidth={3} />
      {NEW_STOPS.slice(1).map(([r, a]) => (
        <circle key={r} cx={x(r)} cy={y(a)} r={4.5} className="fill-pink" />
      ))}
      {OLD_STOPS.slice(1, 3).map(([r, a]) => (
        <circle key={r} cx={x(r)} cy={y(a)} r={4.5} className="fill-muted-light" />
      ))}
      <text x={L + 8} y={13} className="fill-pink-ink">
        New page
      </text>
      <text x={R - 8} y={13} textAnchor="end" className="fill-muted">
        Old page
      </text>
      <g className="fill-muted">
        {[1, 0.5, 0].map((a) => (
          <text key={a} x={L - 8} y={y(a) + 4} textAnchor="end">
            {a}
          </text>
        ))}
        {NEW_STOPS.slice(1).map(([r]) => (
          <text key={r} x={x(r)} y={B + 20} textAnchor="middle">
            {radius(r)}
          </text>
        ))}
        <text x={x(0)} y={B + 20} textAnchor="middle">
          0
        </text>
        <text x={(L + R) / 2} y={254} textAnchor="middle" className="fill-ink">
          Distance from the start point → (up: mask alpha)
        </text>
      </g>
    </svg>
  );
}
