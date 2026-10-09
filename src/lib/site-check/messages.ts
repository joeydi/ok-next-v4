import { SITE } from "@/data/site";
import { verdictFor } from "@/data/site-check";
import { CATEGORIES, checkMeta, type SiteCheckRun } from "./schema";

/** Copy shown by the confirmation-link route. Kept here so the admin review is the route's source of truth. */
export const confirmationUi = {
  back: "Back to the site check",
  expired: {
    title: "That link has expired.",
    messageBeforeEmail:
      "Confirmation links work once and last an hour. Run the site check again to get a new one, or email",
  },
  prompt: {
    title: "Confirm your review request.",
    message: "One more click and I’ll go through your site myself.",
    action: "Confirm my email",
  },
  failed: {
    title: "That didn’t send.",
    messageBeforeEmail: "Sorry, something went wrong on my end. Email me at",
  },
  confirmed: {
    title: "You’re confirmed.",
    message: (host: string, email: string) => `Thanks. I’ll go through ${host} and send your report to ${email}.`,
  },
} as const;

const MARK = { ok: "✓", warn: "!", fail: "✕", skipped: "–" } as const;

/** The email sent to the visitor before their personal-review request reaches Joe. */
export function confirmationEmail(host: string, link: string) {
  return {
    subject: `Confirm your review request for ${host}`,
    text: [
      `You asked for a personal review of ${host}. Confirm your email to send the request:`,
      "",
      link,
      "",
      "The link works once and expires in an hour. If you didn’t ask, ignore this and nothing happens.",
      "",
      `${SITE.author}, ${SITE.name}`,
    ].join("\n"),
  };
}

/** The email sent to Joe after the visitor confirms, including the check's evidence summary. */
export function reviewRequestEmail(run: SiteCheckRun, email: string) {
  const categories = CATEGORIES.map((c) => {
    const score = run.categories.find((s) => s.id === c.id)?.score;
    return `${c.name} ${score ?? "n/a"}`;
  }).join(" · ");
  const lines = run.results.map((r) => `${MARK[r.status]} ${checkMeta(r.id).name}: ${r.summary}`);
  return {
    subject: `Site check review: ${run.host} (${run.score ?? "–"})`,
    text: [
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
    ].join("\n"),
    filename: `${run.host}-${run.id}.json`,
  };
}
