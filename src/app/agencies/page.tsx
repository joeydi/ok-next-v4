import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Accent } from "@/components/Accent";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, SiteFooter } from "@/components/Footer";
import { GLIllustration } from "@/components/illustrations";
import { List, SectionHead, SituationList } from "@/components/ServicePage";
import { Cite } from "@/components/Testimonial";
import { agencies as a } from "@/data/agencies";
import { cn } from "@/lib/cn";
import { audienceGraph, JsonLd } from "@/lib/jsonld";
import { OPEN_GRAPH } from "@/lib/metadata";

export const metadata: Metadata = {
  title: a.metaTitle,
  description: a.metaDescription,
  alternates: { canonical: "/agencies" },
  openGraph: { ...OPEN_GRAPH, url: "/agencies" },
};

const card = "frame bg-clip-padding border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised";

export default function AgenciesPage() {
  return (
    <>
      <JsonLd data={audienceGraph(a, ["design-development", "cms-integrations", "website-care"])} />
      <main id="main">
        <Hero />
        <Uses />
        <Situations />
        <Together />
      </main>

      <SiteFooter className="pt-fl-120 pb-fl-40">
        <Container>
          <div className="grid-12">
            <figure className="col-span-12 flex flex-col gap-fl-32 lg:col-span-9">
              <blockquote className="display text-fl-48 leading-display-text-48 tracking-display-48 text-pretty">
                “{a.quote.q}”
              </blockquote>
              <Cite t={a.quote} />
            </figure>
          </div>
          <Contact note={a.contactNote} className="mt-fl-160" />
        </Container>
      </SiteFooter>
    </>
  );
}

/** Laid out like ServicePage's hero. */
function Hero() {
  return (
    <Container as="header" className="relative overflow-x-clip pt-fl-56 pb-fl-96 lg:min-h-[calc(59.72*var(--pvw))]">
      <Eyebrow details={[a.audience]}>Who I work with</Eyebrow>
      <h1 className="display relative z-10 mt-fl-48 w-fit text-fl-144 leading-heading-144 tracking-display-144">
        {a.h1.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            <Accent text={line} />
          </Fragment>
        ))}
      </h1>
      <GLIllustration
        scene="care-stack"
        sizes="(min-width: 1024px) min(49.51vw, 951px), 100vw"
        className="mx-auto w-full scale-120 lg:scale-100 lg:absolute lg:top-[calc(2.78*var(--pvw))] lg:w-[calc(49.51*var(--pvw))] lg:right-0"
      />
      <div className="flex flex-col gap-fl-32 lg:mt-fl-72 lg:max-w-[calc(47.22*var(--pvw))]">
        <p className="text-fl-24 leading-intro text-pretty text-body">{a.intro}</p>
      </div>
    </Container>
  );
}

function Uses() {
  const u = a.uses;
  return (
    <Container as="section" className="py-fl-96">
      <SectionHead n="01" eyebrow={u.eyebrow} className="mb-fl-48">
        {u.heading}
      </SectionHead>
      <div className="grid gap-fl-24 md:grid-cols-2 xl:grid-cols-4">
        {u.items.map((item) => (
          <Link
            key={item.t}
            href={item.href}
            className={cn(
              card,
              "hover-card hover-lift flex flex-col gap-fl-18 px-fl-28 pt-fl-28 pb-fl-32 xl:min-h-[calc(30.56*var(--pvw))]",
            )}
          >
            <div className="mono-label text-muted">{item.k}</div>
            <h3 className="display mt-fl-40 text-fl-30 leading-heading-30 tracking-display-30 text-balance">
              <span className="hover-title">{item.t}</span>
            </h3>
            <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{item.d}</p>
            <span className="mono-label border-t border-rule pt-fl-18 text-pink-ink">
              See the service <span className="nudge">→</span>
            </span>
          </Link>
        ))}
      </div>
    </Container>
  );
}

function Situations() {
  const s = a.situations;
  return (
    <Container as="section" className="grid-12 gap-y-fl-40 py-fl-96">
      <SectionHead n="02" eyebrow={s.eyebrow} className="col-span-12 lg:col-span-4" balance>
        {s.heading}
      </SectionHead>
      <SituationList items={s.items} className="col-span-12 lg:col-span-7 lg:col-start-6" />
    </Container>
  );
}

function Together() {
  const t = a.together;
  return (
    <Container as="section" className="grid-12 gap-y-fl-40 pt-fl-96 pb-fl-120">
      <SectionHead n="03" eyebrow={t.eyebrow} className="col-span-12 lg:col-span-4" balance>
        {t.heading}
      </SectionHead>
      <List items={t.items} className="col-span-12 lg:col-span-7 lg:col-start-6 lg:pt-fl-48" />
    </Container>
  );
}
