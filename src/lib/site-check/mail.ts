import { SITE } from "@/data/site";
import { verdictFor } from "@/data/site-check";
import { CATEGORIES, checkMeta, type SiteCheckRun } from "./schema";

// The review request, emailed to Joe through SendGrid with the run's evidence
// attached, and the confirmation link the visitor clicks first. Needs
// SENDGRID_API_KEY (without it, in development, the link is logged instead); the
// sender (SITE_CHECK_FROM, else the site's address) must be verified in SendGrid.

const TO = process.env.SITE_CHECK_TO ?? SITE.email;
const FROM = process.env.SITE_CHECK_FROM ?? SITE.email;

const MARK = { ok: "✓", warn: "!", fail: "✕", skipped: "–" } as const;

function body(run: SiteCheckRun, email: string) {
  const categories = CATEGORIES.map((c) => {
    const score = run.categories.find((s) => s.id === c.id)?.score;
    return `${c.name} ${score ?? "n/a"}`;
  }).join(" · ");
  const lines = run.results.map((r) => `${MARK[r.status]} ${checkMeta(r.id).name}: ${r.summary}`);
  return [
    // No full stop after the URL: mail clients link it along with the address.
    `${email} asked for a review of ${run.url}`,
    "",
    `Score: ${run.score ?? "–"} / 100. ${run.score === null ? "" : verdictFor(run.score)}`,
    categories,
    "",
    ...lines,
    "",
    `Run ${run.id}, checked ${new Date(run.startedAt).toUTCString()}.`,
    "Each check’s evidence is attached as JSON. Reply to answer them directly.",
  ].join("\n");
}

export async function sendReviewRequest(run: SiteCheckRun, email: string) {
  const subject = `Site check review: ${run.host} (${run.score ?? "–"})`;
  const text = body(run, email);
  const json = Buffer.from(JSON.stringify(run, null, 2)).toString("base64");
  const filename = `${run.host}-${run.id}.json`;

  if (!process.env.SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY isn’t set");
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: TO }] }],
      from: { email: FROM, name: `${SITE.name} site check` },
      reply_to: { email },
      subject,
      content: [{ type: "text/plain", value: text }],
      attachments: [{ content: json, filename, type: "application/json", disposition: "attachment" }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid answered ${res.status}: ${await res.text()}`);
}

/** Emails the visitor a link to confirm their address; the request only reaches Joe once it's opened. */
export async function sendConfirmation(email: string, host: string, link: string) {
  if (!process.env.SENDGRID_API_KEY) {
    if (process.env.NODE_ENV === "production") throw new Error("SENDGRID_API_KEY isn’t set");
    console.log(`[site check] no SENDGRID_API_KEY; confirm link for ${email}: ${link}`);
    return;
  }
  const text = [
    `You asked for a personal review of ${host}. Confirm your email to send the request:`,
    "",
    link,
    "",
    "The link works once and expires in an hour. If you didn’t ask, ignore this and nothing happens.",
    "",
    `${SITE.author}, ${SITE.name}`,
  ].join("\n");
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: FROM, name: `${SITE.name} site check` },
      subject: `Confirm your review request for ${host}`,
      content: [{ type: "text/plain", value: text }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid answered ${res.status}: ${await res.text()}`);
}
