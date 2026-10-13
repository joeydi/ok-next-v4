import { after } from "next/server";
import { SITE } from "@/data/site";
import { saveConfirmedReview, saveSiteCheckRun } from "@/lib/site-check/database";
import { checkOrigin } from "@/lib/site-check/guard";
import { logEvent, reasonOf } from "@/lib/site-check/log";
import { sendReviewRequest } from "@/lib/site-check/mail";
import { confirmationUi as copy } from "@/lib/site-check/messages";
import { getRun, releaseReviewRun, takePending } from "@/lib/site-check/store";
import { esc, standalonePage } from "@/lib/standalone-page";

// The link in the confirmation email. GET only shows a button, since mail
// scanners open links and would use the token up; the button POSTs it back, and
// that forwards the review request to Joe, with the visitor as reply-to.

const htmlMessage = (template: string, values: Record<string, { text: string; href?: string }>) =>
  template
    .split(/({{[a-zA-Z][a-zA-Z0-9]*}})/)
    .filter(Boolean)
    .map((part) => {
      const match = /^{{([a-zA-Z][a-zA-Z0-9]*)}}$/.exec(part);
      if (!match) return esc(part);
      const value = values[match[1]];
      if (!value) throw new Error(`No value supplied for ${part}.`);
      return value.href ? `<a href="${esc(value.href)}">${esc(value.text)}</a>` : esc(value.text);
    })
    .join("");

const TOKEN = /^[\w-]{20,64}$/;

const page = (title: string, message: string, form?: string, status = 200) =>
  standalonePage({ title, message, form, status, back: { href: "/site-check", label: copy.back } });

const expired = () =>
  page(
    copy.expired.title,
    htmlMessage(copy.expired.message, {
      supportEmail: { text: SITE.email, href: `mailto:${SITE.email}` },
    }),
    undefined,
    410,
  );

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN.test(token)) return expired();
  return page(
    copy.prompt.title,
    esc(copy.prompt.message),
    `<form method="post" action="/api/site-check/review/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">${esc(copy.prompt.action)} <span aria-hidden="true">→</span></button></form>`,
  );
}

export async function POST(request: Request) {
  const refused = checkOrigin(request);
  if (refused) return refused;
  const token = String((await request.formData().catch(() => null))?.get("token") ?? "");
  if (!TOKEN.test(token)) return expired();
  const pending = await takePending(token);
  if (!pending) return expired();
  const run = await getRun(pending.runId);
  try {
    if (!run) throw new Error(`run ${pending.runId} is gone`);
    await sendReviewRequest(run, pending.email);
  } catch (error) {
    logEvent("error", { host: run?.host, reason: `confirmed review request didn’t send: ${reasonOf(error)}` });
    await releaseReviewRun(pending.runId);
    return page(
      copy.failed.title,
      htmlMessage(copy.failed.message, {
        supportEmail: { text: SITE.email, href: `mailto:${SITE.email}` },
      }),
      undefined,
      502,
    );
  }
  // The administrator email is the primary workflow; Turso persistence is fail-open and runs once the page
  // has been sent. The run is saved again first, in case its own write failed when the check finished.
  const confirmed = { run, email: pending.email };
  after(async () => {
    await saveSiteCheckRun(confirmed.run);
    await saveConfirmedReview(confirmed.run.id, confirmed.email);
  });
  logEvent("review-confirmed", { host: run.host, domain: pending.email.split("@")[1] });
  return page(
    copy.confirmed.title,
    htmlMessage(copy.confirmed.message, {
      host: { text: run.host },
      email: { text: pending.email },
    }),
  );
}
