import Link from "next/link";
import { Fragment } from "react";
import type { Service } from "@/data/services";
import { cn } from "@/lib/cn";
import { Accent } from "./Accent";
import { Container } from "./Container";
import { Eyebrow } from "./Eyebrow";
import { Contact, SiteFooter } from "./Footer";
import { Conveyor, Dashboard, QuickBuild } from "./illustrations";
import { Placeholder } from "./Placeholder";
import { Cite } from "./Testimonial";

const ILLUSTRATIONS = {
  "quick-build": QuickBuild,
  conveyor: Conveyor,
  dashboard: Dashboard,
};

/** Shared template for the three service pages. */
export function ServicePage({ service: s }: { service: Service }) {
  const Illustration = ILLUSTRATIONS[s.illustration];
  const three = s.capabilities.items.length === 3;

  return (
    <>
      <main id="main">
        {/* Hero */}
        <Container as="header" className="relative pt-fl-56 pb-fl-96 lg:min-h-[calc(59.72*var(--pvw))]">
          <div className="mono-label flex flex-wrap gap-x-fl-24 text-muted">
            <Link href="/#services">/ Services</Link>
            <span>{s.n}</span>
            <span>{s.audience}</span>
          </div>
          <h1 className="display relative z-10 mt-fl-48 w-fit text-fl-144 leading-[.9] tracking-display">
            {s.h1.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                <Accent text={line} />
              </Fragment>
            ))}
          </h1>
          <Illustration
            className="mx-auto mt-fl-40 w-full max-w-[540px] lg:absolute lg:top-[calc(2.78*var(--pvw))] lg:mt-0 lg:w-[calc(49.51*var(--pvw))] lg:max-w-none lg:right-0"
          />
          <div className="mt-fl-72 flex flex-col gap-fl-32 lg:max-w-[calc(47.22*var(--pvw))]">
            <p className="text-fl-24 leading-normal text-pretty text-ink-3">{s.intro}</p>
            <p className="font-display border-t border-rule pt-fl-20 text-fl-24 leading-[1.3] text-pink-ink">
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
                  "flex flex-col gap-[18px] border border-rule bg-paper-raised pt-fl-28 pb-fl-32",
                  three ? "px-fl-32 lg:min-h-[calc(29.17*var(--pvw))]" : "px-fl-28 xl:min-h-[calc(30.56*var(--pvw))]",
                )}
              >
                <div className="mono-label flex justify-between gap-4 text-muted">
                  <span>{c.k}</span>
                  <span className="shrink-0 whitespace-nowrap">/ {c.n}</span>
                </div>
                <h3
                  className={cn(
                    "display mt-fl-40 leading-[1.05] tracking-[-.015em]",
                    three ? "text-fl-36" : "text-fl-30 text-balance",
                  )}
                >
                  {c.t}
                </h3>
                <p className="flex-1 text-fl-18 leading-[1.55] text-pretty text-body">{c.d}</p>
                <div className="border-t border-rule pt-[18px] font-mono text-fl-14 leading-[1.7] tracking-[.02em] text-body">
                  {c.ex}
                </div>
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
                <span className="font-mono text-fl-14 text-pink-ink">{item.n}</span>
                <p className="font-display text-fl-30 leading-[1.25] text-pretty">{item.t}</p>
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
              <li key={step.n} className="flex flex-col gap-fl-12 border-t border-ink pt-fl-20">
                <div className="font-mono text-fl-14 text-pink-ink">{step.n}</div>
                <h3 className="display text-fl-30 tracking-[-.01em]">{step.t}</h3>
                <p className="text-fl-18 leading-[1.55] text-pretty text-body">{step.d}</p>
              </li>
            ))}
          </ol>
        </Container>

        {/* Recent work */}
        <Container as="section" className="grid-12 items-end gap-y-fl-40 pt-fl-96 pb-fl-120">
          <Placeholder label={s.work.image} className="col-span-12 aspect-[755/560] lg:col-span-7" />
          <div className="col-span-12 flex flex-col gap-fl-20 lg:col-span-4 lg:col-start-9">
            <Eyebrow n="04">Recent work</Eyebrow>
            <h2 className="display text-fl-48 leading-[1.02] tracking-heading">{s.work.title}</h2>
            <p className="text-fl-18 leading-[1.6] text-pretty text-body">{s.work.d}</p>
            <div className="border-t border-rule pt-fl-16 font-mono text-fl-14 leading-[1.7] tracking-[.02em] text-body uppercase">
              {s.work.tags}
            </div>
            {s.work.href && (
              <Link href={s.work.href} className="mono-label text-pink-ink">
                Read the case study <span className="nudge">→</span>
              </Link>
            )}
          </div>
        </Container>
      </main>

      <SiteFooter className="pt-fl-120 pb-fl-40">
        <Container>
          <div className="grid-12">
            <figure className="col-span-12 flex flex-col gap-fl-32 lg:col-span-9">
              <blockquote className="display text-fl-48 leading-[1.15] tracking-heading text-pretty">
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
      <h2 className={cn("display text-fl-60 leading-none tracking-heading", balance && "text-balance")}>{children}</h2>
    </div>
  );
}
