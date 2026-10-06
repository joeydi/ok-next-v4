import { createContext, type ReactNode, use } from "react";
import { cn } from "@/lib/cn";
import { Chip } from "../parts";
import { CLIENT, PAGES, PERFORMANCE, type Status, SUMMARY, UPTIME } from "./report";

// The report's pages, each drawn at PAGE px, as printed: the summary (page 1),
// uptime and certificates (page 3) and performance tests (page 5). The two behind
// take the loop's time, for the check running on each. The words are drawn as
// bars, as at this size they can't be read anyway, and the figures are written:
// the stat tiles, the score table and the uptime chart in full, in pink.

export const PAGE = [560, 724] as const; // px: US Letter
export const LOOP = 6; // s

/** Whether words are written out here, as in a chart, rather than drawn as bars. */
const Written = createContext(false);

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** A sheet of the report: paper, margins, and the running footer. */
export function Page({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div
      className="absolute flex flex-col rounded-[6px] border border-ink/10 bg-paper-light px-10 pt-11 pb-8 font-sans text-ink leading-body shadow-ink/10 shadow-xl"
      style={{ width: PAGE[0], height: PAGE[1] }}
    >
      {children}
      <div className="mt-auto flex justify-between font-mono text-[9.5px] text-muted-light tracking-label-tight">
        <span className="uppercase tracking-label">
          <Words>
            {CLIENT.name} · {CLIENT.period}
          </Words>
        </span>
        <span>
          Page {n} of {PAGES}
        </span>
      </div>
    </div>
  );
}

/** Words as a bar their length (darker for a heading), or written out in a chart. */
function Words({ heading = false, children }: { heading?: boolean; children: ReactNode }) {
  if (use(Written)) return children;
  const text = [children].flat(3).join("");
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-current align-middle",
        heading ? "h-[0.4em] opacity-35" : "h-[0.55em] opacity-25",
      )}
      style={{ width: `${text.length * 0.52}em` }}
    />
  );
}

/** A chart: its words written out. */
function Chart({ children }: { children: ReactNode }) {
  return <Written value>{children}</Written>;
}

/** A numbered section heading, with its count on the right. */
function Heading({ n, title, aside }: { n: string; title: string; aside: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2.5 border-ink/10 border-b pb-3">
      <span className="font-mono font-semibold text-[13px] text-pink-ink">{n}</span>
      <span className="font-display text-[22px] leading-none">
        <Words heading>{title}</Words>
      </span>
      <span className="ml-auto font-mono text-[10px] text-muted uppercase tracking-label">{aside}</span>
    </div>
  );
}

/** A table: mono caps headings, ruled rows. Columns after the first are right-aligned from `right`. */
function Table({
  cols,
  rows,
  widths,
  right = 1,
  mono = 1,
  lit,
}: {
  cols: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  widths: string;
  right?: number;
  /** Columns from here are figures, in mono. */
  mono?: number;
  /** How lit row `i` is, 0–1: a pink tint across it, marked at its start. */
  lit?: (i: number) => number;
}) {
  const cell = (j: number) => cn(j >= right && "text-right", j >= mono ? "font-mono" : "");
  return (
    <div className="grid text-[11px]" style={{ gridTemplateColumns: widths }}>
      {cols.map((c, j) => (
        <div
          key={c}
          className={cn(
            "border-ink/10 border-b pb-2 font-mono text-[9px] text-muted uppercase tracking-label",
            cell(j),
          )}
        >
          <Words>{c}</Words>
        </div>
      ))}
      {rows.map((r, i) =>
        r.map((v, j) => (
          <div key={`${i}-${j}`} className={cn("relative border-ink/10 border-b py-2", cell(j))}>
            {lit && lit(i) > 0 && (
              <div
                className={cn(
                  "absolute inset-y-0 bg-pink/8",
                  j === 0 ? "-left-2 right-0 border-pink border-l-2" : "inset-x-0",
                  j === r.length - 1 && "-right-2",
                )}
                style={{ opacity: lit(i) }}
              />
            )}
            <span className="relative">{j < mono && typeof v === "string" ? <Words>{v}</Words> : v}</span>
          </div>
        )),
      )}
    </div>
  );
}

const DOTS: Record<Status, string> = { ok: "bg-ink", none: "bg-muted-light", watch: "bg-pink" };

