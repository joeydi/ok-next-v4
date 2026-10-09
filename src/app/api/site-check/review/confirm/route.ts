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

const page = (title: string, message: string, form?: string, status = 200) => {
  const safeTitle = esc(title);
  // This standalone response does not inherit globals.css; these are its paper, ink and pink palette tokens.
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${safeTitle} · ${SITE.name}</title><link rel="preconnect" href="https://use.typekit.net" crossorigin><link rel="stylesheet" href="https://use.typekit.net/llb6krb.css"><style>:root{--color-paper:hsl(18 25.2% 92%);--color-ink:hsl(264 10.3% 16%);--color-pink:hsl(350 100% 65%)}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--color-paper);color:var(--color-ink);font:18px/1.5 system-ui,sans-serif}main{max-width:30rem;padding:2rem}h1{font:400 2rem/1.07 gelica,Georgia,serif;letter-spacing:-.022em;margin:0 0 1rem}button{min-height:3.5rem;padding:0 1.5rem;border:0;border-radius:2px;background:var(--color-pink);color:var(--color-ink);cursor:pointer;font:500 14px/1.6 ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase}button span{display:inline-block;margin-left:.2em}a{color:inherit}</style></head><body><main><h1>${safeTitle}</h1><p>${message}</p>${form ?? ""}<p><a href="/site-check">${esc(copy.back)}</a></p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
};

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
  logEvent("review-confirmed", { host: run.host, domain: pending.email.split("@")[1] });
  return page(
    copy.confirmed.title,
    htmlMessage(copy.confirmed.message, {
      host: { text: run.host },
      email: { text: pending.email },
    }),
  );
}
