import { runCheck } from "@/lib/site-check/checker/run";
import { checkOrigin } from "@/lib/site-check/guard";
import { LIMITS, spell } from "@/lib/site-check/limits";
import { logEvent, reasonOf } from "@/lib/site-check/log";
import {
  checkMeta,
  type FailReason,
  lastOfCategory,
  normalizeUrl,
  reduceRun,
  type SiteCheckEvent,
  type SiteCheckRun,
} from "@/lib/site-check/schema";
import {
  capReached,
  claimSlot,
  clientIp,
  countCaps,
  countRun,
  hasRunLeft,
  lockHost,
  recentRun,
  releaseSlot,
  saveRun,
  unlockHost,
} from "@/lib/site-check/store";
import { checkBot } from "@/lib/site-check/turnstile";

// POST { url } → the run as server-sent events (`data: <SiteCheckEvent>`), read by
// streamCheck in src/lib/site-check/client.ts. A host checked in the last 15 minutes is replayed
// from the store rather than checked again; otherwise the visitor's rate limit and
// a per-host lock come first, then the day's and the host's caps and the limit on
// runs under way at once. A replay spends none of those. A run only counts towards
// the limits once the site has answered.

export const maxDuration = 90;

/** The longest a replay of a stored run takes. */
const REPLAY_MS = 6000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/** A stored run's events again, sped up to take at most REPLAY_MS. */
async function* replay(run: SiteCheckRun, signal: AbortSignal): AsyncGenerator<SiteCheckEvent> {
  const scale = Math.min(1, REPLAY_MS / Math.max(1, run.duration ?? 1));
  yield { type: "run.started", id: run.id, url: run.url, host: run.host, startedAt: new Date().toISOString() };
  let clock = 0;
  for (const result of run.results) {
    if (signal.aborted) return;
    yield { type: "check.started", id: result.id, at: clock };
    const at = Math.max(clock, Math.round(result.at * scale));
    await sleep(at - clock, signal);
    clock = at;
    yield { type: "check.finished", result: { ...result, at } };
    const category = checkMeta(result.id).category;
    const score = run.categories.find((c) => c.id === category);
    if (score && lastOfCategory(score.id) === result.id) yield { type: "category.scored", category: score, at };
  }
  yield { type: "run.finished", score: run.score ?? 0, at: clock };
}

function* refuse(
  target: { url: string; host: string },
  reason: FailReason,
  message: string,
): Generator<SiteCheckEvent> {
  yield { type: "run.started", id: `sc_${crypto.randomUUID()}`, ...target, startedAt: new Date().toISOString() };
  yield { type: "run.failed", reason, message, at: 0 };
}

async function* events(request: Request, target: { url: string; host: string }): AsyncGenerator<SiteCheckEvent> {
  const cached = await recentRun(target.host);
  if (cached) {
    yield* replay(cached, request.signal);
    return;
  }
  const ip = clientIp(request);
  if (!(await hasRunLeft(ip))) {
    logEvent("rate-limited", { ip, host: target.host, reason: "ip" });
    yield* refuse(
      target,
      "rate-limited",
      `That’s ${spell(LIMITS.runsPerIpPerHour)} ${LIMITS.runsPerIpPerHour === 1 ? "check" : "checks"} in the last hour from your connection`,
    );
    return;
  }
  const cap = await capReached(target.host);
  if (cap === "day") {
    logEvent("day-capped", { ip, host: target.host });
    yield* refuse(target, "busy", "The checker has reached its limit for today");
    return;
  }
  if (cap === "host") {
    logEvent("host-capped", { ip, host: target.host });
    const n = LIMITS.runsPerHostPerHour;
    yield* refuse(
      target,
      "rate-limited",
      `${target.host} has been checked ${spell(n)} ${n === 1 ? "time" : "times"} in the last hour`,
    );
    return;
  }
  if (!(await lockHost(target.host))) {
    logEvent("rate-limited", { ip, host: target.host, reason: "host-locked" });
    yield* refuse(target, "rate-limited", `${target.host} is being checked right now`);
    return;
  }
  const slot = await claimSlot();
  if (!slot) {
    await unlockHost(target.host);
    logEvent("busy", { ip, host: target.host });
    yield* refuse(target, "busy", "The checker is busy right now");
    return;
  }
  // Freed as soon as the visitor leaves, not only when the generator winds down.
  const release = () => releaseSlot(slot);
  request.signal.addEventListener("abort", release, { once: true });
  let run: SiteCheckRun | null = null;
  try {
    for await (const event of runCheck(target, { signal: request.signal })) {
      run = reduceRun(run, event);
      // DNS finishes once the home page has answered: only then does the run count.
      if (event.type === "check.finished" && event.result.id === "dns") {
        await Promise.all([countRun(ip), countCaps(target.host)]);
      }
      yield event;
    }
    // Only a complete run can be reviewed or replayed.
    if (run?.status === "complete") await saveRun(run);
  } finally {
    request.signal.removeEventListener("abort", release);
    await Promise.all([releaseSlot(slot), unlockHost(target.host)]);
  }
}

export async function POST(request: Request) {
  const refused = checkOrigin(request);
  if (refused) return refused;
  const body = await request.json().catch(() => null);
  const botCheck = await checkBot(request, body);
  if (botCheck) return botCheck;
  const target = typeof body?.url === "string" ? normalizeUrl(body.url) : null;
  if (!target) return Response.json({ error: "invalid-url" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SiteCheckEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The visitor left; the run stops at its next check.
        }
      };
      try {
        for await (const event of events(request, target)) send(event);
      } catch (error) {
        logEvent("error", { host: target.host, reason: `run crashed: ${reasonOf(error)}` });
        send({ type: "run.failed", reason: "unreachable", message: "The check broke partway through", at: 0 });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
