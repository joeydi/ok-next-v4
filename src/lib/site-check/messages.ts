import { SITE } from "@/data/site";
import { siteCheckCopy, verdictFor } from "@/data/site-check";
import { renderConfirmationEmail } from "@/emails/ConfirmationEmail";
import { renderReviewRequestEmail } from "@/emails/ReviewRequestEmail";
import { formatTemplate } from "./copy-schema";
import { CATEGORIES, checkMeta, type SiteCheckRun } from "./schema";

/** Copy shown by the confirmation-link route. Kept here so the admin review is the route's source of truth. */
export const confirmationUi = siteCheckCopy.confirmation;

const MARK = { ok: "✓", warn: "!", fail: "✕", skipped: "–" } as const;

/** The email sent to the visitor before their personal-review request reaches Joe. */
export async function confirmationEmail(host: string, link: string) {
  const copy = siteCheckCopy.emails.confirmation;
  const subject = formatTemplate(copy.subject, { host });
  const intro = formatTemplate(copy.intro, { host });
  return {
    subject,
    text: [
      intro,
      "",
      link,
      "",
      copy.expiry,
      "",
      formatTemplate(copy.signature, { author: SITE.author, siteName: SITE.name }),
    ].join("\n"),
    html: await renderConfirmationEmail({
      title: confirmationUi.prompt.title,
      subject,
      intro,
      action: confirmationUi.prompt.action,
      link,
      expiry: copy.expiry,
    }),
  };
}

/** The email sent to Joe after the visitor confirms, including the check's evidence summary. */
export async function reviewRequestEmail(run: SiteCheckRun, email: string) {
  const copy = siteCheckCopy.emails.review;
  const categoryScores = CATEGORIES.map((c) => {
    const score = run.categories.find((s) => s.id === c.id)?.score;
    return { name: c.name, score: score ?? null };
  });
  const categories = categoryScores.map(({ name, score }) => `${name} ${score ?? "n/a"}`).join(" · ");
  const lines = run.results.map((r) => `${MARK[r.status]} ${checkMeta(r.id).name}: ${r.summary}`);
  const score = run.score ?? "–";
  const subject = formatTemplate(copy.subject, { host: run.host, score });
  const request = formatTemplate(copy.request, { email, url: run.url });
  const scoreLine = formatTemplate(copy.score, {
    score,
    verdict: run.score === null ? "" : verdictFor(run.score),
  });
  const runLine = formatTemplate(copy.run, { runId: run.id, checkedAt: new Date(run.startedAt).toUTCString() });
  return {
    subject,
    text: [
      // No full stop after the URL: mail clients link it along with the address.
      request,
      "",
      scoreLine,
      categories,
      "",
      ...lines,
      "",
      runLine,
      copy.attachment,
    ].join("\n"),
    html: await renderReviewRequestEmail({
      subject,
      request,
      scoreLine,
      categories: categoryScores,
      results: run.results.map((result) => ({
        mark: MARK[result.status],
        status: result.status,
        summary: `${checkMeta(result.id).name}: ${result.summary}`,
      })),
      runLine,
      attachment: copy.attachment,
    }),
    filename: `${run.host}-${run.id}.json`,
  };
}
