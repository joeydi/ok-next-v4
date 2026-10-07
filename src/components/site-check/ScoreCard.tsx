"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useState } from "react";
import { siteCheck as copy, verdictFor } from "@/data/site-check";
import { cn } from "@/lib/cn";
import { CATEGORIES, type SiteCheckRun } from "@/lib/site-check/schema";

/**
 * The score as Number Flow shows it: 0 for the first frame after it lands, then the
 * score, so the digits spin up to it. Held still when `animate` is off (a pinned
 * stage); Number Flow itself skips the spin under reduced motion. Key the caller
 * by run, so a new run starts from 0.
 */
function useLanding(target: number | null, animate: boolean) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (target === null || !animate) return;
    const raf = requestAnimationFrame(() => setLanded(true));
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  if (target === null) return null;
  return !animate || landed ? target : 0;
}

/** The score out of 100, and a bar per category that fills as the category is scored. */
export function ScoreCard({ run, animate }: { run: SiteCheckRun; animate: boolean }) {
  const score = useLanding(run.score, animate);
  return (
    <div className="frame border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised bg-clip-padding px-fl-32 pt-fl-28 pb-fl-32">
      <div className="mono-label text-muted">/ {copy.scoreLabel}</div>
      <div className="mt-fl-18 flex flex-wrap items-start gap-x-fl-40 gap-y-fl-24">
        <div className="min-w-0 flex-[1_1_220px]">
          <div className="flex items-baseline gap-2.5">
            <span aria-hidden="true" className="display text-fl-144 leading-heading-144 tracking-display-144">
              {score === null ? (
                "––"
              ) : (
                // Number Flow sets its own line-height of 1 and pads 0.25em above and below for
                // the mask its digits spin through; the margins take it back to the heading's leading.
                <NumberFlow
                  value={score}
                  animated={animate}
                  trend={1}
                  className="my-[calc((var(--leading-heading-144)-1.5)*0.5em)]"
                />
              )}
            </span>
            <span className="mono-text text-muted">
              <span className="sr-only">{run.score === null ? "Score pending" : `Score ${run.score}`}</span> / 100
            </span>
          </div>
          <p className="display mt-fl-18 text-fl-24 leading-display-text-24 tracking-display-24">
            {run.score === null ? copy.pending : verdictFor(run.score)}
          </p>
        </div>

        <ul className="flex min-w-0 flex-[2_1_300px] flex-col">
          {CATEGORIES.map((cat) => {
            const scored = run.categories.find((c) => c.id === cat.id)?.score;
            return (
              <li
                key={cat.id}
                className="grid grid-cols-[8.5em_minmax(0,1fr)_2.6em] items-center gap-fl-12 border-t border-rule py-fl-8"
              >
                <span className="text-fl-18 leading-copy text-body">{cat.name}</span>
                <span className="h-1.5 bg-sand">
                  <span
                    className={cn(
                      "site-check-bar block h-1.5",
                      scored !== undefined && scored < 60 ? "bg-pink-ink" : "bg-ink",
                    )}
                    style={{ width: `${scored ?? 0}%` }}
                  />
                </span>
                <span className="mono-text text-right">
                  {scored ?? (
                    <>
                      <span aria-hidden="true">··</span>
                      <span className="sr-only">pending</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
