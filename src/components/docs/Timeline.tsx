import { ease, viewTransition } from "@/lib/tokens";
import { DocTable } from "./DocTable";
import { type ResolvedRow, TimelineView } from "./TimelineView";
import type { Tone } from "./tone";

// Animations drawn to scale, described in the doc as rows that name tokens rather
// than copy values: `duration: "reveal"` is --view-transition-reveal, `ease:
// "in-out-cubic"` is --ease-in-out-cubic ("ease" is CSS's default). Numbers pass
// through, for browser defaults. Export the rows from the MDX and pass them to both
// <Timeline> and <KeyframeTable>, so the chart and the table can't disagree.

export type TimelineRow =
  | { group: string; pseudo: string; tone: Tone }
  | {
      name: string;
      note: string;
      duration: string | number;
      delay?: string | number;
      ease: string;
      /** What it animates, for the live readout and the keyframes table: blur 0 → "blur-radius" px. */
      value?: { label: string; from: string | number; to: string | number; unit?: string; digits?: number };
      /** Said after the value in the keyframes table. */
      change?: string;
    };

function resolve(rows: TimelineRow[]): ResolvedRow[] {
  return rows.map((r) =>
    "group" in r
      ? r
      : {
          ...r,
          duration: viewTransition(r.duration),
          delay: viewTransition(r.delay ?? 0),
          points: ease(r.ease),
          value: r.value && {
            label: r.value.label,
            from: viewTransition(r.value.from),
            to: viewTransition(r.value.to),
            unit: r.value.unit ?? "",
            digits: r.value.digits ?? 2,
          },
        },
  );
}

/**
 * The rows on a shared time axis, each bar drawing its curve. `live` adds the preview's
 * playhead and each animation's value at that moment.
 *   <Timeline rows={PAGE} step={100} live />
 */
export function Timeline({ rows, step = 100, live = false }: { rows: TimelineRow[]; step?: number; live?: boolean }) {
  const resolved = resolve(rows);
  const total = Math.max(...resolved.map((r) => ("group" in r ? 0 : r.delay + r.duration)));
  // Every other tick is labelled, so the axis ends on one of those.
  return <TimelineView rows={resolved} total={Math.ceil(total / (2 * step)) * 2 * step} step={step} live={live} />;
}

/** The same rows as a reference table: pseudo-element, keyframes, delay, duration, easing and change. */
export function KeyframeTable({ rows }: { rows: TimelineRow[] }) {
  let pseudo = "";
  const fmt = (v: number, unit: string) => (v === 0 ? "0" : `${v}${unit}`);
  const out = [];
  for (const r of resolve(rows)) {
    if ("group" in r) {
      pseudo = r.pseudo;
      continue;
    }
    const change = [
      r.value && `${r.value.label} ${fmt(r.value.from, r.value.unit)} → ${fmt(r.value.to, r.value.unit)}`,
      r.change && (r.value ? `(${r.change})` : r.change),
    ]
      .filter(Boolean)
      .join(" ");
    out.push([
      pseudo,
      r.name,
      r.delay ? `${r.delay}ms` : "0",
      `${r.duration}ms`,
      <span key="e" className="whitespace-nowrap">
        {r.ease === "ease" ? "ease" : `--ease-${r.ease}`}
      </span>,
      change,
    ]);
  }
  return (
    <DocTable
      columns={[
        { label: "Pseudo-element" },
        { label: "Animation" },
        { label: "Delay", align: "end" },
        { label: "Duration", align: "end" },
        { label: "Easing" },
        { label: "Change" },
      ]}
      rows={out}
    />
  );
}
