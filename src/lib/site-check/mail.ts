import { SITE } from "@/data/site";
import { sendMail } from "@/lib/mail";
import { confirmationEmail, reviewRequestEmail } from "./messages";
import type { SiteCheckRun } from "./schema";

// The review request, emailed to Joe through SendGrid with the run's evidence
// attached, and the confirmation link the visitor clicks first. Needs
// SENDGRID_API_KEY (without it, in development, the link is logged instead); the
// sender (SITE_CHECK_FROM, else the site's address) must be verified in SendGrid.

const TO = process.env.SITE_CHECK_TO ?? SITE.email;
const FROM = { email: process.env.SITE_CHECK_FROM ?? SITE.email, name: `${SITE.name} site check` };

export async function sendReviewRequest(run: SiteCheckRun, email: string) {
  const { subject, text, html, filename } = await reviewRequestEmail(run, email);
  const json = Buffer.from(JSON.stringify(run, null, 2)).toString("base64");

  if (!process.env.SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY isn’t set");
  await sendMail({
    to: TO,
    from: FROM,
    replyTo: email,
    subject,
    text,
    html,
    attachments: [{ content: json, filename, type: "application/json" }],
  });
}

/** Emails the visitor a link to confirm their address; the request only reaches Joe once it's opened. */
export async function sendConfirmation(email: string, host: string, link: string) {
  if (!process.env.SENDGRID_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(`[site check] no SENDGRID_API_KEY; confirm link for ${host}: ${link}`);
    return;
  }
  const { subject, text, html } = await confirmationEmail(host, link);
  await sendMail({ to: email, from: FROM, subject, text, html });
}
