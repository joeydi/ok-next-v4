import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Accent } from "@/components/Accent";
import { BookingLink } from "@/components/BookingLink";
import { Container } from "@/components/Container";
import { ReportDiagram } from "@/components/diagrams/website-care/ReportDiagram";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, SiteFooter } from "@/components/Footer";
import { GLIllustration } from "@/components/illustrations";
import { SectionHead } from "@/components/ServicePage";
import { Cite } from "@/components/Testimonial";
import { care as c } from "@/data/care";
import { cn } from "@/lib/cn";
import { careGraph, JsonLd } from "@/lib/jsonld";
import { OPEN_GRAPH } from "@/lib/metadata";

// Dev-only (see pageExtensions in next.config.ts) until it launches: then rename to
// page.tsx, add an opengraph-image.tsx and its card, and list it in the nav, the
// home page's services and the sitemap.

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: "/website-care" },
  openGraph: { ...OPEN_GRAPH, url: "/website-care" },
};

const card = "frame bg-clip-padding border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised";

export default function WebsiteCarePage() {
  return (
    <>
      <JsonLd data={careGraph()} />
      <main id="main">
        <Hero />
        <Overview />
        <Maintenance />
        <Hours />
        <Ready />
        <Report />
        <Plans />
        <SiteCheck />
        <Start />
        <Clients />
      </main>

      <SiteFooter className="pt-fl-120 pb-fl-40">
        <Container>
          <div className="grid-12">
            <figure className="col-span-12 flex flex-col gap-fl-32 lg:col-span-9">
              <blockquote className="display text-fl-48 leading-display-text-48 tracking-display-48 text-pretty">
                “{c.quote.q}”
              </blockquote>
              <Cite t={c.quote} />
            </figure>
          </div>
          <Contact note={c.contactNote} className="mt-fl-160" />
        </Container>
      </SiteFooter>
    </>
  );
}

/** Laid out like ServicePage's hero. */
function Hero() {
  return (
    <Container as="header" className="relative overflow-x-clip pt-fl-56 pb-fl-96 lg:min-h-[calc(59.72*var(--pvw))]">
      <Eyebrow href="/#services" details={[c.audience]}>
        Services
      </Eyebrow>
      <h1 className="display relative z-10 mt-fl-48 w-fit text-fl-144 leading-heading-144 tracking-display-144">
        {c.h1.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            <Accent text={line} />
          </Fragment>
        ))}
      </h1>
      <GLIllustration
        scene="care-catch"
        sizes="(min-width: 1024px) min(49.51vw, 951px), 100vw"
        className="mx-auto w-full scale-120 lg:scale-100 lg:absolute lg:top-[calc(2.78*var(--pvw))] lg:w-[calc(49.51*var(--pvw))] lg:right-0"
      />
      <div className="flex flex-col gap-fl-32 lg:mt-fl-72 lg:max-w-[calc(47.22*var(--pvw))]">
        <p className="text-fl-24 leading-intro text-pretty text-body">{c.intro}</p>
        <p className="font-display border-t border-rule pt-fl-20 text-fl-24 leading-display-text-24 tracking-display-24 text-pink-ink">
          {c.tagline}
        </p>
        <Link href="#site-check" className="mono-label text-pink-ink">
          {c.siteCheck.hero} <span className="nudge">↓</span>
        </Link>
      </div>
    </Container>
  );
}

