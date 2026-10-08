"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { siteCheck as copy } from "@/data/site-check";
import type { Media } from "@/lib/media";
import { streamCheck } from "@/lib/site-check/client";
import { STAGE_AT, sampleRunAt } from "@/lib/site-check/sample";
import { normalizeUrl, reduceRun, type SiteCheckRun } from "@/lib/site-check/schema";
import { CheckLog, seconds, tally } from "./CheckLog";
import { ReviewCard } from "./ReviewCard";
import { ScoreCard } from "./ScoreCard";

/** A state to open on, for reviewing the design without waiting on a run. */
export type SiteCheckStage = "running" | "result" | "sent" | "failed";

const TICK = 80; // ms between clock updates while a run streams: the spinner's frame rate

/**
 * The free site check: the URL field, then the run as it streams in from the checker
 * (the log, the score) and the ask for a personal review. A pinned `stage` shows the
 * sample run instead, for reviewing the design.
 */
export function SiteCheck({ stage, headshot }: { stage?: SiteCheckStage; headshot: Media }) {
  const [run, dispatch] = useReducer(reduceRun, null, () =>
    stage ? sampleRunAt(stage === "sent" ? "result" : stage) : null,
  );
  const [input, setInput] = useState(run?.host ?? "");
  const [invalid, setInvalid] = useState(false);
  const [sentTo, setSentTo] = useState(stage === "sent" ? "comms@yourorganization.org" : null);
  // A pinned run holds its clock where the stage stops it; a live one reads the time.
  // A live run's clock is the browser's own, from when it was asked for.
  const [live, setLive] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const stop = useRef<() => void>(undefined);

  const running = run?.status === "running";

  useEffect(() => () => stop.current?.(), []);

  useEffect(() => {
    if (!live || !running) return;
    const id = setInterval(() => setNow(Date.now()), TICK);
    return () => clearInterval(id);
  }, [live, running]);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const target = normalizeUrl(input);
    setInvalid(!target);
    if (!target || running) return;
    stop.current?.();
    setSentTo(null);
    setLive(true);
    setStartedAt(Date.now());
    setNow(Date.now());
    stop.current = streamCheck(target.url, target.host, dispatch);
  };

  const elapsed = !run
    ? 0
    : run.duration !== null
      ? run.duration
      : live
        ? Math.max(0, now - startedAt)
        : STAGE_AT.running;

  const label = running
    ? copy.run.running
    : run?.status === "failed"
      ? copy.run.retry
      : run
        ? copy.run.again
        : copy.run.idle;

  return (
    <>
      <form
        onSubmit={start}
        noValidate
        className="frame mt-fl-40 flex flex-wrap items-center gap-x-fl-16 gap-y-2 bg-ink py-2 pr-2 pl-fl-24 focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-pink-ink/69"
      >
        <label htmlFor="site-check-url" className="font-mono text-fl-18 font-medium whitespace-nowrap text-pink">
          <span aria-hidden="true">{copy.prompt}</span>
          <span className="sr-only">{copy.field}</span>
        </label>
        <input
          id="site-check-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder={copy.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "site-check-url-error" : undefined}
          className="h-14 min-w-0 flex-[1_1_220px] bg-transparent font-mono text-fl-18 font-medium tracking-label-tight text-paper placeholder:text-muted-light focus:outline-none"
        />
        <button
          type="submit"
          disabled={running}
          className="mono-label min-h-14 shrink-0 cursor-pointer rounded-xs bg-pink px-fl-24 text-ink focus-visible:outline-pink/80 disabled:cursor-default disabled:opacity-70"
        >
          {label} <span className="nudge">→</span>
        </button>
      </form>
      {invalid && (
        <p id="site-check-url-error" role="alert" className="mt-fl-12 text-fl-18 leading-copy text-pink-ink">
          {copy.invalid}
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {announce(run)}
      </p>

      {run ? (
        <section className="pt-fl-64 pb-fl-96">
          <Eyebrow details={[run.host]}>{copy.resultsLabel}</Eyebrow>
          <div className="mt-fl-28 flex flex-col gap-fl-24">
            <CheckLog run={run} elapsed={elapsed} />
            <aside className="flex flex-col gap-fl-24">
              {run.status !== "failed" && <ScoreCard key={run.id} run={run} animate={live} />}
              {running && (
                <p className="rounded-sm border border-dashed border-guide px-fl-20 py-fl-18 text-fl-18 leading-copy text-muted">
                  {copy.scoreNote}
                </p>
              )}
              {run.status === "complete" && (
                <ReviewCard run={run} headshot={headshot} sentTo={sentTo} onSent={setSentTo} />
              )}
            </aside>
          </div>
        </section>
      ) : (
        <section className="py-fl-96">
          <Eyebrow>{copy.lookLabel}</Eyebrow>
          <ol className="mt-fl-28 grid gap-x-fl-24 sm:grid-cols-2">
            {copy.items.map((t, i) => (
              <li key={t} className="flex gap-fl-16 border-t border-rule pt-fl-18 pb-fl-22">
                <span className="mono-text shrink-0 text-pink-ink">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-fl-18 leading-copy text-pretty text-body">{t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-fl-24 text-fl-18 leading-copy text-muted">{copy.closing}</p>
        </section>
      )}
    </>
  );
}

/** What a screen reader hears: the start and the end of a run, not every line. */
function announce(run: SiteCheckRun | null) {
  if (!run) return "";
  if (run.status === "running") return `Checking ${run.host}…`;
  if (run.failure) return `Check failed. ${run.failure.message}.`;
  return `Done in ${seconds(run.duration ?? 0)}. Score ${run.score} out of 100. ${tally(run)}.`;
}
