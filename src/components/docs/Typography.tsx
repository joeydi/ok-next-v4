import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fonts, leadings, trackings, typeScale } from "@/lib/tokens";
import { DocFacts } from "./DocTable";
import { FluidPlot } from "./FluidPlot";
import { placeLabels } from "./Palette";
import { type Face, type TypeStyle, typeStyles } from "./typeUsage";

// The Typography doc's visuals: the --font-*, --tracking-* and --text-fl-* tokens,
// read from globals.css and fluid.css, and the styles the site builds from them,
// found by scanning its source (typeUsage.ts). Every sample is set in the tokens
// themselves (`var(--text-fl-…)`), so it follows an edit to the CSS.

const SPECIMEN = "Hamburgefonstiv";
const PARAGRAPH =
  "Body copy sets a comfortable measure so a paragraph reads easily at every width, and the leading shows once it wraps onto a second line.";
const HEADING = "A heading long enough to wrap";
const CODE = ".river {\n  float: left;\n  shape-outside: url(/river.png);\n}";
const WEIGHT_NAMES: Record<number, string> = { 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold" };

const r1 = (n: number) => String(Math.round(n * 10) / 10);
// Code is set in the mono face.
const faceStyle = (face: Face): CSSProperties => ({
  fontFamily: `var(--font-${face === "code" ? "mono" : face})`,
});

/** How often each size is set, and in which face most. */
function sizeUsage(styles: TypeStyle[]) {
  const out = new Map<string, { uses: number; faces: Map<Face, number> }>();
  for (const s of styles) {
    const u = out.get(s.size) ?? { uses: 0, faces: new Map() };
    u.uses += s.uses.length;
    u.faces.set(s.face, (u.faces.get(s.face) ?? 0) + s.uses.length);
    out.set(s.size, u);
  }
  return (name: string) => {
    const u = out.get(name);
    const face = u ? [...u.faces].sort((a, b) => b[1] - a[1])[0][0] : Number(name) >= 30 ? "display" : "sans";
    return { uses: u?.uses ?? 0, face };
  };
}

// ---------- Typefaces ----------

/**
 * One --font-* token as a card: a large specimen, its weights, what it's for
 * (children), its stack as globals.css has it, and how to set it.
 *   <Typeface font="display" name="Gelica" source="Adobe Fonts" weights={[400]} use="display">…</Typeface>
 */
export function Typeface({
  font,
  name,
  source,
  weights,
  use,
  children,
}: {
  font: Face;
  name: string;
  source: string;
  weights: number[];
  use: ReactNode;
  children: ReactNode;
}) {
  const token = fonts().find((f) => f.name === font);
  if (!token) throw new Error(`Typeface: no --font-${font} in globals.css`);
  const style = faceStyle(font);

  return (
    <article className="doc-wide flex min-w-0 flex-col gap-fl-16 rounded-lg border border-rule bg-paper-light p-fl-24">
      <div className="mono-label flex justify-between gap-4 text-muted">
        <span>--font-{font}</span>
        <span>{source}</span>
      </div>
      <div style={style} className="flex items-baseline justify-between gap-fl-16 text-ink">
        <span className="text-fl-36 leading-none tracking-display-36">{name}</span>
        <span aria-hidden="true" className="text-fl-96 leading-none">
          Aa
        </span>
      </div>
      <p style={style} className="text-fl-18 leading-[1.5] break-words text-body">
        ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &amp;?!“”→
      </p>
      <ul style={style} className="flex flex-col border-t border-rule/60 pt-fl-12 text-fl-24 text-ink">
        {weights.map((w) => (
          <li key={w} style={{ fontWeight: w }} className="flex justify-between gap-4">
            {WEIGHT_NAMES[w] ?? w}
            <span className="font-mono text-fl-14 text-muted">{w}</span>
          </li>
        ))}
      </ul>
      <div className="text-fl-18 leading-[1.6] text-pretty text-body">{children}</div>
      <DocFacts
        items={[
          ["Stack", token.stack.join(", ")],
          ["Use", use],
        ]}
      />
    </article>
  );
}

// ---------- Scale ----------

/**
 * Every --text-fl-* token largest first, set at its own size in the face the site
 * sets it in most, with its px at the scale's ends and the comp width, and how often
 * it's used. An unused size is set in muted.
 */
export function TypeScale() {
  const { sizes, design, from, to } = typeScale();
  const usage = sizeUsage(typeStyles());

  return (
    <div className="doc-wide flex flex-col">
      <p className="mono-label flex flex-wrap justify-between gap-x-fl-24 gap-y-2 pb-fl-16 text-muted">
        <span>{sizes.length} sizes · src/app/fluid.css · scripts/fluid.mjs</span>
        <span>
          px at {from} / {design} / {to}
        </span>
      </p>
      {[...sizes].reverse().map((t) => {
        const { uses, face } = usage(t.name);
        return (
          <div
            key={t.name}
            className="grid items-baseline gap-x-fl-24 gap-y-2 border-t border-rule py-fl-16 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
          >
            <div className="flex flex-col gap-1 font-mono text-fl-14 text-ink">
              <span>text-fl-{t.name}</span>
              <span className="text-fl-12 text-muted">
                {r1(t.min)} / {t.name} / {r1(t.max)}px
              </span>
              <span className={cn("text-fl-12", uses ? "text-muted" : "text-pink-ink")}>
                {uses ? `${uses} ${uses === 1 ? "use" : "uses"} · ${face}` : "Unused"}
              </span>
            </div>
            <div
              style={{ ...faceStyle(face), fontSize: `var(--text-fl-${t.name}, ${t.value})` }}
              className={cn(
                "overflow-hidden leading-[1.15] text-ellipsis whitespace-nowrap",
                uses ? "text-ink" : "text-muted-light",
              )}
            >
              {SPECIMEN}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Each --text-fl-* token's px across viewport widths (<FluidPlot>), unused sizes dashed.
 */
export function FluidScalePlot() {
  const { sizes, design, from, to } = typeScale();
  const usage = sizeUsage(typeStyles());
  return (
    <FluidPlot
      sizes={sizes}
      design={design}
      from={from}
      to={to}
      uses={(t) => usage(t.name).uses}
      label={(t) => t.name}
      ariaLabel={`Font size in px against viewport width for each text-fl token, from ${from} to ${to}px`}
    />
  );
}

// ---------- Tracking ----------

/**
 * Every --tracking-* token set on a sample, above the same sample untracked. The
 * label trackings are shown on mono caps at label size, the rest on Gelica: the
 * per-size scale from fluid.css at each size, and the admin's two tokens at 60.
 */
export function Trackings() {
  const styles = typeStyles();
  return (
    <div className="doc-wide flex flex-col">
      {trackings().map((t) => {
        const label = t.name.startsWith("label");
        const uses = styles
          .filter((s) => s.tracking && "token" in s.tracking && s.tracking.token === t.name)
          .reduce((n, s) => n + s.uses.length, 0);
        // Gelica's per-size tokens are shown at their own size; the rest at 60.
        const size = t.name.match(/^display-(\d+)$/)?.[1] ?? "60";
        const sample: CSSProperties = label
          ? { ...faceStyle("mono"), fontSize: "var(--text-fl-14)", textTransform: "uppercase" }
          : { ...faceStyle("display"), fontSize: `var(--text-fl-${size})`, lineHeight: 1 };
        // One word at the hero sizes, so the pair stays on a line each.
        const text = label ? "/ 01 · Selected work · 2026" : Number(size) >= 144 ? "Plainly." : "Say it plainly.";
        return (
          <div
            key={t.name}
            className="grid items-center gap-x-fl-24 gap-y-3 border-t border-rule py-fl-20 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
          >
            <div className="flex flex-col gap-1 font-mono text-fl-14 text-ink">
              <span>tracking-{t.name}</span>
              <span className="text-fl-12 text-muted">
                {t.em}em · {uses} {uses === 1 ? "use" : "uses"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <span style={{ ...sample, letterSpacing: `var(--tracking-${t.name})` }} className="text-ink">
                {text}
              </span>
              <span style={sample} className="text-muted-light">
                {text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Leading × size ----------

// Each face's mark: shape and fill, so the legend and the plot agree and a face is
// never told apart by colour alone.
const FACE_MARKS: { face: Face; label: string; fill: string }[] = [
  { face: "display", label: "Gelica", fill: "fill-pink" },
  { face: "sans", label: "Hanken Grotesk", fill: "fill-ink-2" },
  { face: "mono", label: "Plex Mono", fill: "fill-muted" },
  { face: "code", label: "Code", fill: "fill-muted-light" },
];

function Mark({ face, x, y, r }: { face: Face; x: number; y: number; r: number }) {
  const fill = FACE_MARKS.find((m) => m.face === face)?.fill;
  const ring = cn(fill, "stroke-paper-light");
  if (face === "display") return <circle cx={x} cy={y} r={r} className={ring} strokeWidth={2} />;
  if (face === "sans")
    return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5} className={ring} strokeWidth={2} />;
  if (face === "mono")
    return (
      <rect
        x={x - r}
        y={y - r}
        width={r * 2}
        height={r * 2}
        rx={1.5}
        transform={`rotate(45 ${x} ${y})`}
        className={ring}
        strokeWidth={2}
      />
    );
  const h = r * 1.15;
  return (
    <path d={`M${x} ${y - h - 1}L${x + h + 1} ${y + h}L${x - h - 1} ${y + h}Z`} className={ring} strokeWidth={2} />
  );
}

/**
 * Leading against font size for every style the site sets: one mark per face, size
 * and leading, sized by how often it's used and labelled with its leading. Size runs
 * on a log scale so the small sizes don't bunch up.
 */
export function LeadingPlot() {
  // One point per face, size and leading; tracking, case and weight don't change it.
  const points: { face: Face; size: number; leading: number; uses: number }[] = [];
  for (const s of typeStyles()) {
    const leading = Number(s.leading);
    if (Number.isNaN(leading)) continue;
    const p = points.find((q) => q.face === s.face && q.size === Number(s.size) && q.leading === leading);
    if (p) p.uses += s.uses.length;
    else points.push({ face: s.face, size: Number(s.size), leading, uses: s.uses.length });
  }
  const sizes = [...new Set(points.map((p) => p.size))].sort((a, b) => a - b);

  const W = 720;
  const H = 400;
  const m = { t: 16, r: 24, b: 44, l: 48 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const [x0, x1] = [Math.log(sizes[0] * 0.85), Math.log(sizes[sizes.length - 1] * 1.12)];
  const lo = Math.floor(Math.min(...points.map((p) => p.leading)) * 5) / 5;
  // Headroom above the loosest, so its mark clears the top edge.
  const hi = Math.ceil((Math.max(...points.map((p) => p.leading)) + 0.1) * 5) / 5;
  const x = (px: number) => m.l + ((Math.log(px) - x0) / (x1 - x0)) * iw;
  const y = (l: number) => m.t + (1 - (l - lo) / (hi - lo)) * ih;
  const r = (uses: number) => 4 + Math.sqrt(uses) * 1.6;
  const leadingTicks = Array.from({ length: Math.round((hi - lo) / 0.2) + 1 }, (_, i) => lo + i * 0.2);
  // The Gelica scales fluid.css generates (--leading-heading-*, --leading-display-text-*),
  // across the sizes plotted, each labelled at its start: the text scale to the left
  // of its first mark, the heading scale under its first, where no marks sit.
  const scales = (
    [
      { name: "display-text", label: "Text scale", dx: -14, dy: 0, anchor: "end" },
      { name: "heading", label: "Heading scale", dx: 0, dy: 26, anchor: "middle" },
    ] as const
  ).map(({ name, label, dx, dy, anchor }) => {
    const steps = Object.entries(leadings())
      .filter(([k]) => new RegExp(`^${name}-\\d+$`).test(k))
      .map(([k, l]) => ({ size: Number(k.slice(name.length + 1)), leading: l }))
      .filter((p) => p.size <= sizes[sizes.length - 1])
      .sort((a, b) => a.size - b.size);
    const at = { x: x(steps[0].size) + dx, y: y(steps[0].leading) + dy, anchor };
    return { label, steps, at };
  });
  const placed = points.map((p) => ({ x: x(p.size), y: y(p.leading), text: String(p.leading), r: r(p.uses) }));

  return (
    <div className="flex flex-col gap-fl-16">
      <ul className="flex flex-wrap gap-x-fl-24 gap-y-2 font-mono text-fl-12 text-ink-2">
        {FACE_MARKS.map((f) => (
          <li key={f.face} className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
              <Mark face={f.face} x={8} y={8} r={5} />
            </svg>
            {f.label}
          </li>
        ))}
        <li className="text-muted">Larger marks are used more</li>
      </ul>
      {/* Scrolls sideways on a phone rather than shrinking its labels past reading. */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Scatter plot of line height against font size for each type style, by typeface"
          className="block h-auto w-full min-w-[34rem] font-mono text-[11px]"
        >
          {leadingTicks.map((l) => (
            <g key={l}>
              <line x1={m.l} x2={m.l + iw} y1={y(l)} y2={y(l)} className="stroke-rule" />
              <text x={m.l - 8} y={y(l)} textAnchor="end" dominantBaseline="central" className="fill-muted">
                {l.toFixed(1)}
              </text>
            </g>
          ))}
          {sizes.map((px) => (
            <g key={px}>
              <line x1={x(px)} x2={x(px)} y1={m.t} y2={m.t + ih} className="stroke-rule/60" />
              <text x={x(px)} y={m.t + ih + 18} textAnchor="middle" className="fill-muted">
                {px}
              </text>
            </g>
          ))}
          <text x={m.l + iw} y={H - 4} textAnchor="end" className="fill-ink">
            Font size, px at 1440 →
          </text>
          <text x={-(m.t + ih)} y={12} transform="rotate(-90)" className="fill-ink">
            Line height →
          </text>
          {scales.map((sc) => (
            <path
              key={sc.label}
              d={sc.steps.map((p, i) => `${i ? "L" : "M"}${x(p.size).toFixed(1)} ${y(p.leading).toFixed(1)}`).join("")}
              fill="none"
              className="stroke-pink/50"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          ))}
          {scales.map((sc) => (
            <text
              key={sc.label}
              x={sc.at.x}
              y={sc.at.y}
              textAnchor={sc.at.anchor}
              dominantBaseline="central"
              className="fill-pink-ink"
            >
              {sc.label}
            </text>
          ))}
          {[...points]
            .sort((a, b) => b.uses - a.uses)
            .map((p) => (
              <g key={`${p.face}${p.size}${p.leading}`}>
                <Mark face={p.face} x={x(p.size)} y={y(p.leading)} r={r(p.uses)} />
                <title>{`${p.face} · ${p.size}px · ${p.leading}\n${p.uses} ${p.uses === 1 ? "use" : "uses"}`}</title>
              </g>
            ))}
          {placeLabels(placed, { x: m.l + 2, y: m.t, w: iw, h: ih }).map((l) => (
            <text key={`${l.text}${l.x}${l.y}`} x={l.x} y={l.y} dominantBaseline="central" className="fill-ink-2">
              {l.text}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ---------- Styles in use ----------

const trackingText = (t: TypeStyle["tracking"]) =>
  !t ? "tracking 0" : "token" in t ? `tracking-${t.token}` : `${t.em}em`;

/**
 * Every combination of face, size, weight, leading and tracking the site sets, found
 * in its source, each set on its own text where the source has some. Tracking
 * written inline rather than from a token is marked.
 */
export function TypeStyles() {
  const styles = typeStyles();
  const places = styles.reduce((n, s) => n + s.uses.length, 0);

  return (
    <div className="doc-wide flex flex-col">
      <p className="mono-label pb-fl-16 text-muted">
        {styles.length} styles in {places} places · src/app · src/components
      </p>
      {styles.map((s) => {
        const small = Number(s.size) <= 24;
        const inline = s.tracking && "em" in s.tracking;
        return (
          <div
            key={`${s.face}${s.size}${s.weight}${s.leading}${trackingText(s.tracking)}${s.uppercase}`}
            className="grid items-start gap-x-fl-24 gap-y-3 border-t border-rule py-fl-20 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
          >
            <div className="flex flex-col gap-1 font-mono text-fl-14 text-ink">
              <span>
                {s.face} · {s.size}
                {s.weight ? ` · ${s.weight}` : ""}
                {s.uppercase ? " · caps" : ""}
              </span>
              <span className="text-fl-12 text-muted">leading {s.leading}</span>
              <span className={cn("text-fl-12", inline ? "text-pink-ink" : "text-muted")}>
                {inline ? `tracking ${trackingText(s.tracking)} · no token` : trackingText(s.tracking)}
              </span>
              <span className="mt-1 flex flex-col text-fl-12 leading-[1.6] text-muted">
                {s.uses.map((u) => (
                  <span key={`${u.file}:${u.line}`} className="break-all">
                    {u.file.replace(/^src\/(app|components)\//, "")}:{u.line}
                  </span>
                ))}
              </span>
            </div>
            <p
              style={{
                ...faceStyle(s.face),
                fontSize: `var(--text-fl-${s.size})`,
                fontWeight: s.weight,
                lineHeight: s.leading,
                letterSpacing: !s.tracking
                  ? undefined
                  : "token" in s.tracking
                    ? `var(--tracking-${s.tracking.token})`
                    : `${s.tracking.em}em`,
                textTransform: s.uppercase ? "uppercase" : undefined,
              }}
              className={cn(
                "min-w-0 break-words text-ink",
                small && "max-w-160 text-pretty",
                // Leading only shows over two lines, so a heading's sample wraps.
                !s.sample && !small && s.face === "display" && "max-w-[10em]",
                s.face === "code" && "whitespace-pre",
              )}
            >
              {s.face === "code"
                ? CODE
                : (s.sample ??
                  (s.face === "mono" ? SPECIMEN : small ? PARAGRAPH : s.face === "display" ? HEADING : SPECIMEN))}
            </p>
          </div>
        );
      })}
    </div>
  );
}
