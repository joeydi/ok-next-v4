import { sendReviewRequest } from "@/lib/site-check/mail";
import type { ReviewRequest } from "@/lib/site-check/schema";
import { allowReview, clientIp, getRun } from "@/lib/site-check/store";

// POST { runId, email } → emails Joe the stored run for a personal review. The run
// is looked up by id, so what's sent is what the checker found, not what the page
// says it found. Dev-only alongside the page.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ReviewRequest> | null;
  const { runId, email } = body ?? {};
  if (typeof runId !== "string" || !/^sc_[\w-]{8,64}$/.test(runId)) {
    return Response.json({ error: "bad-run" }, { status: 400 });
  }
  if (typeof email !== "string" || email.length > 254 || !EMAIL.test(email)) {
    return Response.json({ error: "bad-email" }, { status: 400 });
  }
  if (!(await allowReview(clientIp(request)))) return Response.json({ error: "rate-limited" }, { status: 429 });
  const run = await getRun(runId);
  if (!run) return Response.json({ error: "not-found" }, { status: 404 });
  try {
    await sendReviewRequest(run, email);
  } catch (error) {
    console.error(`[site check] review request for ${run.host} didn’t send`, error);
    return Response.json({ error: "not-sent" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
