import type { Metadata } from "next";
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
