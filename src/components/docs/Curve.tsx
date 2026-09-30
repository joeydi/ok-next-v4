import type { ReactNode } from "react";
import { bezier } from "@/lib/bezier";
import { ease as easeOf, viewTransition } from "@/lib/tokens";
import { CurvePlot } from "./CurvePlot";
import { DocFacts } from "./DocTable";
import { PlayTrack } from "./PlayTrack";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * One --ease-* token as a card: its plot, a track to play it against linear, what
 * it's like (children), its halfway and quarter values, where it's used, and its class.
 * `duration` is a sample length in ms, or a --view-transition-* name ("reveal").
 *   <Curve ease="out-expo" title="Expo out" duration={500} used="Card lift on hover">…</Curve>
 */
export function Curve({
  ease,
  title,
  duration,
  used,
  children,
}: {
  ease: string;
  title: string;
  duration: number | string;
  used: ReactNode;
  children: ReactNode;
}) {
  const points = easeOf(ease);
  const at = bezier(points);
  const ms = viewTransition(duration);
  const css = `cubic-bezier(${points.join(", ")})`;

  return (
    <article className="doc-wide flex min-w-0 flex-col gap-fl-16 rounded-lg border border-rule bg-paper-light p-fl-24">
      <div className="mono-label flex justify-between gap-4 text-muted">
        <span>{ms}ms</span>
        <span>--ease-{ease}</span>
      </div>
      <h3 className="display text-fl-36 leading-none tracking-display-36 text-ink">{title}</h3>
      <CurvePlot curves={[{ points }]} end={`${ms}ms`} label={`${title}: ${css}`} />
      <PlayTrack ease={ease} duration={ms} label={title} />
      <div className="text-fl-18 leading-[1.6] text-pretty text-body">{children}</div>
      <DocFacts
        items={[
          ["Value", css],
          ["Halfway", `${pct(at(0.5))} done at ${ms / 2}ms`],
          ["Quarter", `${pct(at(0.25))} at 25% · ${pct(at(0.75))} at 75%`],
          ["Used on", used],
          ["Class", `ease-${ease}`],
        ]}
      />
    </article>
  );
}
