import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fonts, type SizeToken, sizeAt, trackings, typeScale } from "@/lib/tokens";
import { DocFacts } from "./DocTable";
import { type Face, type TypeStyle, typeStyles } from "./typeUsage";
import { ViewportMarker } from "./ViewportMarker";

// The Typography doc's visuals: the --font-*, --tracking-* and --text-fl-* tokens,
// read from globals.css and fluid.css, and the styles the site builds from them,
// found by scanning its source (typeUsage.ts). Every sample is set in the tokens
// themselves (`var(--text-fl-…)`), so it follows an edit to the CSS.

const SPECIMEN = "Hamburgefonstiv";
const PARAGRAPH =
  "Body copy sets a comfortable measure so a paragraph reads easily at every width, and the leading shows once it wraps onto a second line.";
const HEADING = "A heading long enough to wrap";
const WEIGHT_NAMES: Record<number, string> = { 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold" };

const r1 = (n: number) => String(Math.round(n * 10) / 10);
const faceStyle = (face: Face): CSSProperties => ({ fontFamily: `var(--font-${face})` });

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
        <span className="text-fl-36 leading-none tracking-heading">{name}</span>
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
 * Each --text-fl-* token's px across viewport widths: a straight line between its
 * floor and ceiling, crossing its design px at the comp width. Unused sizes are
 * dashed. A marker follows the window's own width.
 */
export function FluidScalePlot() {
  const { sizes, design, from, to } = typeScale();
  const usage = sizeUsage(typeStyles());
  const W = 720;
  const H = 440;
  const m = { t: 16, r: 44, b: 40, l: 52 };
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
  const labels = [...sizes].reverse().map((t) => ({ t, y: y(t.max) }));
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + GAP);
  const over = labels[labels.length - 1].y - (m.t + ih);
  if (over > 0) for (const l of labels) l.y -= over;
  for (let i = labels.length - 2; i >= 0; i--) labels[i].y = Math.min(labels[i].y, labels[i + 1].y - GAP);

  const ticks = [from, 768, 1024, design, to];

  return (
    // Scrolls sideways on a phone rather than shrinking its labels past reading.
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Font size in px against viewport width for each text-fl token, from ${from} to ${to}px`}
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
          const { uses } = usage(t.name);
          const title = `text-fl-${t.name}\n${r1(t.min)}px at ${from} · ${t.name}px at ${design} · ${r1(t.max)}px at ${to}\n${uses ? `${uses} uses` : "Unused"}`;
          return (
            <g key={t.name}>
              <path
                d={line(t)}
                fill="none"
                className={uses ? "stroke-ink-2" : "stroke-muted-light"}
                strokeWidth={uses ? 1.5 : 1}
                strokeDasharray={uses ? undefined : "4 4"}
              />
              <circle cx={x(design)} cy={y(Number(t.name))} r={3} className="fill-pink" />
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
            className={usage(t.name).uses ? "fill-ink-2" : "fill-muted-light"}
          >
            {t.name}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ---------- Tracking ----------

/**
 * Every --tracking-* token set on a sample, above the same sample untracked. The
 * label trackings are shown on mono caps at label size, the rest on Gelica.
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
        const sample: CSSProperties = label
          ? { ...faceStyle("mono"), fontSize: "var(--text-fl-14)", textTransform: "uppercase" }
          : { ...faceStyle("display"), fontSize: "var(--text-fl-60)", lineHeight: 1 };
        const text = label ? "/ 01 · Selected work · 2026" : "Say it plainly.";
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
              <span className="text-fl-12 text-muted">leading {s.leading ?? "normal"}</span>
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
              )}
            >
              {s.sample ??
                (s.face === "mono" ? SPECIMEN : small ? PARAGRAPH : s.face === "display" ? HEADING : SPECIMEN)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
