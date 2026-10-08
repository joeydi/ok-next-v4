import { useEffect, useRef, useState } from "react";
import { siteCheck as copy } from "@/data/site-check";
import { cn } from "@/lib/cn";
import { CHECKS, type CheckStatus, checkMeta, type SiteCheckRun } from "@/lib/site-check/schema";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const MARK: Record<CheckStatus, { mark: string; className: string; label: string }> = {
  ok: { mark: "✓", className: "text-term-green", label: "passed" },
  warn: { mark: "!", className: "text-term-yellow", label: "to watch" },
  fail: { mark: "✕", className: "text-pink", label: "to fix" },
  skipped: { mark: "–", className: "text-muted-light", label: "skipped" },
};

const pad = (v: number, w = 2) => String(v).padStart(w, "0");

/** Wall-clock time `at` ms into the run: 14:02:07.300. */
function clock(startedAt: string, at: number) {
  const d = new Date(Date.parse(startedAt) + at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function tally(run: SiteCheckRun) {
  const n = (s: CheckStatus) => run.results.filter((r) => r.status === s).length;
  return `${n("ok")} passed · ${n("warn")} to watch · ${n("fail")} to fix`;
}

/** Columns shared by finished and running lines, so they line up. */
const line = "flex flex-wrap items-baseline gap-x-fl-12 py-0.5";

/**
 * The log the checks stream into, under the URL field in the same ink panel.
 * `elapsed` is ms since the run started. The progress bar shows only while it runs.
 * Its height eases to fit as lines arrive; `animate` also opens it from nothing.
 */
export function CheckLog({ run, elapsed, animate }: { run: SiteCheckRun; elapsed: number; animate?: boolean }) {
  const running = run.status === "running";
  const progress = run.status === "complete" ? 1 : run.results.length / CHECKS.length;
  const current = run.current && checkMeta(run.current);
  const { ref: fitRef, px: fitHeight } = useFitHeight(animate ? 0 : undefined);

  return (
    <div className="relative border-t border-ink-2 font-mono text-fl-14 leading-copy font-medium text-paper">
      <div
        className="site-check-progress absolute inset-x-0 -top-px h-0.5 bg-paper/8"
        data-done={running ? undefined : ""}
      >
        <div key={run.id} className="site-check-bar h-0.5 bg-pink" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="site-check-height overflow-hidden" style={{ height: fitHeight }}>
        <div ref={fitRef}>
          <div className="flex flex-wrap items-center justify-between gap-x-fl-16 gap-y-2 border-b border-ink-2 px-fl-24 py-fl-12">
            <span className="mono-label text-muted-light">/ {copy.logLabel}</span>
            <span className="flex flex-wrap items-center gap-x-fl-18 gap-y-1 text-muted-light">
              <span>{run.host}</span>
              <span>{seconds(elapsed)}</span>
              <span className="inline-flex items-center gap-2 text-paper">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    running ? "site-check-pulse bg-pink" : run.status === "failed" ? "bg-pink" : "bg-term-green",
                  )}
                />
                {running
                  ? `Running ${run.results.length} / ${CHECKS.length}`
                  : run.status === "failed"
                    ? "Failed"
                    : "Complete"}
              </span>
            </span>
          </div>

          <div className="px-fl-24 pt-fl-18 pb-fl-22">
            <ol aria-label={copy.logLabel}>
              {run.results.map((r) => {
                const m = MARK[r.status];
                return (
                  <li key={r.id} className={cn(line, "site-check-rise")}>
                    <span className="shrink-0 text-muted-light">{clock(run.startedAt, r.at)}</span>
                    <span className={cn("w-3.5 shrink-0", m.className)}>
                      <span aria-hidden="true">{m.mark}</span>
                      <span className="sr-only">{m.label}:</span>
                    </span>
                    <span className="w-[9em] shrink-0">{checkMeta(r.id).name}</span>
                    <span className="min-w-0 flex-[1_1_18em] text-paper/78">{r.summary}</span>
                  </li>
                );
              })}
            </ol>

            {current && (
              <div className={line} aria-hidden="true">
                <span className="shrink-0 text-muted-light">{clock(run.startedAt, elapsed)}</span>
                <span className="w-3.5 shrink-0 text-pink">{SPINNER[Math.floor(elapsed / 80) % SPINNER.length]}</span>
                <span className="flex-[1_1_18em]">
                  {current.running}…<span className="site-check-caret text-pink">▍</span>
                </span>
              </div>
            )}

            {run.status === "complete" && (
              <div className="site-check-rise mt-3.5 border-t border-ink-2 pt-3.5">
                <div>
                  <span className="text-term-green">✓</span> Done in {seconds(elapsed)} · {tally(run)}
                </div>
                <div className="text-muted-light">→ {copy.done}</div>
              </div>
            )}

            {run.failure && (
              <div className="site-check-rise mt-3.5 border-t border-ink-2 pt-3.5">
                <div>
                  <span className="text-pink">✕</span> {run.failure.message}
                </div>
                <div className="text-muted-light">→ {copy.failed[run.failure.reason]}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Height for a box that eases between sizes: `ref` goes on its content, and the box
 * takes `px`, the content's measured height. Starts at `initial` (auto when undefined).
 */
function useFitHeight(initial?: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setPx(entry.borderBoxSize[0].blockSize));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, px };
}
