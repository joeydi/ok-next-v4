import { Accent } from "@/components/Accent";
import { SITE } from "@/data/site";
import { siteCheck as copy } from "@/data/site-check";
import { confirmationEmail, confirmationUi, reviewRequestEmail } from "@/lib/site-check/messages";
import { sampleRunAt } from "@/lib/site-check/sample";

const sampleEmail = "hello@yourorganization.org";
const sampleLink = `${SITE.url}/api/site-check/review/confirm?token=[confirmation-token]`;

const surface = "rounded-lg border border-rule bg-paper-light/60 px-fl-24 py-fl-24";
const smallLabel = "mono-label text-muted";

/** A read-only inventory of every user-facing score and review-email message. */
export function SiteCheckAdmin() {
  const run = sampleRunAt("result");
  if (!run) throw new Error("The complete Site Check sample is missing");

  const sent = copy.sent.message(sampleEmail, run.host);
  const visitorEmail = confirmationEmail(run.host, sampleLink);
  const reviewEmail = reviewRequestEmail(run, sampleEmail);

  return (
    <div className="pt-fl-56 pb-fl-96 font-mono text-[12px]">
      <header className="mb-fl-32 flex flex-col gap-fl-8 border-b border-rule pb-fl-24">
        <span className={smallLabel}>/ Admin · dev only</span>
        <h1 className="display text-fl-48 leading-heading-48 tracking-display-48">Site Check</h1>
        <p className="max-w-3xl font-mono text-fl-14 leading-copy text-muted">
          Read-only review of the production score, email capture, confirmation, and email-template copy.
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
            <CopyCard label="Card label" text={copy.scoreLabel} />
            <CopyCard label="Pending score" text={copy.pending} />
            <CopyCard label="Helper · defined, not currently shown" text={copy.scoreNote} />
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
                      <th scope="row" className="whitespace-nowrap px-fl-20 py-fl-16 font-normal tabular-nums">
                        {verdict.min}–{ceiling}
                      </th>
                      <td className="px-fl-20 py-fl-16 font-sans text-fl-18">{verdict.t}</td>
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
            <h3 className="display mt-fl-16 text-fl-30 leading-heading-30 tracking-display-30">
              <Accent text={copy.review.heading} />
            </h3>
            <p className="mt-fl-12 max-w-3xl font-sans text-fl-18 leading-copy">{copy.review.body}</p>
            <dl className="mt-fl-24 grid gap-x-fl-24 gap-y-fl-16 sm:grid-cols-2">
              <CopyDetail term="Field label" text={copy.review.label} />
              <CopyDetail term="Placeholder" text={copy.review.placeholder} />
              <CopyDetail term="Button" text={copy.review.cta} />
              <CopyDetail term="Note" text={copy.review.note} />
            </dl>
          </div>

          <div className="mt-fl-16 grid gap-fl-16 xl:grid-cols-2">
            <div className={surface}>
              <h3 className={smallLabel}>Validation and request errors</h3>
              <dl className="mt-fl-16 flex flex-col gap-fl-16">
                {Object.entries(copy.review.errors).map(([code, message]) => (
                  <CopyDetail key={code} term={code} text={message} />
                ))}
              </dl>
            </div>
            <div className={surface}>
              <h3 className={smallLabel}>Fallback error</h3>
              <p className="mt-fl-16 font-sans text-fl-18 leading-copy">
                {copy.review.error} {SITE.email}.
              </p>
            </div>
          </div>
        </Section>

        <Section id="confirmation-ui" number="03" title="Confirmation UI">
          <MessageCard label={copy.sent.label} title={copy.sent.heading}>
            <p>
              {sent.beforeEmail} <strong>{sent.email}</strong>
              {sent.afterEmail}
            </p>
            <p className="mt-fl-12">{copy.sent.booking} →</p>
          </MessageCard>

          <h3 className="mt-fl-32 mb-fl-16 mono-label text-muted">Confirmation-link pages</h3>
          <div className="grid gap-fl-16 xl:grid-cols-2">
            <ConfirmationPagePreview
              label="Ready · 200"
              title={confirmationUi.prompt.title}
              action={confirmationUi.prompt.action}
            >
              {confirmationUi.prompt.message}
            </ConfirmationPagePreview>
            <ConfirmationPagePreview label="Expired or used · 410" title={confirmationUi.expired.title}>
              {confirmationUi.expired.messageBeforeEmail} <span className="underline">{SITE.email}</span>.
            </ConfirmationPagePreview>
            <ConfirmationPagePreview label="Send failed · 502" title={confirmationUi.failed.title}>
              {confirmationUi.failed.messageBeforeEmail} <span className="underline">{SITE.email}</span>.
            </ConfirmationPagePreview>
            <ConfirmationPagePreview label="Confirmed · 200" title={confirmationUi.confirmed.title}>
              {confirmationUi.confirmed.message(run.host, sampleEmail)}
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
            />
            <EmailTemplate
              title="Confirmed review request"
              audience={`To: ${process.env.SITE_CHECK_TO ?? SITE.email}`}
              reply={`Reply-to: ${sampleEmail}`}
              subject={reviewEmail.subject}
              text={reviewEmail.text}
              attachment={reviewEmail.filename}
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

function CopyCard({ label, text }: { label: string; text: string }) {
  return (
    <div className={surface}>
      <p className={smallLabel}>{label}</p>
      <p className="mt-fl-12 font-sans text-fl-18 leading-copy">{text}</p>
    </div>
  );
}

function CopyDetail({ term, text }: { term: string; text: string }) {
  return (
    <div>
      <dt className={smallLabel}>{term}</dt>
      <dd className="mt-fl-8 font-sans text-fl-18 leading-copy">{text}</dd>
    </div>
  );
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
  attachment,
}: {
  title: string;
  audience: string;
  reply: string;
  subject: string;
  text: string;
  attachment?: string;
}) {
  return (
    <article className={surface}>
      <h3 className="display text-fl-30 leading-heading-30 tracking-display-30">{title}</h3>
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
          <p className={smallLabel}>Rendered email · text/plain</p>
          <div className="mt-fl-8 overflow-hidden rounded-md border border-rule bg-paper-light shadow-sm">
            <div className="border-b border-rule px-fl-20 py-fl-16">
              <p className="font-sans text-fl-18 leading-copy font-semibold">{subject}</p>
              <dl className="mt-fl-8 grid grid-cols-[auto_minmax(0,1fr)] gap-x-fl-8 text-fl-12 leading-copy text-muted">
                <dt>From</dt>
                <dd>
                  {SITE.name} site check &lt;{process.env.SITE_CHECK_FROM ?? SITE.email}&gt;
                </dd>
                <dt>To</dt>
                <dd>{audience.replace("To: ", "")}</dd>
              </dl>
            </div>
            <div className="whitespace-pre-wrap px-fl-20 py-fl-24 font-sans text-fl-16 leading-copy">{text}</div>
          </div>
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
