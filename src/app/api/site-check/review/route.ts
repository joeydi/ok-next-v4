import { randomBytes } from "node:crypto";
import { SITE } from "@/data/site";
import { validateEmail } from "@/lib/site-check/email";
import { checkOrigin } from "@/lib/site-check/guard";
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

// POST { runId, email } → emails the visitor a confirmation link. The request only
// goes to Joe once they open it (./confirm), so no one can send him mail as someone
// else. The run is looked up by id, so what's sent is what the checker found, not
// what the page says it found.

export async function POST(request: Request) {
  const refused = checkOrigin(request);
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as Partial<ReviewRequest> | null;
  const { runId, email: given } = body ?? {};
  if (typeof runId !== "string" || !/^sc_[\w-]{8,64}$/.test(runId)) {
    return Response.json({ error: "bad-run" }, { status: 400 });
  }
  if (typeof given !== "string") return Response.json({ error: "bad-email" }, { status: 400 });
  if (!(await allowReview(clientIp(request)))) return Response.json({ error: "rate-limited" }, { status: 429 });
  const valid = await validateEmail(given);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const { email } = valid;
  const run = await getRun(runId);
  if (!run) return Response.json({ error: "not-found" }, { status: 404 });
  if (!(await allowReviewEmail(email))) return Response.json({ error: "email-limit" }, { status: 429 });
  if (!(await claimReviewRun(runId))) return Response.json({ error: "already-requested" }, { status: 409 });

  const token = randomBytes(24).toString("base64url");
  const origin = process.env.NODE_ENV === "production" ? SITE.url : new URL(request.url).origin;
  try {
    await savePending(token, { runId, email });
    await sendConfirmation(email, run.host, `${origin}/api/site-check/review/confirm?token=${token}`);
  } catch (error) {
    console.error(`[site check] confirmation for ${run.host} didn’t send`, error);
    await releaseReviewRun(runId);
    return Response.json({ error: "not-sent" }, { status: 502 });
  }
  return Response.json({ ok: true, confirm: true });
}
