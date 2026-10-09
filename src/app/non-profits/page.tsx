import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Accent } from "@/components/Accent";
import { BookingLink } from "@/components/BookingLink";
import { ClientCards } from "@/components/ClientCards";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, SiteFooter } from "@/components/Footer";
import { GLIllustration } from "@/components/illustrations";
import { SectionHead, SituationList, WorkGrid } from "@/components/ServicePage";
import { Cite } from "@/components/Testimonial";
import { nonProfits as n } from "@/data/non-profits";
import { cn } from "@/lib/cn";
import { audienceGraph, JsonLd } from "@/lib/jsonld";
import { OPEN_GRAPH } from "@/lib/metadata";

export const metadata: Metadata = {
  title: n.metaTitle,
  description: n.metaDescription,
  alternates: { canonical: "/non-profits" },
  openGraph: { ...OPEN_GRAPH, url: "/non-profits" },
};

const card = "frame bg-clip-padding border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised";

export default function NonProfitsPage() {
  return (
    <>
      <JsonLd data={audienceGraph(n, ["website-care", "cms-integrations", "design-development"])} />
      <main id="main">
        <Hero />
        <Path />
        <Situations />
        <Fit />
        <Clients />
        <Faq />
      </main>

      <SiteFooter className="pt-fl-120 pb-fl-40">
        <Container>
          <div className="grid-12">
            <figure className="col-span-12 flex flex-col gap-fl-32 lg:col-span-9">
              <blockquote className="display text-fl-48 leading-display-text-48 tracking-display-48 text-pretty">
                “{n.quote.q}”
              </blockquote>
              <Cite t={n.quote} />
            </figure>
          </div>
          <Contact note={n.contactNote} className="mt-fl-160" />
        </Container>
      </SiteFooter>
    </>
  );
}

/** Laid out like ServicePage's hero, with the site check as the first step. */
function Hero() {
  return (
    <Container as="header" className="relative overflow-x-clip pt-fl-56 pb-fl-96 lg:min-h-[calc(59.72*var(--pvw))]">
      <Eyebrow details={[n.audience]} nested>
        Who I work with
      </Eyebrow>
      <h1 className="display relative z-10 mt-fl-48 w-fit text-fl-144 leading-heading-144 tracking-display-144">
        {n.h1.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            <Accent text={line} />
          </Fragment>
        ))}
      </h1>
      <GLIllustration
        scene="care-patch"
        sizes="(min-width: 1024px) min(49.51vw, 951px), 100vw"
        className="mx-auto w-full scale-120 lg:scale-100 lg:absolute lg:top-[calc(2.78*var(--pvw))] lg:w-[calc(49.51*var(--pvw))] lg:right-0"
      />
      <div className="flex flex-col gap-fl-32 lg:mt-fl-72 lg:max-w-[calc(47.22*var(--pvw))]">
        <p className="text-fl-24 leading-intro text-pretty text-body">{n.intro}</p>
        <div className="flex flex-wrap items-baseline gap-x-fl-32 gap-y-fl-16 border-t border-rule pt-fl-20">
          {/* The underline is on an inner span, cloned per line, so it follows the text where narrow screens wrap it. */}
          <Link href={n.cta.href} className="text-fl-24 leading-intro text-ink">
            <span className="border-b-2 border-pink pb-fl-4 box-decoration-clone">
              {n.cta.label} <span className="nudge">→</span>
            </span>
          </Link>
          <BookingLink className="text-fl-18 text-body">{n.booking}</BookingLink>
        </div>
      </div>
    </Container>
  );
}

/** The usual order of a relationship, each step a card linking to its page. */
function Path() {
  const p = n.path;
  return (
    <Container as="section" className="py-fl-96">
      <SectionHead n="01" eyebrow={p.eyebrow} className="mb-fl-48">
        {p.heading}
      </SectionHead>
      <ol className="grid gap-fl-24 md:grid-cols-2 xl:grid-cols-4">
        {p.items.map((step) => (
          <li key={step.n}>
            <Link
              href={step.href}
              className={cn(card, "hover-card hover-lift flex h-full flex-col gap-fl-18 px-fl-28 pt-fl-28 pb-fl-32")}
            >
              <div className="mono-text text-pink-ink">{step.n}</div>
              <h3 className="display mt-fl-40 text-fl-30 leading-heading-30 tracking-display-30 text-balance">
                <span className="hover-title">{step.t}</span>
              </h3>
              <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{step.d}</p>
              <span className="mono-label border-t border-rule pt-fl-18 text-pink-ink">
                {step.label} <span className="nudge">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-fl-40 font-display text-fl-24 leading-display-text-24 tracking-display-24 text-pretty text-pink-ink">
        {p.note}
      </p>
    </Container>
  );
}

function Situations() {
  const s = n.situations;
  return (
    <Container as="section" className="grid-12 gap-y-fl-40 py-fl-96">
      <SectionHead n="02" eyebrow={s.eyebrow} className="col-span-12 lg:col-span-4" balance>
        {s.heading}
      </SectionHead>
      <SituationList items={s.items} className="col-span-12 lg:col-span-7 lg:col-start-6" />
    </Container>
  );
}

/** Set like website care's "Already in place". */
function Fit() {
  const f = n.fit;
  return (
    <Container as="section" className="py-fl-96">
      <SectionHead n="03" eyebrow={f.eyebrow} className="mb-fl-56">
        {f.heading}
      </SectionHead>
      <ul className="grid gap-x-fl-24 gap-y-fl-40 sm:grid-cols-2 lg:grid-cols-4">
        {f.items.map((item) => (
          <li key={item.t} className="flex flex-col gap-fl-12 border-t border-rule pt-fl-20">
            <h3 className="display text-fl-30 leading-heading-30 tracking-display-30 text-balance">{item.t}</h3>
            <p className="text-fl-18 leading-copy text-pretty text-body">{item.d}</p>
          </li>
        ))}
      </ul>
    </Container>
  );
}

function Clients() {
  const cl = n.clients;
  return (
    <Container as="section" className="py-fl-96">
      <div className="grid-12 mb-fl-48 gap-y-fl-24">
        <SectionHead n="04" eyebrow={cl.eyebrow} className="col-span-12" balance>
          {cl.heading}
        </SectionHead>
        <p className="col-span-12 text-fl-20 leading-copy text-pretty text-body lg:col-span-6">{cl.intro}</p>
      </div>
      <ClientCards items={cl.items} className="lg:grid-cols-2" />
      <h3 className="mono-label mt-fl-96 mb-fl-32 border-t border-rule pt-fl-18 text-muted">{cl.workHeading}</h3>
      <WorkGrid items={cl.work} className="lg:grid-cols-2" />
    </Container>
  );
}

function Faq() {
  const f = n.faq;
  return (
    <Container as="section" className="grid-12 gap-y-fl-40 pt-fl-96 pb-fl-120">
      <SectionHead n="05" eyebrow={f.eyebrow} className="col-span-12 lg:col-span-4" balance>
        {f.heading}
      </SectionHead>
      <dl className="col-span-12 flex flex-col lg:col-span-7 lg:col-start-6">
        {f.items.map((item) => (
          <div key={item.q} className="flex flex-col gap-fl-12 border-t border-rule py-fl-22">
            <dt className="font-display text-fl-30 leading-display-text-30 tracking-display-30 text-pretty">
              {item.q}
            </dt>
            <dd className="text-fl-18 leading-copy text-pretty text-body">{item.a}</dd>
          </div>
        ))}
      </dl>
    </Container>
  );
}
