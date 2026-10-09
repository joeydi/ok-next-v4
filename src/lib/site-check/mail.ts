import { SITE } from "@/data/site";
import { confirmationEmail, reviewRequestEmail } from "./messages";
import type { SiteCheckRun } from "./schema";

// The review request, emailed to Joe through SendGrid with the run's evidence
// attached, and the confirmation link the visitor clicks first. Needs
// SENDGRID_API_KEY (without it, in development, the link is logged instead); the
// sender (SITE_CHECK_FROM, else the site's address) must be verified in SendGrid.

const TO = process.env.SITE_CHECK_TO ?? SITE.email;
const FROM = process.env.SITE_CHECK_FROM ?? SITE.email;

export async function sendReviewRequest(run: SiteCheckRun, email: string) {
  const { subject, text, filename } = reviewRequestEmail(run, email);
  const json = Buffer.from(JSON.stringify(run, null, 2)).toString("base64");

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
    console.log(`[site check] no SENDGRID_API_KEY; confirm link for ${host}: ${link}`);
    return;
  }
  const { subject, text } = confirmationEmail(host, link);
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: FROM, name: `${SITE.name} site check` },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid answered ${res.status}: ${await res.text()}`);
}
