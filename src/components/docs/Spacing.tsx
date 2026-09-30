import { cn } from "@/lib/cn";
import { containerPage, pageGrid, type SizeToken, sizeAt, spaceScale } from "@/lib/tokens";
import { DocTable } from "./DocTable";
import { FluidPlot } from "./FluidPlot";
import { PageGridLive } from "./PageGridLive";
import { GridRow, gridAt } from "./pageGrid";
import { type SpaceValue, spaceUsage } from "./spaceUsage";

// The Spacing & layout doc's visuals: the --spacing-* tokens from fluid.css, the
// page frame built from them (--container-page, the gutter, grid-12), and the
// spacing the site sets, found by scanning its source (spaceUsage.ts).

const r1 = (n: number) => String(Math.round(n * 10) / 10);
const plural = (n: number) => `${n} ${n === 1 ? "use" : "uses"}`;
const file = (f: string) => f.replace(/^src\/(app|components)\//, "");

/** The spacing scale, smallest first by its px at the comp width. */
function scale() {
  const s = spaceScale();
  return { ...s, sizes: [...s.sizes].sort((a, b) => sizeAt(a, s.design) - sizeAt(b, s.design)) };
}

/** How often a --spacing-* token is set: on its own, and inside a worked-out value. */
function tokenUses(values: SpaceValue[]) {
  return (name: string) =>
    values
      .filter((v) =>
        v.kind === "token" ? v.value === name : v.kind === "derived" && v.value.includes(`--spacing-${name})`),
      )
      .reduce((n, v) => n + v.uses.length, 0);
}

const isNamed = (t: SizeToken) => !t.name.startsWith("fl-");

// ---------- Scale ----------

/** Each --spacing-* token's px across viewport widths (<FluidPlot>), the named ones in pink. */
export function FluidSpacePlot() {
  const { sizes, design, from, to } = scale();
  const uses = tokenUses(spaceUsage());
  return (
    <FluidPlot
      sizes={sizes}
      design={design}
      from={from}
      to={to}
      uses={(t) => uses(t.name)}
      label={(t) => t.name}
      highlight={isNamed}
      ariaLabel={`Space in px against viewport width for each spacing token, from ${from} to ${to}px`}
    />
  );
}

/**
 * Every --spacing-* token smallest first, drawn as a bar at its own width in this
 * window, with its px at the scale's ends and the comp width, and how often it's
 * used. An unused step is marked.
 */
export function SpaceScale() {
  const { sizes, design, from, to } = scale();
  const uses = tokenUses(spaceUsage());

  return (
    <div className="doc-wide flex flex-col">
      <p className="mono-label flex flex-wrap justify-between gap-x-fl-24 gap-y-2 pb-fl-16 text-muted">
        <span>{sizes.length} steps · src/app/fluid.css · scripts/fluid.mjs</span>
        <span>
          px at {from} / {design} / {to}
        </span>
      </p>
      {sizes.map((t) => {
        const n = uses(t.name);
        return (
          <div
            key={t.name}
            className="grid grid-cols-[5rem_minmax(0,1fr)_6rem] items-center gap-x-fl-16 gap-y-2 border-t border-rule/60 py-2 font-mono text-fl-14 md:grid-cols-[6rem_10rem_6rem_minmax(0,1fr)]"
          >
            <span className={isNamed(t) ? "text-pink-ink" : "text-ink"}>{t.name}</span>
            <span className="text-muted">
              {r1(t.min)} / {r1(sizeAt(t, design))} / {r1(t.max)}
            </span>
            <span className={cn("text-fl-12", n ? "text-muted" : "text-pink-ink")}>{n ? plural(n) : "Unused"}</span>
            <div
              style={{ width: `var(--spacing-${t.name}, ${t.value})` }}
              className={cn(
                "col-span-3 h-3 md:col-span-1",
                n ? (isNamed(t) ? "bg-pink" : "bg-ink-2") : "bg-muted-light",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------- Page ----------

const WIDTHS = [320, 390, 768, 1024, 1440, 1920, 2560];

function spec() {
  const { sizes } = spaceScale();
  const grid = pageGrid();
  const find = (name: string) => {
    const t = sizes.find((s) => s.name === name);
    if (!t) throw new Error(`PageGrid: no --spacing-${name} in fluid.css`);
    return t;
  };
  return { gutter: find("gutter"), gap: find(grid.gap), columns: grid.columns, cap: containerPage() };
}

/**
 * The page's frame at a phone, a tablet, the comp and past the cap, each drawn
 * the same width so they compare as proportions, then at this window's width.
 */
export function PageGrid() {
  const s = spec();
  const rows = [390, 1024, 1440, 2560];
  const W = 720;
  const m = { l: 48, r: 8 };
  const h = 36;
  const step = h + 22;
  const H = step * rows.length + h + 28;

  return (
    <div className="flex flex-col gap-fl-16">
      <ul className="flex flex-wrap gap-x-fl-24 gap-y-2 font-mono text-fl-12 text-ink-2">
        {[
          ["bg-pink/35", `${s.columns} columns`],
          ["bg-guide/50", "Gutters and column gaps"],
          ["border border-dashed border-muted", `The window, past --container-page (${s.cap}px)`],
        ].map(([swatch, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span className={cn("size-3", swatch)} />
            {label}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`The page's gutter and ${s.columns} columns at ${rows.join(", ")}px and at this window's width, each drawn the same width`}
          className="block h-auto w-full min-w-[34rem] font-mono text-[11px]"
        >
          {rows.map((vw, i) => {
            const y = i * step;
            return (
              <g key={vw}>
                <text x={m.l - 10} y={y + h / 2} textAnchor="end" dominantBaseline="central" className="fill-muted">
                  {vw}
                </text>
                <GridRow grid={gridAt(vw, s)} x={m.l} y={y} w={W - m.l - m.r} h={h} />
              </g>
            );
          })}
          <PageGridLive spec={s} x={m.l} y={rows.length * step} w={W - m.l - m.r} h={h} />
        </svg>
      </div>
    </div>
  );
}

/** The frame's px at the widths the site is checked at: gutter, column gap, column, content and --pvw. */
export function PageGridTable() {
  const s = spec();
  return (
    <DocTable
      columns={[
        { label: "Viewport" },
        { label: "Gutter", align: "end" },
        { label: "Gap", align: "end" },
        { label: "Column", align: "end" },
        { label: "Content", align: "end" },
        { label: "1 pvw", align: "end" },
      ]}
      rows={WIDTHS.map((vw) => {
        const g = gridAt(vw, s);
        return [
          vw,
          r1(g.gutter),
          r1(g.gap),
          r1(g.column),
          r1(g.container - 2 * g.gutter),
          Math.round((g.container / 100) * 100) / 100,
        ];
      })}
    />
  );
}

// ---------- Spacing in use ----------

/** The nearest fl-* steps to a px at the comp width: the one it matches, or the two it falls between. */
function nearest(px: number) {
  const { sizes, design } = scale();
  const steps = sizes.filter((t) => !isNamed(t)).map((t) => ({ name: t.name, px: sizeAt(t, design) }));
  const exact = steps.find((t) => Math.abs(t.px - px) < 0.5);
  if (exact) return `Matches ${exact.name} at ${design}`;
  const below = steps.filter((t) => t.px < px).at(-1);
  const above = steps.find((t) => t.px > px);
  return below && above ? `Between ${below.name} and ${above.name}` : `Nearest is ${(below ?? above)?.name}`;
}

/**
 * Every spacing value the site sets that isn't a --spacing-* token. Fixed px
 * (Tailwind steps, `[18px]`, px in CSS) each get a row, drawn at their px, with the
 * nearest step on the scale; em, % and worked-out values follow in one table.
 */
export function SpacingInUse() {
  const values = spaceUsage();
  const count = (vs: SpaceValue[]) => vs.reduce((n, v) => n + v.uses.length, 0);
  const tokens = values.filter((v) => v.kind === "token");
  const fixed = values.filter((v) => v.kind === "fixed");
  const rest = values.filter((v) => v.kind === "relative" || v.kind === "derived");

  return (
    <div className="doc-wide flex flex-col">
      <p className="mono-label pb-fl-16 text-muted">
        {count(tokens)} places on the scale · {count(fixed)} fixed · {count(rest)} relative or worked out
      </p>
      {fixed.map((v) => (
        <div
          key={v.value}
          className="grid items-start gap-x-fl-24 gap-y-3 border-t border-rule py-fl-20 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
        >
          <div className="flex min-w-0 flex-col gap-1 font-mono text-fl-14 text-ink">
            <span>{v.value}</span>
            <span className="text-fl-12 text-muted">
              {plural(v.uses.length)} · {v.props.join(", ")}
            </span>
            {v.px !== undefined && <span className="text-fl-12 text-pink-ink">{nearest(v.px)}</span>}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div style={{ width: v.px }} className="h-3 bg-pink" />
            <Uses v={v} />
          </div>
        </div>
      ))}
      <p className="mono-label border-t border-rule pt-fl-40 pb-fl-16 text-muted">Relative and worked out</p>
      <DocTable
        columns={[{ label: "Value" }, { label: "Kind" }, { label: "Where" }]}
        rows={rest.map((v) => [
          <span key="v" className="break-all">
            {v.value}
          </span>,
          <span key="k" className="whitespace-nowrap text-muted">
            {v.kind === "relative" ? "Relative" : "Worked out"} · {v.props.join(", ")}
          </span>,
          <Uses key="u" v={v} bare />,
        ])}
      />
    </div>
  );
}

/** Where a value is set: the class or declaration (unless `bare`), then the file and line. */
function Uses({ v, bare }: { v: SpaceValue; bare?: boolean }) {
  return (
    <ul className="flex flex-col font-mono text-fl-12 leading-[1.6] text-muted">
      {v.uses.map((u) => (
        <li key={`${u.file}:${u.line}:${u.text}`} className="break-all">
          {!bare && <span className="text-ink-2">{u.text} </span>}
          {file(u.file)}:{u.line}
        </li>
      ))}
    </ul>
  );
}
