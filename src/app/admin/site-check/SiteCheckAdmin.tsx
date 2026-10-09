import { Accent } from "@/components/Accent";
import { SITE } from "@/data/site";
import { siteCheck as copy, siteCheckCopy } from "@/data/site-check";
import { formatTemplate, templateParts } from "@/lib/site-check/copy-schema";
import { confirmationEmail, confirmationUi, reviewRequestEmail } from "@/lib/site-check/messages";
import { sampleRunAt } from "@/lib/site-check/sample";
import { EditableCopyField } from "./EditableCopyField";
import { EmailHtmlPreview } from "./EmailHtmlPreview";

const sampleEmail = "hello@yourorganization.org";
const sampleLink = `${SITE.url}/api/site-check/review/confirm?token=[confirmation-token]`;

const surface = "rounded-lg border border-rule bg-paper-light/60 px-fl-24 py-fl-24";
const smallLabel = "mono-label text-muted";

/** Every user-facing score and review-email message, editable in development. */
export async function SiteCheckAdmin() {
  const run = sampleRunAt("result");
  if (!run) throw new Error("The complete Site Check sample is missing");

  const [visitorEmail, reviewEmail] = await Promise.all([
    confirmationEmail(run.host, sampleLink),
    reviewRequestEmail(run, sampleEmail),
  ]);

  return (
    <div className="pt-fl-56 pb-fl-96 font-mono text-[12px]">
      <header className="mb-fl-32 flex flex-col gap-fl-8 border-b border-rule pb-fl-24">
        <span className={smallLabel}>/ Admin · dev only</span>
        <h1 className="display text-fl-48 leading-heading-48 tracking-display-48">Site Check</h1>
        <p className="max-w-3xl font-mono text-fl-14 leading-copy text-muted">
          Review and edit the production score, email capture, confirmation, and email-template copy.
        </p>
      </header>

      <nav aria-label="Site Check copy sections" className="mb-fl-48 flex flex-wrap gap-x-fl-24 gap-y-fl-8">
        {[
          ["Score", "score"],
          ["Email box", "email-box"],
          ["Confirmation UI", "confirmation-ui"],
          ["Email templates", "email-templates"],
        ].map(([label, id]) => (
          <a key={id} href={`#${id}`} className="border-b border-pink text-fl-14">
            {label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-fl-64">
        <Section id="score" number="01" title="Your Score">
          <div className="grid gap-fl-16 xl:grid-cols-3">
            <EditableCopyField fieldPath="score.label" label="Card label" value={siteCheckCopy.score.label} />
            <EditableCopyField fieldPath="score.pending" label="Pending score" value={siteCheckCopy.score.pending} />
            <EditableCopyField
              fieldPath="score.note"
              label="Helper · defined, not currently shown"
              value={siteCheckCopy.score.note}
              multiline
            />
          </div>

          <div className="mt-fl-24 overflow-hidden rounded-lg border border-rule">
            <table className="w-full border-collapse text-left text-fl-14 leading-copy">
              <caption className="sr-only">Score ranges and their verdict messages</caption>
              <thead className="bg-sand/60">
                <tr>
                  <th scope="col" className="px-fl-20 py-fl-12 font-normal text-muted">
                    Score tier
                  </th>
                  <th scope="col" className="px-fl-20 py-fl-12 font-normal text-muted">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {copy.verdicts.map((verdict, index) => {
                  const ceiling = index === 0 ? 100 : copy.verdicts[index - 1].min - 1;
                  return (
                    <tr key={verdict.min} className="border-t border-rule bg-paper-light/40">
                      <th scope="row" className="w-52 px-fl-20 py-fl-16 font-normal">
                        <EditableCopyField
                          fieldPath={`score.verdicts.${index}.min`}
                          label={`${verdict.min}–${ceiling}`}
                          value={verdict.min}
                          numeric
                          compact
                        />
                      </th>
                      <td className="px-fl-20 py-fl-16">
                        <EditableCopyField
                          fieldPath={`score.verdicts.${index}.message`}
                          label="Verdict"
                          value={verdict.t}
                          compact
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="email-box" number="02" title="Email box">
          <div className={surface}>
            <p className={smallLabel}>Default state</p>
            <div className="mt-fl-16 grid gap-fl-16 xl:grid-cols-2">
              <EditableCopyField fieldPath="review.heading" label="Heading" value={copy.review.heading} />
              <EditableCopyField fieldPath="review.body" label="Body" value={copy.review.body} multiline />
              <EditableCopyField fieldPath="review.label" label="Field label" value={copy.review.label} />
              <EditableCopyField fieldPath="review.placeholder" label="Placeholder" value={copy.review.placeholder} />
              <EditableCopyField fieldPath="review.cta" label="Button" value={copy.review.cta} />
              <EditableCopyField fieldPath="review.note" label="Note" value={copy.review.note} multiline />
            </div>
          </div>

          <div className="mt-fl-16 grid gap-fl-16 xl:grid-cols-2">
            <div className={surface}>
              <h3 className={smallLabel}>Validation and request errors</h3>
              <div className="mt-fl-16 flex flex-col gap-fl-16">
                {Object.entries(copy.review.errors).map(([code, message]) => (
                  <EditableCopyField
                    key={code}
                    fieldPath={`review.errors.${code}`}
                    label={code}
                    value={message}
                    multiline
                  />
                ))}
              </div>
            </div>
            <div className={surface}>
              <h3 className={smallLabel}>Fallback error</h3>
              <div className="mt-fl-16">
                <EditableCopyField fieldPath="review.error" label="Message before email" value={copy.review.error} />
                <p className="mt-fl-12 font-sans text-fl-18 leading-copy text-muted">
                  Preview: {copy.review.error} {SITE.email}.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section id="confirmation-ui" number="03" title="Confirmation UI">
          <div className="grid gap-fl-16 xl:grid-cols-2">
            <EditableCopyField fieldPath="sent.label" label="Inbox label" value={copy.sent.label} />
            <EditableCopyField fieldPath="sent.heading" label="Inbox heading" value={copy.sent.heading} />
            <EditableCopyField
              fieldPath="sent.message"
              label="Inbox message"
              value={copy.sent.message}
              multiline
              tokens={["email", "host"]}
            />
            <EditableCopyField fieldPath="sent.booking" label="Booking link" value={copy.sent.booking} />
          </div>
          <div className="mt-fl-16">
            <MessageCard label={copy.sent.label} title={copy.sent.heading}>
              <p>
                <TemplatePreview
                  template={copy.sent.message}
                  values={{ email: sampleEmail, host: run.host }}
                  strong={["email"]}
                />
              </p>
              <p className="mt-fl-12">{copy.sent.booking} →</p>
            </MessageCard>
          </div>

          <h3 className="mt-fl-32 mb-fl-16 mono-label text-muted">Confirmation-link copy</h3>
          <div className="grid gap-fl-16 xl:grid-cols-2">
            <EditableCopyField fieldPath="confirmation.back" label="Shared back link" value={confirmationUi.back} />
            <EditableCopyField
              fieldPath="confirmation.prompt.title"
              label="Ready · title"
              value={confirmationUi.prompt.title}
            />
            <EditableCopyField
              fieldPath="confirmation.prompt.message"
              label="Ready · message"
              value={confirmationUi.prompt.message}
              multiline
            />
            <EditableCopyField
              fieldPath="confirmation.prompt.action"
              label="Ready · button"
              value={confirmationUi.prompt.action}
            />
            <EditableCopyField
              fieldPath="confirmation.expired.title"
              label="Expired · title"
              value={confirmationUi.expired.title}
            />
            <EditableCopyField
              fieldPath="confirmation.expired.message"
              label="Expired · message"
              value={confirmationUi.expired.message}
              multiline
              tokens={["supportEmail"]}
            />
            <EditableCopyField
              fieldPath="confirmation.failed.title"
              label="Failed · title"
              value={confirmationUi.failed.title}
            />
            <EditableCopyField
              fieldPath="confirmation.failed.message"
              label="Failed · message"
              value={confirmationUi.failed.message}
              multiline
              tokens={["supportEmail"]}
            />
            <EditableCopyField
              fieldPath="confirmation.confirmed.title"
              label="Confirmed · title"
              value={confirmationUi.confirmed.title}
            />
            <EditableCopyField
              fieldPath="confirmation.confirmed.message"
              label="Confirmed · message"
              value={confirmationUi.confirmed.message}
              multiline
              tokens={["host", "email"]}
            />
          </div>

          <h3 className="mt-fl-32 mb-fl-16 mono-label text-muted">Rendered confirmation-link pages</h3>
          <div className="grid gap-fl-16 xl:grid-cols-2">
            <ConfirmationPagePreview
              label="Ready · 200"
              title={confirmationUi.prompt.title}
              action={confirmationUi.prompt.action}
            >
              {confirmationUi.prompt.message}
            </ConfirmationPagePreview>
            <ConfirmationPagePreview label="Expired or used · 410" title={confirmationUi.expired.title}>
              <TemplatePreview
                template={confirmationUi.expired.message}
                values={{ supportEmail: SITE.email }}
                underline={["supportEmail"]}
              />
            </ConfirmationPagePreview>
            <ConfirmationPagePreview label="Send failed · 502" title={confirmationUi.failed.title}>
              <TemplatePreview
                template={confirmationUi.failed.message}
                values={{ supportEmail: SITE.email }}
                underline={["supportEmail"]}
              />
            </ConfirmationPagePreview>
            <ConfirmationPagePreview label="Confirmed · 200" title={confirmationUi.confirmed.title}>
              {formatTemplate(confirmationUi.confirmed.message, { host: run.host, email: sampleEmail })}
            </ConfirmationPagePreview>
          </div>
        </Section>

        <Section id="email-templates" number="04" title="Email templates">
          <div className="flex flex-col gap-fl-24">
            <EmailTemplate
              title="Visitor confirmation email"
              audience={`To: ${sampleEmail}`}
              reply="Reply-to: not set"
              subject={visitorEmail.subject}
              text={visitorEmail.text}
              html={visitorEmail.html}
              fields={[
                {
                  fieldPath: "emails.confirmation.subject",
                  label: "Subject",
                  value: siteCheckCopy.emails.confirmation.subject,
                  tokens: ["host"],
                },
                {
                  fieldPath: "emails.confirmation.intro",
                  label: "Opening",
                  value: siteCheckCopy.emails.confirmation.intro,
                  multiline: true,
                  tokens: ["host"],
                },
                {
                  fieldPath: "emails.confirmation.expiry",
                  label: "Expiry note",
                  value: siteCheckCopy.emails.confirmation.expiry,
                  multiline: true,
                },
                {
                  fieldPath: "emails.confirmation.signature",
                  label: "Signature",
                  value: siteCheckCopy.emails.confirmation.signature,
                  tokens: ["author", "siteName"],
                },
              ]}
            />
            <EmailTemplate
              title="Confirmed review request"
              audience={`To: ${process.env.SITE_CHECK_TO ?? SITE.email}`}
              reply={`Reply-to: ${sampleEmail}`}
              subject={reviewEmail.subject}
              text={reviewEmail.text}
              html={reviewEmail.html}
              attachment={reviewEmail.filename}
              fields={[
                {
                  fieldPath: "emails.review.subject",
                  label: "Subject",
                  value: siteCheckCopy.emails.review.subject,
                  tokens: ["host", "score"],
                },
                {
                  fieldPath: "emails.review.request",
                  label: "Request line",
                  value: siteCheckCopy.emails.review.request,
                  tokens: ["email", "url"],
                },
                {
                  fieldPath: "emails.review.score",
                  label: "Score line",
                  value: siteCheckCopy.emails.review.score,
                  tokens: ["score", "verdict"],
                },
                {
                  fieldPath: "emails.review.run",
                  label: "Run line",
                  value: siteCheckCopy.emails.review.run,
                  tokens: ["runId", "checkedAt"],
                },
                {
                  fieldPath: "emails.review.attachment",
                  label: "Attachment note",
                  value: siteCheckCopy.emails.review.attachment,
                  multiline: true,
                },
              ]}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-fl-32">
      <div className="mb-fl-24 flex items-baseline gap-fl-12 border-b border-rule pb-fl-12">
        <span className={smallLabel}>/{number}</span>
        <h2 className="display text-fl-36 leading-heading-36 tracking-display-36">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TemplatePreview({
  template,
  values,
  strong = [],
  underline = [],
}: {
  template: string;
  values: Record<string, string | number>;
  strong?: readonly string[];
  underline?: readonly string[];
}) {
  return templateParts(template, values).map((part, index) => {
    const className = [
      strong.includes(part.key ?? "") && "font-semibold",
      underline.includes(part.key ?? "") && "underline",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <span key={`${part.key ?? "copy"}-${index}`} className={className || undefined}>
        {part.text}
      </span>
    );
  });
}

function MessageCard({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <article className={surface}>
      <p className={smallLabel}>{label}</p>
      <h3 className="display mt-fl-16 text-fl-30 leading-heading-30 tracking-display-30">
        <Accent text={title} />
      </h3>
      <div className="mt-fl-12 font-sans text-fl-18 leading-copy">{children}</div>
    </article>
  );
}

function ConfirmationPagePreview({
  label,
  title,
  action,
  children,
}: {
  label: string;
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={surface}>
      <p className={smallLabel}>{label}</p>
      <div className="mt-fl-12 flex min-h-80 items-center justify-center rounded-md border border-rule bg-paper px-fl-24 py-fl-32">
        <div className="w-full max-w-md font-sans text-ink">
          <h4 className="display text-fl-30 leading-heading-30 tracking-display-30">{title}</h4>
          <p className="mt-fl-16 text-fl-18 leading-copy">{children}</p>
          {action && (
            <div className="mono-label mt-fl-20 inline-flex min-h-14 items-center rounded-xs bg-pink px-fl-24">
              {action} <span className="nudge ml-1">→</span>
            </div>
          )}
          <p className="mt-fl-20 text-fl-18 leading-copy underline">{confirmationUi.back}</p>
        </div>
      </div>
    </article>
  );
}

function EmailTemplate({
  title,
  audience,
  reply,
  subject,
  text,
  html,
  attachment,
  fields,
}: {
  title: string;
  audience: string;
  reply: string;
  subject: string;
  text: string;
  html: string;
  attachment?: string;
  fields: {
    fieldPath: string;
    label: string;
    value: string;
    multiline?: boolean;
    tokens?: readonly string[];
  }[];
}) {
  return (
    <article className={surface}>
      <h3 className="display text-fl-30 leading-heading-30 tracking-display-30">{title}</h3>
      <div className="mt-fl-20 grid gap-fl-16 xl:grid-cols-2">
        {fields.map((field) => (
          <EditableCopyField key={field.fieldPath} {...field} />
        ))}
      </div>
      <dl className="mt-fl-20 grid gap-x-fl-24 gap-y-fl-12 md:grid-cols-[8rem_minmax(0,1fr)]">
        <dt className={smallLabel}>Delivery</dt>
        <dd className="text-fl-14">
          From: {SITE.name} site check &lt;{process.env.SITE_CHECK_FROM ?? SITE.email}&gt; · {audience} · {reply}
        </dd>
        <dt className={smallLabel}>Subject</dt>
        <dd className="text-fl-14">{subject}</dd>
        {attachment && (
          <>
            <dt className={smallLabel}>Attachment</dt>
            <dd className="text-fl-14">{attachment} · application/json</dd>
          </>
        )}
      </dl>
      <div className="mt-fl-24 grid gap-fl-20 xl:grid-cols-2">
        <div>
          <p className={smallLabel}>Rendered email · HTML</p>
          <EmailHtmlPreview title={`${title} HTML preview`} html={html} />
        </div>
        <div>
          <p className={smallLabel}>Plain-text source</p>
          <pre className="mt-fl-8 overflow-x-auto whitespace-pre-wrap rounded-md bg-ink px-fl-20 py-fl-20 font-mono text-fl-14 leading-copy text-paper">
            {text}
          </pre>
        </div>
      </div>
    </article>
  );
}
