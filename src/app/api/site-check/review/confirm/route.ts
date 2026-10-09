import { SITE } from "@/data/site";
import { checkOrigin } from "@/lib/site-check/guard";
import { logEvent, reasonOf } from "@/lib/site-check/log";
import { sendReviewRequest } from "@/lib/site-check/mail";
import { confirmationUi as copy } from "@/lib/site-check/messages";
import { getRun, releaseReviewRun, takePending } from "@/lib/site-check/store";

// The link in the confirmation email. GET only shows a button, since mail
// scanners open links and would use the token up; the button POSTs it back, and
// that forwards the review request to Joe, with the visitor as reply-to.

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const TOKEN = /^[\w-]{20,64}$/;

const page = (title: string, message: string, form?: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · ${SITE.name}</title><link rel="preconnect" href="https://use.typekit.net" crossorigin><link rel="stylesheet" href="https://use.typekit.net/llb6krb.css"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4efe6;color:#1a1a1a;font:18px/1.5 system-ui,sans-serif}main{max-width:30rem;padding:2rem}h1{font:400 2rem/1.07 gelica,Georgia,serif;letter-spacing:-.022em;margin:0 0 1rem}button{min-height:3.5rem;padding:0 1.5rem;border:0;border-radius:2px;background:#ff5fa2;color:#1a1a1a;cursor:pointer;font:500 14px/1.6 ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase}button span{display:inline-block;margin-left:.2em}a{color:inherit}</style></head><body><main><h1>${title}</h1><p>${message}</p>${form ?? ""}<p><a href="/site-check">${copy.back}</a></p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

const expired = () =>
  page(
    copy.expired.title,
    `${copy.expired.messageBeforeEmail} <a href="mailto:${SITE.email}">${SITE.email}</a>.`,
    undefined,
    410,
  );

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN.test(token)) return expired();
  return page(
    copy.prompt.title,
    copy.prompt.message,
    `<form method="post" action="/api/site-check/review/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">${copy.prompt.action} <span aria-hidden="true">→</span></button></form>`,
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
      `${copy.failed.messageBeforeEmail} <a href="mailto:${SITE.email}">${SITE.email}</a>.`,
      undefined,
      502,
    );
  }
  logEvent("review-confirmed", { host: run.host, domain: pending.email.split("@")[1] });
  return page(copy.confirmed.title, copy.confirmed.message(esc(run.host), esc(pending.email)));
}
