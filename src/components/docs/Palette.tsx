import { type ColorToken, colors } from "@/lib/tokens";
import { CopyValue } from "./CopyValue";
import { DocTable } from "./DocTable";

// The Palette doc's visuals, drawn from the --color-* tokens in globals.css. Every
// fill is the token itself (`var(--color-…)`), so nothing here holds a colour.

const f1 = (n: number) => n.toFixed(1);
const hslText = (t: ColorToken) => `hsl(${Math.round(t.h)} ${Math.round(t.s)}% ${Math.round(t.l)}%)`;
const fill = (name: string) => ({ fill: `var(--color-${name})` });

/** One point per distinct value: tokens with the same hex share a dot. */
function points() {
  const out: (ColorToken & { names: string[] })[] = [];
  for (const t of colors()) {
    const p = out.find((q) => q.hex === t.hex);
    if (p) p.names.push(t.name);
    else out.push({ ...t, names: [t.name] });
  }
  return out;
}

/**
 * Every token as a swatch, in the doc's groups; any token not in a group shows under
 * "Other", so a new one can't go missing. Clicking a swatch copies its hex.
 *   <Swatches groups={{ Paper: ["paper", "sand"], Accent: ["pink"] }} />
 */
export function Swatches({ groups }: { groups: Record<string, string[]> }) {
  const all = colors();
  const grouped = new Set(Object.values(groups).flat());
  const other = all.filter((t) => !grouped.has(t.name)).map((t) => t.name);
  const sections = Object.entries(other.length ? { ...groups, Other: other } : groups);

  return (
    <div className="doc-wide flex flex-col gap-fl-40">
      <p className="mono-label text-muted">
        {all.length} tokens · {points().length} distinct values · src/app/globals.css
      </p>
      {sections.map(([title, names]) => (
        <section key={title} className="flex flex-col gap-fl-16">
          <h3 className="mono-label text-ink">{title}</h3>
          <div className="grid grid-cols-2 gap-fl-24 sm:grid-cols-3 xl:grid-cols-5">
            {names.map((name) => {
              const t = all.find((c) => c.name === name);
              if (!t) throw new Error(`Swatches: no --color-${name} in globals.css`);
              const twin = all.find((o) => o.hex === t.hex && o.name !== name);
              return (
                <div key={name} className="flex min-w-0 flex-col gap-2">
                  <CopyValue
                    value={t.hex}
                    className={`flex h-24 items-end rounded-lg border border-ink/10 p-3 font-mono text-fl-14 ${t.onPaper > t.onInk ? "text-paper" : "text-ink"}`}
                    style={{ background: `var(--color-${name})` }}
                  >
                    Aa {f1(Math.max(t.onPaper, t.onInk))}
                  </CopyValue>
                  <div className="font-mono text-fl-14 text-ink">--color-{name}</div>
                  <div className="flex flex-col font-mono text-fl-12 leading-[1.6] text-muted">
                    <span>
                      {t.hex} · {hslText(t)}
                    </span>
                    <span>
                      paper {f1(t.onPaper)}:1 · ink {f1(t.onInk)}:1
                    </span>
                    {twin && <span className="text-pink-ink">Same value as {twin.name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Every token with its HSL and contrast, lightest first. Contrast under 4.5:1 is marked. */
export function PaletteTable() {
  const bar = (v: number) => (
    <span className="ml-2 inline-block h-1 w-12 bg-rule align-middle">
      <span className="block h-full bg-ink-2" style={{ width: `${v}%` }} />
    </span>
  );
  const ratio = (r: number) => <span className={r < 4.5 ? "text-pink-ink" : undefined}>{f1(r)}:1</span>;
  return (
    <DocTable
      columns={[
        { label: "Token" },
        { label: "Hex" },
        { label: "H", align: "end" },
        { label: "S", align: "end" },
        { label: "L", align: "end" },
        { label: "On paper", align: "end" },
        { label: "On ink", align: "end" },
      ]}
      rows={[...colors()]
        .sort((a, b) => b.l - a.l)
        .map((t) => [
          <span key="t" className="flex items-center gap-2 whitespace-nowrap">
            <span
              className="size-3 shrink-0 rounded-[2px] border border-ink/10"
              style={{ background: `var(--color-${t.name})` }}
            />
            --color-{t.name}
          </span>,
          t.hex,
          `${f1(t.h)}°`,
          <span key="s" className="whitespace-nowrap">
            {f1(t.s)}%{bar(t.s)}
          </span>,
          <span key="l" className="whitespace-nowrap">
            {f1(t.l)}%{bar(t.l)}
          </span>,
          ratio(t.onPaper),
          ratio(t.onInk),
        ])}
    />
  );
}

// ---------- Charts ----------

/** A label for a mark at x, y. `r` is the mark's radius: 7 for the palette's dots. */
type Placed = { x: number; y: number; text: string; r?: number };
const CHAR = 6.6; // advance of 11px Plex Mono
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
type Box = { x: number; y: number; w: number; h: number };

/** Puts each label on the first side of its mark that clears every mark, label and edge. Labels are 11px Plex Mono. */
export function placeLabels(items: Placed[], bounds: Box) {
  const taken: Box[] = items.map(({ x, y, r = 7 }) => ({ x: x - r - 2, y: y - r - 2, w: 2 * r + 4, h: 2 * r + 4 }));
  const out: { x: number; y: number; text: string }[] = [];
  for (const it of items) {
    const w = it.text.length * CHAR;
    const h = 14;
    // The offsets below fit a 7px dot; a bigger mark pushes its label out by the difference.
    const d = (it.r ?? 7) - 7;
    const spots = [
      [it.x + 12 + d, it.y - h / 2],
      [it.x - 12 - d - w, it.y - h / 2],
      [it.x + 8 + d, it.y - 22 - d],
      [it.x + 8 + d, it.y + 8 + d],
      [it.x - 8 - d - w, it.y - 22 - d],
      [it.x - 8 - d - w, it.y + 8 + d],
      [it.x - w / 2, it.y - 26 - d],
      [it.x - w / 2, it.y + 12 + d],
    ];
    for (const [x, y] of spots) {
      const box = { x, y, w, h };
      const inside = x >= bounds.x && y >= bounds.y && x + w <= bounds.x + bounds.w && y + h <= bounds.y + bounds.h;
      if (inside && !taken.some((t) => overlaps(t, box))) {
        taken.push(box);
        out.push({ x, y: y + h / 2, text: it.text });
        break;
      }
    }
  }
  return out;
}

function Dot({ p, x, y }: { p: ReturnType<typeof points>[number]; x: number; y: number }) {
  return (
    <circle cx={x} cy={y} r={7} style={fill(p.names[0])} className="stroke-ink/25" strokeWidth={1}>
      <title>{`${p.names.map((n) => `--color-${n}`).join(" = ")}\n${p.hex} · ${hslText(p)}`}</title>
    </circle>
  );
}

function Labels({ items }: { items: { x: number; y: number; text: string }[] }) {
  return items.map((l) => (
    <text key={l.text} x={l.x} y={l.y} dominantBaseline="central" className="fill-ink-2">
      {l.text}
    </text>
  ));
}

/** Saturation against lightness, over the rule the neutrals are set from: 10% + 35% × (1 − √(1 − L²)). */
export function SaturationPlot() {
  const W = 560;
  const H = 420;
  const m = { t: 30, r: 12, b: 44, l: 58 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const x = (s: number) => m.l + (s / 100) * iw;
  const y = (l: number) => m.t + (1 - l / 100) * ih;
  const rule = (l: number) => 10 + 35 * (1 - Math.sqrt(1 - (l / 100) ** 2));
  const curve = Array.from({ length: 101 }, (_, l) => `${l ? "L" : "M"}${x(rule(l)).toFixed(1)} ${y(l).toFixed(1)}`);
  const items = points().map((p) => ({ p, x: x(p.s), y: y(p.l), text: p.names.join(" = ") }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Scatter plot of saturation against lightness for each colour token"
      className="block h-auto w-full font-mono text-[11px]"
    >
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v} className={v ? "stroke-rule" : "stroke-guide"}>
          <line x1={x(v)} x2={x(v)} y1={m.t} y2={m.t + ih} />
          <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} />
          <text x={x(v)} y={m.t + ih + 18} textAnchor="middle" className="fill-muted stroke-none">
            {v}%
          </text>
          <text x={m.l - 8} y={y(v)} textAnchor="end" dominantBaseline="central" className="fill-muted stroke-none">
            {v}%
          </text>
        </g>
      ))}
      <text x={m.l + iw} y={H - 4} textAnchor="end" className="fill-ink">
        Saturation →
      </text>
      <text x={-(m.t + ih)} y={12} transform="rotate(-90)" className="fill-ink">
        Lightness →
      </text>
      <path d={curve.join("")} fill="none" className="stroke-pink" strokeWidth={2} strokeDasharray="6 4" />
      {items.map((it) => (
        <Dot key={it.p.hex} p={it.p} x={it.x} y={it.y} />
      ))}
      <Labels items={placeLabels(items, { x: m.l + 2, y: 0, w: iw + m.r - 2, h: m.t + ih - 2 })} />
    </svg>
  );
}

/** Hue as angle and saturation as distance from the centre, with the neutrals' wedge shaded. */
export function HueWheel() {
  const W = 460;
  const pad = 34;
  const R = W / 2 - pad;
  const c = W / 2;
  const polar = (hue: number, r: number) => [
    c + r * Math.sin((hue * Math.PI) / 180),
    c - r * Math.cos((hue * Math.PI) / 180),
  ];
  const all = points();
  const neutrals = all.filter((p) => !p.names[0].startsWith("pink"));
  const h0 = Math.min(...neutrals.map((p) => p.h));
  const h1 = Math.max(...neutrals.map((p) => p.h));
  const rw = (Math.max(...neutrals.map((p) => p.s)) / 100) * R + 12;
  const [ax, ay] = polar(h0 - 1.5, rw);
  const [bx, by] = polar(h1 + 1.5, rw);
  const items = all.map((p) => {
    const [x, y] = polar(p.h, (p.s / 100) * R);
    return { p, x, y, text: p.names.join(" = ") };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${W}`}
      role="img"
      aria-label="Hue wheel: angle is hue, distance from the centre is saturation"
      className="mx-auto block h-auto w-full max-w-[460px] font-mono text-[11px]"
    >
      {[25, 50, 75, 100].map((s) => (
        <circle
          key={s}
          cx={c}
          cy={c}
          r={(s / 100) * R}
          fill="none"
          className={s === 100 ? "stroke-guide" : "stroke-rule"}
        />
      ))}
      {Array.from({ length: 12 }, (_, i) => i * 30).map((h) => {
        const [x2, y2] = polar(h, R);
        const [tx, ty] = polar(h, R + 20);
        return (
          <g key={h}>
            <line x1={c} y1={c} x2={x2} y2={y2} className="stroke-rule" />
            {h % 90 === 0 && (
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className="fill-muted">
                {h}°
              </text>
            )}
          </g>
        );
      })}
      {[50, 100].map((s) => {
        const [tx, ty] = polar(225, (s / 100) * R);
        return (
          <text key={s} x={tx - 4} y={ty + 4} textAnchor="end" dominantBaseline="hanging" className="fill-muted">
            {s}%
          </text>
        );
      })}
      <path d={`M${c} ${c} L${ax} ${ay} A${rw} ${rw} 0 0 1 ${bx} ${by}Z`} className="fill-pink/10 stroke-pink/40" />
      {items.map((it) => (
        <Dot key={it.p.hex} p={it.p} x={it.x} y={it.y} />
      ))}
      {/* The neutrals sit too close together to label here; the pinks get labels. */}
      <Labels
        items={placeLabels(
          items.filter((it) => it.p.names[0].startsWith("pink")),
          { x: 0, y: 0, w: W, h: W },
        )}
      />
    </svg>
  );
}
