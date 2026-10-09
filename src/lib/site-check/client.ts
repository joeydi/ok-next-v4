import type { FailReason, ReviewRequest, SiteCheckEvent } from "./schema";

// The page's side of the checker: start a run and hand each streamed event to
// `onEvent`, and send the review request. A run that ends without finishing (a
// dropped connection, a crash) is closed with a `run.failed`, so the page never
// waits on it forever.

/** The bot check's part of a request: a Turnstile token (null when it isn't set up) and the honeypot field's value. */
export type BotCheck = { token: string | null; website: string };

/** Streams a run of `url` to `onEvent`. Returns a function that stops it. `bot` is asked for once the run is started. */
export function streamCheck(
  url: string,
  host: string,
  bot: () => Promise<BotCheck>,
  onEvent: (event: SiteCheckEvent) => void,
) {
  const controller = new AbortController();
  let started = false;
  let ended = false;
  const startedAt = Date.now();

  const emit = (event: SiteCheckEvent) => {
    if (event.type === "run.started") started = true;
    if (event.type === "run.finished" || event.type === "run.failed") ended = true;
    onEvent(event);
  };
  const fail = (message: string, reason: FailReason = "timeout") => {
    if (!started) {
      emit({ type: "run.started", id: "sc_local", url, host, startedAt: new Date(startedAt).toISOString() });
    }
    emit({ type: "run.failed", reason, message, at: Date.now() - startedAt });
  };

  (async () => {
    const { token, website } = await bot();
    if (controller.signal.aborted) return;
    const res = await fetch("/api/site-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, token, website }),
      signal: controller.signal,
    });
    if (res.status === 403 && (await res.json().catch(() => null))?.error === "bot-check") {
      return fail("The bot check didn’t pass");
    }
    if (!res.ok || !res.body) return fail("The checker couldn’t start");
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";
      for (const message of messages) {
        const data = message
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6))
          .join("\n");
        if (data) emit(JSON.parse(data) as SiteCheckEvent);
      }
    }
    if (!ended) fail("Lost the connection to the checker");
  })().catch((error) => {
    if (controller.signal.aborted) return;
    console.error("[site check]", error);
    if (!ended) fail("Lost the connection to the checker");
  });

  return () => controller.abort();
}

/** Asks for the personal review of a finished run. Throws if it didn't send. */
export async function sendReviewRequest(request: ReviewRequest, bot: BotCheck) {
  const res = await fetch("/api/site-check/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, ...bot }),
  });
  if (!res.ok) throw new Error(`Review request failed (${res.status})`);
}