/** The two halves of the plan, linking down to their sections. */
function Overview() {
  const o = c.overview;
  return (
    <Container as="section" className="grid-12 gap-y-fl-48 py-fl-96">
      <SectionHead n="01" eyebrow={o.eyebrow} className="col-span-12 lg:col-span-5" balance>
        {o.heading}
      </SectionHead>
      <div className="col-span-12 flex flex-col gap-fl-20 lg:col-span-6 lg:col-start-7 lg:pt-fl-48">
        {o.body.map((p) => (
          <p key={p} className="text-fl-20 leading-copy text-pretty text-body">
            {p}
          </p>
        ))}
      </div>
      <div className="col-span-12 grid gap-fl-24 md:grid-cols-2">
        {o.halves.map((h) => (
          <Link
            key={h.href}
            href={h.href}
            className={cn(card, "hover-card hover-lift flex flex-col gap-fl-18 px-fl-32 pt-fl-28 pb-fl-32")}
          >
            <div className="mono-label text-muted">{h.k}</div>
            <h3 className="display mt-fl-40 text-fl-48 leading-heading-48 tracking-display-48">
              <span className="hover-title">{h.t}</span>
            </h3>
            <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{h.d}</p>
            <span className="mono-label border-t border-rule pt-fl-18 text-pink-ink">
              What’s included <span className="nudge">↓</span>
            </span>
          </Link>
        ))}
      </div>
    </Container>
  );
}

function Maintenance() {
  const m = c.maintenance;
  return (
    <Container as="section" id="maintenance" className="grid-12 gap-y-fl-48 py-fl-96">
      <SectionHead n="02" eyebrow={m.eyebrow} className="col-span-12 lg:col-span-4" balance>
        {m.heading}
      </SectionHead>
      <div className="col-span-12 flex flex-col gap-fl-20 lg:col-span-7 lg:col-start-6">
        <p className="text-fl-24 leading-intro text-pretty text-body">{m.intro}</p>
        <p className="text-fl-18 leading-copy text-pretty text-body">{m.body}</p>
      </div>
      <div className="col-span-12">
        {m.groups.map((g) => (
          <div key={g.k} className="grid-12 gap-y-fl-16 border-t border-rule py-fl-28">
            <h3 className="display col-span-12 text-fl-30 leading-heading-30 tracking-display-30 lg:col-span-4">
              {g.k}
            </h3>
            <List items={g.items} className="col-span-12 lg:col-span-7 lg:col-start-6" />
          </div>
        ))}
      </div>
    </Container>
  );
}

