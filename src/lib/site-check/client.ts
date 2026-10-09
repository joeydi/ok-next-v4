import type { ReviewRequest, SiteCheckEvent } from "./schema";

// The page's side of the checker: start a run and hand each streamed event to
// `onEvent`, and send the review request. A run that ends without finishing (a
// dropped connection, a crash) is closed with a `run.failed`, so the page never
// waits on it forever.

/** Streams a run of `url` to `onEvent`. Returns a function that stops it. */
export function streamCheck(url: string, host: string, onEvent: (event: SiteCheckEvent) => void) {
  const controller = new AbortController();
  let started = false;
  let ended = false;
  const startedAt = Date.now();

  const emit = (event: SiteCheckEvent) => {
    if (event.type === "run.started") started = true;
    if (event.type === "run.finished" || event.type === "run.failed") ended = true;
    onEvent(event);
  };
  const fail = (message: string) => {
    if (!started) {
      emit({ type: "run.started", id: "sc_local", url, host, startedAt: new Date(startedAt).toISOString() });
    }
    emit({ type: "run.failed", reason: "timeout", message, at: Date.now() - startedAt });
  };

  (async () => {
    const res = await fetch("/api/site-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
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

/** Why a review request was refused: the `error` the route answered with, or "failed" if it didn't answer. */
export class ReviewError extends Error {
  constructor(readonly code: string) {
    super(`Review request failed (${code})`);
  }
}

/** Asks for the personal review of a finished run; a confirmation link goes to the visitor first. Throws a `ReviewError` if it didn't send. */
export async function sendReviewRequest(request: ReviewRequest) {
  const res = await fetch("/api/site-check/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => null)) ?? {};
    throw new ReviewError(typeof error === "string" ? error : "failed");
  }
}