/** Page 1: the summary. */
export function SummaryPage() {
  const s = SUMMARY;
  return (
    <>
      <div className="font-mono text-[10px] text-pink-ink uppercase tracking-label">
        <Words>Website maintenance report</Words>
      </div>
      <div className="mt-2 flex items-end justify-between border-ink border-b-2 pb-3">
        <div className="font-display text-[42px] leading-none tracking-[-0.01em]">{CLIENT.name}</div>
        <div className="text-right font-mono leading-snug">
          <div className="text-[14px]">{CLIENT.period}</div>
          <div className="text-[11px] text-body">{CLIENT.domain}</div>
        </div>
      </div>
      <div className="mt-3 font-mono text-[9.5px] text-muted tracking-label-tight">
        <Words>{s.meta.join(" · ")}</Words>
      </div>

      <div className="mt-5 grid grid-cols-5 rounded-[6px] border border-ink/10">
        <Chart>
          {s.tiles.map((tile, i) => (
            <div key={tile.k} className={cn("flex flex-col gap-1.5 px-3 py-3", i > 0 && "border-ink/10 border-l")}>
              <div className="flex items-center gap-1.5 font-mono text-[8.5px] text-muted uppercase tracking-label">
                <span className="size-1.5 rounded-full bg-pink" />
                {tile.k}
              </div>
              <div className="font-mono font-medium text-[17px] leading-tight">{tile.v}</div>
              <div className="font-mono text-[9px] text-muted">
                <Words>{tile.d}</Words>
              </div>
            </div>
          ))}
        </Chart>
      </div>

      <div className="mt-6 font-semibold text-[13px]">
        <Words>What changed this period</Words>
      </div>
      <ul className="mt-2.5 grid grid-flow-col grid-cols-2 grid-rows-3 gap-x-6 text-[11px]">
        {s.changes.map((c) => (
          <li key={c.t} className="flex items-center gap-2 border-ink/10 border-b py-2">
            <span className={cn("size-1.5 shrink-0 rounded-full", DOTS[c.s])} />
            <Words>{c.t}</Words>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <Heading n={s.updates.n} title={s.updates.title} aside={s.updates.count} />
      </div>
      <div className="mt-3">
        <Table cols={s.updates.cols} rows={s.updates.rows} widths="2.2fr 0.9fr 0.9fr 0.9fr 0.8fr" right={4} />
      </div>
    </>
  );
}

const AUDIT = LOOP / PERFORMANCE.scores.rows.length; // s per page audited
const FADE = 0.3; // s: an audit's highlight fading in, and out

/** How lit audit row `i` is, `t` s into the loop: the audits run down the table, one at a time. */
function audit(i: number, t: number) {
  const u = t - i * AUDIT;
  return u < 0 || u > AUDIT ? 0 : clamp(Math.min(u, AUDIT - u) / FADE);
}

/** Page 5: performance tests. The audits run, page by page. */
export function PerformancePage({ t }: { t: number }) {
  const p = PERFORMANCE;
  const scores = p.scores.rows.map((r) =>
    r.map((v, j) =>
      j === 0 ? (
        v
      ) : (
        <span key={j} className="-my-px inline-block">
          <Chip pink>{v}</Chip>
        </span>
      ),
    ),
  );
  return (
    <>
      <Heading n={p.n} title={p.title} aside={p.count} />
      <ul className="mt-4 flex flex-col gap-1.5 text-[11px] text-body">
        {p.notes.map((n) => (
          <li key={n}>
            — <Words>{n}</Words>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Chart>
          <Table cols={p.scores.cols} rows={scores} widths="1.4fr 1fr 1fr 1fr 1fr" lit={(i) => audit(i, t)} />
        </Chart>
      </div>
      <div className="mt-9">
        <Table cols={p.vitals.cols} rows={p.vitals.rows} widths="1.4fr 1fr 1fr 1fr 1fr" />
      </div>
    </>
  );
}

const SWEEP = 6; // bars past either end the check's sweep starts and ends, so it wraps unseen

/** Page 3: uptime and certificates. The check runs along the month, a day a bar. */
export function UptimePage({ t }: { t: number }) {
  const u = UPTIME;
  const x = (t / LOOP) * (u.days + 2 * SWEEP) - SWEEP; // the sweep, in bars
  const pulse = 0.5 + 0.5 * Math.cos((2 * Math.PI * t) / (LOOP / 4));
  return (
    <>
      <Heading
        n={u.n}
        title={u.title}
        aside={
          <span className="flex items-center gap-1.5 font-semibold text-pink-ink">
            <span className="size-1.5 rounded-full bg-pink" style={{ opacity: 0.35 + 0.65 * pulse }} />
            {u.uptime}
          </span>
        }
      />
      <Chart>
        <div className="mt-5 flex h-14 gap-[3px]">
          {Array.from({ length: u.days }, (_, k) => {
            const ping = clamp(1 - Math.abs(k - x) / 2.5);
            return (
              <div key={k} className="relative flex-1 rounded-[2px] bg-pink/70">
                <div
                  className="absolute inset-0 rounded-[2px] bg-pink-ink"
                  style={{ opacity: ping, scale: `1 ${1 + 0.12 * ping}`, transformOrigin: "bottom" }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9px] text-muted uppercase tracking-label">
          <span>Sep 1</span>
          <span>Sep 30</span>
        </div>
      </Chart>
      <div className="mt-5 grid grid-cols-3 rounded-[6px] border border-ink/10">
        {u.stats.map((s, i) => (
          <div key={s.k} className={cn("flex flex-col gap-2 px-4 py-3.5", i > 0 && "border-ink/10 border-l")}>
            <div className="font-mono text-[9px] text-muted uppercase tracking-label">{s.k}</div>
            <div className="font-mono font-medium text-[22px] leading-none">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-9">
        <Heading n={u.ssl.n} title={u.ssl.title} aside={u.ssl.count} />
      </div>
      <div className="mt-3">
        <Table
          cols={u.ssl.cols}
          rows={u.ssl.rows.map(([d, i, g, e]) => [
            d,
            i,
            <span key="g" className="-my-px inline-block">
              <Chip pink>{g}</Chip>
            </span>,
            e,
          ])}
          widths="1.6fr 1.3fr 0.6fr 1fr"
          right={3}
          mono={2}
        />
      </div>
    </>
  );
}