function Hours() {
  const h = c.hours;
  return (
    <Container as="section" id="hours" className="grid-12 gap-y-fl-48 py-fl-96">
      <div className="col-span-12 flex flex-col gap-fl-24 lg:col-span-4">
        <SectionHead n="03" eyebrow={h.eyebrow} balance>
          {h.heading}
        </SectionHead>
        <p className="text-fl-20 leading-copy text-pretty text-body">
          {h.intro} {h.body} <strong className="font-semibold text-ink">{h.kicker}</strong>
        </p>
      </div>
      <div className="col-span-12 lg:col-span-7 lg:col-start-6">
        <ul className="flex flex-col">
          {h.situations.map((t, i) => (
            <li
              key={t}
              className="grid grid-cols-[2.5rem_1fr] items-baseline gap-fl-16 border-t border-rule py-fl-22 sm:grid-cols-[56px_1fr]"
            >
              <span className="mono-text text-pink-ink">{String(i + 1).padStart(2, "0")}</span>
              <p className="font-display text-fl-30 leading-display-text-30 tracking-display-30 text-pretty">{t}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(card, "col-span-12 flex flex-col gap-fl-28 px-fl-32 pt-fl-28 pb-fl-32")}>
        <div className="mono-label text-muted">{h.usesLabel}</div>
        <ul className="grid gap-x-fl-24 gap-y-fl-12 sm:grid-cols-2 xl:grid-cols-4">
          {h.uses.map((u) => (
            <li
              key={u}
              className="relative pl-fl-20 text-fl-18 leading-copy text-ink before:absolute before:top-[calc((1lh-0.3em)/2)] before:left-0 before:size-[0.3em] before:bg-pink"
            >
              {u}
            </li>
          ))}
        </ul>
        <p className="text-fl-18 leading-copy text-pretty text-muted">{h.note}</p>
      </div>
    </Container>
  );
}

/** Set like ServicePage's process steps. */
function Ready() {
  const r = c.ready;
  return (
    <Container as="section" className="py-fl-96">
      <SectionHead n="04" eyebrow={r.eyebrow} className="mb-fl-56">
        {r.heading}
      </SectionHead>
      <ul className="grid gap-x-fl-24 gap-y-fl-40 sm:grid-cols-2 lg:grid-cols-4">
        {r.items.map((item) => (
          <li key={item.t} className="flex flex-col gap-fl-12 border-t border-rule pt-fl-20">
            <h3 className="display text-fl-30 leading-heading-30 tracking-display-30 text-balance">{item.t}</h3>
            <p className="text-fl-18 leading-copy text-pretty text-body">{item.d}</p>
            {item.link && (
              <Link href={item.link.href} className="mono-label text-pink-ink">
                {item.link.label} <span className="nudge">→</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Container>
  );
}

function Report() {
  const r = c.report;
  return (
    <Container as="section" className="grid-12 items-center gap-y-fl-48 py-fl-96">
      <div className="col-span-12 flex flex-col gap-fl-24 lg:col-span-5">
        <SectionHead n="05" eyebrow={r.eyebrow} balance>
          {r.heading}
        </SectionHead>
        <p className="text-fl-20 leading-copy text-pretty text-body">{r.body}</p>
        <List items={r.items} />
        <p className="border-t border-rule pt-fl-20 text-fl-18 leading-copy text-pretty text-body">{r.closing}</p>
      </div>
      <ReportDiagram className="col-span-12 lg:col-span-7 lg:col-start-6" />
    </Container>
  );
}

function Plans() {
  const p = c.plans;
  return (
    <Container as="section" id="plans" className="grid-12 gap-y-fl-48 py-fl-96">
      <SectionHead n="06" eyebrow={p.eyebrow} className="col-span-12 lg:col-span-5" balance>
        <Accent text={p.heading} />
      </SectionHead>
      <p className="col-span-12 text-fl-20 leading-copy text-pretty text-body lg:col-span-6 lg:col-start-7 lg:self-end">
        {p.intro}
      </p>
      <div className="col-span-12 grid gap-fl-24 lg:grid-cols-3">
        {p.tiers.map((t) => (
          <div key={t.name} className={cn(card, "flex flex-col gap-fl-18 px-fl-32 pt-fl-28 pb-fl-32")}>
            <div className={cn("mono-label", t.featured ? "text-pink-ink" : "text-muted")}>
              {t.name}
              {t.featured && " · Most teams"}
            </div>
            <div className="mt-fl-40 flex items-baseline gap-fl-12">
              <span className="display text-fl-60 leading-heading-60 tracking-display-60">
                {t.price ?? "Let’s talk."}
              </span>
              {t.price && <span className="mono-text text-muted">/ month</span>}
            </div>
            <h3 className="display text-fl-30 leading-heading-30 tracking-display-30">
              {t.hours}
              {t.more && "+"} {t.hours === 1 ? "hour" : "hours"} of updates
            </h3>
            <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{t.d}</p>
            <div className="mono-text border-t border-rule pt-fl-18 text-body">{p.includes}</div>
          </div>
        ))}
      </div>
      <div className="col-span-12 grid-12 gap-y-fl-24 border-t border-rule pt-fl-28">
        <h3 className="display col-span-12 text-fl-30 leading-heading-30 tracking-display-30 lg:col-span-4">
          How it works
        </h3>
        <div className="col-span-12 flex flex-col gap-fl-24 lg:col-span-7 lg:col-start-6">
          <List items={p.terms} />
          <p className="text-fl-18 leading-copy text-pretty text-muted">{p.notIncluded}</p>
        </div>
      </div>
    </Container>
  );
}

/**
 * The free first step for visitors not ready to pick a plan. Set as a heading and a
 * single card rather than in the plans' three-up grid, so it reads as an offer and
 * not a fourth tier.
 */
function SiteCheck() {
  const s = c.siteCheck;
  return (
    <Container as="section" id="site-check" className="grid-12 gap-y-fl-48 py-fl-96">
      <div className="col-span-12 flex flex-col gap-fl-24 lg:col-span-5">
        <SectionHead n="07" eyebrow={s.eyebrow} balance>
          {s.heading}
        </SectionHead>
        <p className="text-fl-20 leading-copy text-pretty text-body">{s.intro}</p>
      </div>
      <div
        className={cn(
          card,
          "col-span-12 flex flex-col gap-fl-28 px-fl-32 pt-fl-28 pb-fl-32 lg:col-span-6 lg:col-start-7",
        )}
      >
        <div className="mono-label text-muted">{s.listLabel}</div>
        <List items={s.items} />
        <p className="text-fl-18 leading-copy text-pretty text-muted">{s.closing}</p>
        <div className="flex flex-wrap items-baseline gap-x-fl-32 gap-y-fl-16 border-t border-rule pt-fl-28">
          {/* The underline is on an inner span, cloned per line, so it follows the text where narrow screens wrap it. */}
          <Link href={s.href} className="text-fl-30 leading-intro text-ink">
            <span className="border-b-2 border-pink pb-fl-4 box-decoration-clone">
              {s.cta} <span className="nudge">→</span>
            </span>
          </Link>
          <BookingLink className="text-fl-18 text-body">{s.booking}</BookingLink>
        </div>
      </div>
    </Container>
  );
}

function Start() {
  const s = c.start;
  return (
    <Container as="section" className="py-fl-96">
      <SectionHead n="08" eyebrow={s.eyebrow} className="mb-fl-56">
        {s.heading}
      </SectionHead>
      <ol className="grid gap-x-fl-24 gap-y-fl-40 sm:grid-cols-2 lg:grid-cols-4">
        {s.steps.map((step) => (
          <li key={step.n} className="flex flex-col gap-fl-12 border-t border-rule pt-fl-20">
            <div className="mono-text text-pink-ink">{step.n}</div>
            <h3 className="display text-fl-30 leading-heading-30 tracking-display-30">{step.t}</h3>
            <p className="text-fl-18 leading-copy text-pretty text-body">{step.d}</p>
          </li>
        ))}
      </ol>
    </Container>
  );
}

function Clients() {
  const cl = c.clients;
  return (
    <Container as="section" className="pt-fl-96 pb-fl-120">
      <div className="grid-12 mb-fl-48 gap-y-fl-24">
        <SectionHead n="09" eyebrow={cl.eyebrow} className="col-span-12" balance>
          {cl.heading}
        </SectionHead>
        <p className="col-span-12 text-fl-20 leading-copy text-pretty text-body lg:col-span-6">{cl.intro}</p>
      </div>
      <ul className="grid gap-fl-24 lg:grid-cols-3">
        {cl.items.map((client) => {
          const body = (
            <>
              <div className="mono-label text-muted">{client.place}</div>
              <h3 className="display mt-fl-40 flex-1 text-fl-36 leading-heading-36 tracking-display-36">
                <span className={cn(client.href && "hover-title")}>{client.name}</span>
              </h3>
              <div className="mono-label flex justify-between gap-fl-16 border-t border-rule pt-fl-18">
                <span className="text-body">Since {client.since}</span>
                {client.href && (
                  <span className="text-pink-ink">
                    Case study <span className="nudge">→</span>
                  </span>
                )}
              </div>
            </>
          );
          const className = cn(card, "flex h-full flex-col gap-fl-18 px-fl-32 pt-fl-28 pb-fl-32");
          return (
            <li key={client.name}>
              {client.href ? (
                <Link href={client.href} className={cn(className, "hover-card hover-lift")}>
                  {body}
                </Link>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Container>
  );
}

function List({ items, className }: { items: readonly string[]; className?: string }) {
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
