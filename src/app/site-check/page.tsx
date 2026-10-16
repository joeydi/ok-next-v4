import type { Metadata } from "next";
import Link from "next/link";
import { Accent } from "@/components/Accent";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, SiteFooter } from "@/components/Footer";
import { SiteCheck, type SiteCheckStage } from "@/components/site-check/SiteCheck";
import { siteCheck as c } from "@/data/site-check";
import { JsonLd, siteCheckGraph } from "@/lib/jsonld";
import { getMedia } from "@/lib/media";
import { OPEN_GRAPH } from "@/lib/metadata";

// Under `next dev`, `?stage=running|result|sent|failed` opens on a state from the
// sample run, for reviewing the design; production ignores it, so the page stays static.

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: "/site-check" },
  openGraph: { ...OPEN_GRAPH, url: "/site-check" },
};

const headshot = getMedia("home/headshot.jpg");

const STAGES: readonly SiteCheckStage[] = ["running", "result", "sent", "failed"];

export default async function SiteCheckPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  // Only read in development: reading searchParams would make the page dynamic.
  const { stage } = process.env.NODE_ENV === "development" ? await searchParams : {};
  const pinned = STAGES.find((s) => s === stage);
  return (
    <>
      <JsonLd data={siteCheckGraph()} />
      <main id="main">
        {/* A single column, so the log reads like a terminal session, top to bottom: 840px
            at 1440, and past it growing with the fluid type so lines wrap the same. */}
        <Container className="max-w-[max(52.5rem,calc(58.33*var(--pvw)))] pt-fl-56">
          <Eyebrow details={[...c.details]}>{c.eyebrow}</Eyebrow>
          <h1 className="display mt-fl-20 max-w-[11em] text-fl-96 leading-heading-96 tracking-display-96">
            <Accent text={c.h1} />
          </h1>
          <p className="mt-fl-28 text-fl-24 leading-intro text-pretty text-body">{c.intro}</p>
          {/* Keyed so moving between stages starts the state over. */}
          <SiteCheck key={pinned ?? "live"} stage={pinned} headshot={headshot} />

          <section className="pb-fl-96">
            <Eyebrow>
              <h2>{c.faq.heading}</h2>
            </Eyebrow>
            <dl className="mt-fl-28 flex flex-col">
              {c.faq.items.map((item) => (
                <div key={item.q} className="flex flex-col gap-fl-8 border-t border-rule py-fl-22">
                  <dt className="font-display text-fl-24 leading-display-text-30 tracking-display-30 text-pretty">
                    {item.q}
                  </dt>
                  <dd className="text-fl-18 leading-copy text-pretty text-body">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="pb-fl-96">
            <Eyebrow>
              <h2>{c.nextSteps.heading}</h2>
            </Eyebrow>
            <div className="mt-fl-28 flex flex-col gap-fl-16">
              <p className="display text-fl-36 leading-heading-36 tracking-display-36 text-pretty">{c.careLink.lead}</p>
              <p className="max-w-[34em] text-fl-18 leading-copy text-pretty text-body">{c.careLink.body}</p>
              <Link href={c.careLink.href} className="self-start text-fl-24 leading-intro text-ink">
                <span className="border-b-2 border-pink pb-fl-4 box-decoration-clone">
                  {c.careLink.label} <span className="nudge">→</span>
                </span>
              </Link>
            </div>
          </section>
        </Container>
      </main>

      <SiteFooter className="pt-fl-120 pb-fl-40">
        <Container>
          <Contact />
        </Container>
      </SiteFooter>
    </>
  );
}
