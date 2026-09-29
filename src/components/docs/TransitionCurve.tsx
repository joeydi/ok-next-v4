import type { ReactNode } from "react";
import { ease as easeOf, viewTransition } from "@/lib/tokens";
import { CurvePlot } from "./CurvePlot";
import { DocFacts } from "./DocTable";
import { PlayheadDot } from "./PlayheadDot";
import type { Tone } from "./tone";

type Plotted = {
  ease: string;
  tone?: Tone;
  /** Names the curve in a pair: "Old", "New". */
  label?: string;
  /** With a duration (a --view-transition-* name or ms), a dot follows the doc's playhead. */
  duration?: string | number;
  delay?: string | number;
};

/**
 * One or two curves as a transition uses them, smaller than <Curve>: the plot, each
 * curve's value, why it suits (children) and where it's used.
 *   <TransitionCurve curves={[{ ease: "out-expo", duration: "in", delay: "in-delay" }]} used="page-in">…</TransitionCurve>
 */
export function TransitionCurve({
  title,
  curves,
  used,
  children,
}: {
  title?: string;
  curves: Plotted[];
  used: ReactNode;
  children: ReactNode;
}) {
  const plotted = curves.map((c) => ({ ...c, tone: c.tone ?? "pink", points: easeOf(c.ease) }));
  const name = (e: string) => (e === "ease" ? "ease" : `--ease-${e}`);
  return (
    <article className="doc-wide flex min-w-0 flex-col gap-fl-16 rounded-lg border border-rule bg-paper-light p-fl-24">
      <span className="mono-label text-ink">{title ?? name(curves[0].ease)}</span>
      <div className="mx-auto w-full max-w-80">
        <CurvePlot curves={plotted} label={`${title ?? name(curves[0].ease)} curve`}>
          {plotted.map(
            (c) =>
              c.duration !== undefined && (
                <PlayheadDot
                  key={c.ease}
                  points={c.points}
                  tone={c.tone}
                  delay={viewTransition(c.delay ?? 0)}
                  duration={viewTransition(c.duration)}
                />
              ),
          )}
        </CurvePlot>
      </div>
      <div className="text-fl-18 leading-[1.6] text-pretty text-body">{children}</div>
      <DocFacts
        items={[
          ...plotted.map((c): [string, string] => [
            c.label ?? "Value",
            `${name(c.ease)} · cubic-bezier(${c.points.join(", ")})`,
          ]),
          ["Used on", used],
        ]}
      />
    </article>
  );
}
