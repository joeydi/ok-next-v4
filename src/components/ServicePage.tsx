import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { Service, Work } from "@/data/services";
import { cn } from "@/lib/cn";
import { JsonLd, serviceGraph } from "@/lib/jsonld";
import { getMedia } from "@/lib/media";
import { getNote } from "@/lib/notes";
import { Accent } from "./Accent";
import { Container } from "./Container";
import { Eyebrow } from "./Eyebrow";
import { Contact, SiteFooter } from "./Footer";
import { GLIllustration } from "./illustrations";
import { Placeholder } from "./Placeholder";
import { Cite } from "./Testimonial";

/** Shared template for the three service pages. */
/** The note a work link points at; a link to a missing note fails the build. */
function caseStudy(href?: string) {
  const slug = href?.match(/^\/notes\/([^/?#]+)$/)?.[1];
  if (!slug) return undefined;
  const note = getNote(slug);
  if (!note) throw new Error(`services: work link ${href} doesn't match a note`);
  return note.meta;
}

/** The note a work item's `href` points at, and the image to show for it. */
function workImage(w: Work) {
  return w.image ? getMedia(w.image) : caseStudy(w.href)?.image;
}

/** A single work item, large: the whole block is the link when it has a case study. */
function FeaturedWork({ work: w }: { work: Work }) {
  const body = (
    <>
      <Placeholder
        label={w.imageLabel}
        media={workImage(w)}
        sizes="(min-width: 1024px) 55vw, 100vw"
        className={cn("col-span-12 aspect-4/3 lg:col-span-7", w.href && "hover-lift")}
      />
      <div className="col-span-12 flex flex-col gap-fl-20 lg:col-span-4 lg:col-start-9">
        <Eyebrow n="04">Recent work</Eyebrow>
        <h2 className="display text-fl-48 leading-heading-48 tracking-display-48">
          <span className="hover-title">{w.title}</span>
        </h2>
        <p className="text-fl-18 leading-copy text-pretty text-body">{w.d}</p>
        <div className="mono-label border-t border-rule pt-fl-16 text-body">{w.tags}</div>
        {w.href && (
          <span className="mono-label text-pink-ink">
            Read the case study <span className="nudge">→</span>
          </span>
        )}
      </div>
    </>
  );
  return w.href ? (
    <Link href={w.href} className="hover-card grid-12 items-end gap-y-fl-40">
      {body}
    </Link>
  ) : (
    <div className="grid-12 items-end gap-y-fl-40">{body}</div>
  );
}

/** Two or more work items: a heading over a row of linked cards. */
function WorkCards({ heading, items }: { heading?: string; items: Work[] }) {
  return (
    <>
      <SectionHead n="04" eyebrow="Recent work" className="mb-fl-48">
        {heading ?? "Recent work."}
      </SectionHead>
      <WorkGrid items={items} />
    </>
  );
}

/** Work items as a row of cards, each linking to its case study. Also used by the non-profits page. */
export function WorkGrid({ items, className }: { items: Work[]; className?: string }) {
  return (
    <ul className={cn("grid gap-fl-24 lg:grid-cols-3", className)}>
      {items.map((w) => {
        const body = (
          <>
            <Placeholder
              label={w.imageLabel}
              media={workImage(w)}
              sizes="(min-width: 1024px) 33vw, 100vw"
              className={cn("aspect-4/3", w.href && "hover-lift")}
            />
            <h3 className="display mt-fl-8 text-fl-36 leading-heading-36 tracking-display-36">
              <span className="hover-title">{w.title}</span>
            </h3>
            <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{w.d}</p>
            <div className="mono-label border-t border-rule pt-fl-16 text-body">{w.tags}</div>
            {w.href && (
              <span className="mono-label text-pink-ink">
                Read the case study <span className="nudge">→</span>
              </span>
            )}
          </>
        );
        const className = "flex h-full flex-col gap-fl-18";
        return (
          <li key={w.title}>
            {w.href ? (
              <Link href={w.href} className={cn(className, "hover-card")}>
                {body}
              </Link>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ServicePage({ service: s }: { service: Service }) {
  const three = s.capabilities.items.length === 3;
  const steps = s.process.items.length;

  return (
    <>
      <JsonLd data={serviceGraph(s)} />
      <main id="main">
        {/* Hero */}
        <Container as="header" className="relative overflow-x-clip pt-fl-56 pb-fl-96 lg:min-h-[calc(59.72*var(--pvw))]">
          <Eyebrow href="/#services" details={[s.audience]} nested>
            Services
          </Eyebrow>
          <h1 className="display relative z-10 mt-fl-48 w-fit text-fl-144 leading-heading-144 tracking-display-144">
            {s.h1.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                <Accent text={line} />
              </Fragment>
            ))}
          </h1>
          {/* `sizes` follows this width: 49.51% of the page, capped at 1920. */}
          <GLIllustration
            scene={s.illustration}
            sizes="(min-width: 1024px) min(49.51vw, 951px), 100vw"
            className="mx-auto w-full scale-120 lg:scale-100 lg:absolute lg:top-[calc(2.78*var(--pvw))] lg:w-[calc(49.51*var(--pvw))] lg:right-0"
          />
          <div className="lg:mt-fl-72 flex flex-col gap-fl-32 lg:max-w-[calc(47.22*var(--pvw))]">
            <p className="text-fl-24 leading-intro text-pretty text-body">{s.intro}</p>
            <p className="font-display border-t border-rule pt-fl-20 text-fl-24 leading-display-text-24 tracking-display-24 text-pink-ink">
              {s.tagline}
            </p>
          </div>
        </Container>

        {/* Capabilities */}
        <Container as="section" className="py-fl-96">
          <SectionHead n="01" eyebrow={s.capabilities.eyebrow} className="mb-fl-48">
            {s.capabilities.heading}
          </SectionHead>
          <div className={cn("grid gap-fl-24 md:grid-cols-2", three ? "lg:grid-cols-3" : "xl:grid-cols-4")}>
            {s.capabilities.items.map((c) => (
              <div
                key={c.n}
                className={cn(
                  "frame flex flex-col gap-fl-18 bg-clip-padding border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised pt-fl-28 pb-fl-32",
                  three ? "px-fl-32 lg:min-h-[calc(29.17*var(--pvw))]" : "px-fl-28 xl:min-h-[calc(30.56*var(--pvw))]",
                )}
              >
                <div className="mono-label text-muted">{c.k}</div>
                <h3
                  className={cn(
                    "display mt-fl-40",
                    // Leading after the size: cn drops a leading-* that a later text-* size follows.
                    three
                      ? "text-fl-36 leading-heading-36 tracking-display-36"
                      : "text-fl-30 leading-heading-30 tracking-display-30 text-balance",
                  )}
                >
                  {c.t}
                </h3>
                <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{c.d}</p>
                <div className="mono-text border-t border-rule pt-fl-18 text-body">{c.ex}</div>
              </div>
            ))}
          </div>
        </Container>

        {/* Situations */}
        <Container as="section" className="grid-12 gap-y-fl-40 py-fl-96">
          <SectionHead n="02" eyebrow="Sound familiar?" className="col-span-12 lg:col-span-4" balance>
            {s.situations.heading}
          </SectionHead>
          <SituationList items={s.situations.items} className="col-span-12 lg:col-span-7 lg:col-start-6" />
        </Container>

        {/* Process */}
        <Container as="section" className="py-fl-96">
          <SectionHead n="03" eyebrow="How a project goes" className="mb-fl-56">
            {s.process.heading}
          </SectionHead>
          <ol
            className={cn(
              "grid gap-x-fl-24 gap-y-fl-40 sm:grid-cols-2",
              steps === 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4",
            )}
          >
            {s.process.items.map((step) => (
              <li key={step.n} className="flex flex-col gap-fl-12 border-t border-rule pt-fl-20">
                <div className="mono-text text-pink-ink">{step.n}</div>
                <h3 className="display text-fl-30 leading-heading-30 tracking-display-30">{step.t}</h3>
                <p className="text-fl-18 leading-copy text-pretty text-body">{step.d}</p>
                {step.link && (
                  <Link href={step.link.href} className="mono-label text-pink-ink">
                    {step.link.label} <span className="nudge">→</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Container>

        {/* Recent work */}
        <Container as="section" className="pt-fl-96 pb-fl-120">
          {s.work.items.length > 1 ? (
            <WorkCards heading={s.work.heading} items={s.work.items} />
          ) : (
            <FeaturedWork work={s.work.items[0]} />
          )}
        </Container>
      </main>

      <SiteFooter className="pt-fl-120 pb-fl-40">
        <Container>
          <div className="grid-12">
            <figure className="col-span-12 flex flex-col gap-fl-32 lg:col-span-9">
              <blockquote className="display text-fl-48 leading-display-text-48 tracking-display-48 text-pretty">
                “{s.quote.q}”
              </blockquote>
              <Cite t={s.quote} />
            </figure>
          </div>
          <Contact note={s.contactNote} className="mt-fl-160" />
        </Container>
      </SiteFooter>
    </>
  );
}

/** Eyebrow over a Gelica heading, opening a section. Also used by the website care and audience pages. */
export function SectionHead({
  n,
  eyebrow,
  children,
  className,
  balance = false,
}: {
  n: string;
  eyebrow: string;
  children: ReactNode;
  className?: string;
  balance?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-fl-20", className)}>
      <Eyebrow n={n}>{eyebrow}</Eyebrow>
      <h2 className={cn("display text-fl-60 leading-heading-60 tracking-display-60", balance && "text-balance")}>
        {children}
      </h2>
    </div>
  );
}

/** Numbered statements, each under a rule. Used for "Sound familiar?" on the service and audience pages. */
export function SituationList({
  items,
  className,
}: {
  items: readonly { n: string; t: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col", className)}>
      {items.map((item) => (
        <li
          key={item.n}
          className="grid grid-cols-[2.5rem_1fr] items-baseline gap-fl-16 border-t border-rule py-fl-22 sm:grid-cols-[56px_1fr]"
        >
          <span className="mono-text text-pink-ink">{item.n}</span>
          <p className="font-display text-fl-30 leading-display-text-30 tracking-display-30 text-pretty">{item.t}</p>
        </li>
      ))}
    </ul>
  );
}

/** A bulleted list with pink-square markers. Also used by the website care and audience pages. */
export function List({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-fl-8", className)}>
      {items.map((item) => (
        // A drawn square rather than a ::marker, whose distance from the text can't be set.
        <li
          key={item}
          className="relative pl-fl-20 text-fl-18 leading-copy text-pretty text-body before:absolute before:top-[calc((1lh-0.3em)/2)] before:left-0 before:size-[0.3em] before:bg-pink"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
