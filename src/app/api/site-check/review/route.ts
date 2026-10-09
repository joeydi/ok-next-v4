import { randomBytes } from "node:crypto";
import { SITE } from "@/data/site";
import { validateEmail } from "@/lib/site-check/email";
import { checkOrigin } from "@/lib/site-check/guard";
import { logEvent, reasonOf } from "@/lib/site-check/log";
import { sendConfirmation } from "@/lib/site-check/mail";
import type { ReviewRequest } from "@/lib/site-check/schema";
import {
  allowReview,
  allowReviewEmail,
  claimReviewRun,
  clientIp,
  getRun,
  releaseReviewRun,
  savePending,
} from "@/lib/site-check/store";
import { checkBot } from "@/lib/site-check/turnstile";

// POST { runId, email } → emails the visitor a confirmation link. The request only
// goes to Joe once they open it (./confirm), so no one can send him mail as someone
// else. The run is looked up by id, so what's sent is what the checker found, not
// what the page says it found.

export async function POST(request: Request) {
  const refused = checkOrigin(request);
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as Partial<ReviewRequest> | null;
  const botCheck = await checkBot(request, body);
  if (botCheck) return botCheck;
  const { runId, email: given } = body ?? {};
  if (typeof runId !== "string" || !/^sc_[\w-]{8,64}$/.test(runId)) {
    return Response.json({ error: "bad-run" }, { status: 400 });
  }
  if (typeof given !== "string") return Response.json({ error: "bad-email" }, { status: 400 });
  const ip = clientIp(request);
  if (!(await allowReview(ip))) {
    logEvent("rate-limited", { ip, reason: "review" });
    return Response.json({ error: "rate-limited" }, { status: 429 });
  }
  const valid = await validateEmail(given);
  if (!valid.ok) {
    logEvent(valid.error, {
      ip,
      domain: given.includes("@") ? given.split("@").pop()?.trim().toLowerCase().slice(0, 100) : undefined,
    });
    return Response.json({ error: valid.error }, { status: 400 });
  }
  const { email } = valid;
  const run = await getRun(runId);
  if (!run) return Response.json({ error: "not-found" }, { status: 404 });
  if (!(await allowReviewEmail(email))) {
    logEvent("email-limit", { ip, host: run.host, domain: email.split("@")[1] });
    return Response.json({ error: "email-limit" }, { status: 429 });
  }
  if (!(await claimReviewRun(runId))) return Response.json({ error: "already-requested" }, { status: 409 });

  const token = randomBytes(24).toString("base64url");
  // Never built from the request's Host header. Previews run with NODE_ENV=production too, so they use their own URL.
  const previewHost = process.env.VERCEL_ENV === "preview" ? process.env.VERCEL_URL : undefined;
  const origin = previewHost
    ? `https://${previewHost}`
    : process.env.NODE_ENV === "production"
      ? SITE.url
      : new URL(request.url).origin;
  try {
    await savePending(token, { runId, email });
    await sendConfirmation(email, run.host, `${origin}/api/site-check/review/confirm?token=${token}`);
  } catch (error) {
    logEvent("error", { ip, host: run.host, reason: `confirmation didn’t send: ${reasonOf(error)}` });
    await releaseReviewRun(runId);
    return Response.json({ error: "not-sent" }, { status: 502 });
  }
  logEvent("review-requested", { ip, host: run.host, domain: email.split("@")[1] });
  return Response.json({ ok: true, confirm: true });
}
