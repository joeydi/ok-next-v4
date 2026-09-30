import Link from "next/link";
import { Fragment } from "react";
import type { Service } from "@/data/services";
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

export function ServicePage({ service: s }: { service: Service }) {
  const three = s.capabilities.items.length === 3;
  const workMedia = s.work.image ? getMedia(s.work.image) : caseStudy(s.work.href)?.image;

  // With a case study the whole block is the link, so it takes the hover-card treatment.
  const work = (
    <>
      <Placeholder
        label={s.work.imageLabel}
        media={workMedia}
        sizes="(min-width: 1024px) 55vw, 100vw"
        className={cn("col-span-12 aspect-4/3 lg:col-span-7", s.work.href && "hover-lift")}
      />
      <div className="col-span-12 flex flex-col gap-fl-20 lg:col-span-4 lg:col-start-9">
        <Eyebrow n="04">Recent work</Eyebrow>
        <h2 className="display text-fl-48 leading-heading-48 tracking-heading">
          <span className="hover-title">{s.work.title}</span>
        </h2>
        <p className="text-fl-18 leading-copy text-pretty text-body">{s.work.d}</p>
        <div className="mono-label border-t border-rule pt-fl-16 text-body">{s.work.tags}</div>
        {s.work.href && (
          <span className="mono-label text-pink-ink">
            Read the case study <span className="nudge">→</span>
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      <JsonLd data={serviceGraph(s)} />
      <main id="main">
        {/* Hero */}
        <Container as="header" className="relative overflow-x-clip pt-fl-56 pb-fl-96 lg:min-h-[calc(59.72*var(--pvw))]">
          <Eyebrow href="/#services" details={[s.n, s.audience]}>
            Services
          </Eyebrow>
          <h1 className="display relative z-10 mt-fl-48 w-fit text-fl-144 leading-heading-144 tracking-display">
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
            <p className="font-display border-t border-rule pt-fl-20 text-fl-24 leading-display-text-24 text-pink-ink">
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
                  "frame flex flex-col gap-[18px] bg-clip-padding border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised pt-fl-28 pb-fl-32",
                  three ? "px-fl-32 lg:min-h-[calc(29.17*var(--pvw))]" : "px-fl-28 xl:min-h-[calc(30.56*var(--pvw))]",
                )}
              >
                <div className="mono-label flex justify-between gap-4 text-muted">
                  <span>{c.k}</span>
                  <span className="shrink-0 whitespace-nowrap">/ {c.n}</span>
                </div>
                <h3
                  className={cn(
                    "display mt-fl-40 tracking-heading",
                    // Leading after the size: cn drops a leading-* that a later text-* size follows.
                    three ? "text-fl-36 leading-heading-36" : "text-fl-30 leading-heading-30 text-balance",
                  )}
                >
                  {c.t}
                </h3>
                <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{c.d}</p>
                <div className="mono-text border-t border-rule pt-[18px] text-body">{c.ex}</div>
              </div>
            ))}
          </div>
        </Container>

        {/* Situations */}
        <Container as="section" className="grid-12 gap-y-fl-40 py-fl-96">
          <SectionHead n="02" eyebrow="Sound familiar?" className="col-span-12 lg:col-span-4" balance>
            {s.situations.heading}
          </SectionHead>
          <ul className="col-span-12 flex flex-col lg:col-span-7 lg:col-start-6">
            {s.situations.items.map((item) => (
              <li
                key={item.n}
                className="grid grid-cols-[2.5rem_1fr] items-baseline gap-fl-16 border-t border-rule py-fl-22 sm:grid-cols-[56px_1fr]"
              >
                <span className="mono-text text-pink-ink">{item.n}</span>
                <p className="font-display text-fl-30 leading-display-text-30 text-pretty">{item.t}</p>
              </li>
            ))}
          </ul>
        </Container>

        {/* Process */}
        <Container as="section" className="py-fl-96">
          <SectionHead n="03" eyebrow="How a project goes" className="mb-fl-56">
            {s.process.heading}
          </SectionHead>
          <ol className="grid gap-x-fl-24 gap-y-fl-40 sm:grid-cols-2 lg:grid-cols-4">
            {s.process.items.map((step) => (
              <li key={step.n} className="flex flex-col gap-fl-12 border-t border-rule pt-fl-20">
                <div className="mono-text text-pink-ink">{step.n}</div>
                <h3 className="display text-fl-30 leading-heading-30 tracking-heading">{step.t}</h3>
                <p className="text-fl-18 leading-copy text-pretty text-body">{step.d}</p>
              </li>
            ))}
          </ol>
        </Container>

        {/* Recent work */}
        <Container as="section" className="pt-fl-96 pb-fl-120">
          {s.work.href ? (
            <Link href={s.work.href} className="hover-card grid-12 items-end gap-y-fl-40">
              {work}
            </Link>
          ) : (
            <div className="grid-12 items-end gap-y-fl-40">{work}</div>
          )}
        </Container>
      </main>

      <SiteFooter className="pt-fl-120 pb-fl-40">
        <Container>
          <div className="grid-12">
            <figure className="col-span-12 flex flex-col gap-fl-32 lg:col-span-9">
              <blockquote className="display text-fl-48 leading-display-text-48 tracking-heading text-pretty">
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

function SectionHead({
  n,
  eyebrow,
  children,
  className,
  balance = false,
}: {
  n: string;
  eyebrow: string;
  children: string;
  className?: string;
  balance?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-fl-20", className)}>
      <Eyebrow n={n}>{eyebrow}</Eyebrow>
      <h2 className={cn("display text-fl-60 leading-heading-60 tracking-heading", balance && "text-balance")}>
        {children}
      </h2>
    </div>
  );
}
