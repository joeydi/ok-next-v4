import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, DarkSection, SiteFooter } from "@/components/Footer";
import { GLIllustration } from "@/components/illustrations";
import { MediaImage } from "@/components/MediaImage";
import { Cite } from "@/components/Testimonial";
import { principles, testimonials } from "@/data/home";
import { services } from "@/data/services";
import { SITE } from "@/data/site";
import { getMedia } from "@/lib/media";
import { OPEN_GRAPH } from "@/lib/metadata";

const headshot = getMedia("home/headshot.jpg");
const festival = getMedia("home/festival.jpg");

// A page's `alternates` replaces the layout's, so the RSS link is repeated here. The layout's
// title template only reaches child segments, so the name is added to the title by hand.
export const metadata: Metadata = {
  title: `Website for Vermont non-profits and businesses — ${SITE.name}`,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/notes/rss.xml", title: `${SITE.name} Notes` }] },
  },
  openGraph: { ...OPEN_GRAPH, url: "/" },
};

export default function Home() {
  return (
    <>
      <main id="main">
        <Hero />
        <Approach />
        <Services />
        <DarkSection>
          <About />
          <Testimonials />
        </DarkSection>
      </main>
      <SiteFooter>
        <Container>
          <Contact n="05" className="pt-fl-160 pb-fl-40" />
        </Container>
      </SiteFooter>
    </>
  );
}

function Hero() {
  return (
    <Container as="header" className="relative overflow-x-clip pt-fl-56 pb-fl-88 lg:min-h-[calc(61.11*var(--pvw))]">
      <Eyebrow n="00">Introduction</Eyebrow>
      <h1 className="display relative z-10 mt-fl-48 w-fit max-w-[clamp(16.25rem,46.25vw+7rem,62.5rem)] text-fl-168 leading-heading-168 tracking-display-168">
        Let’s think it through <span className="text-pink">together.</span>
      </h1>
      <GLIllustration
        scene="puzzle-cube"
        sizes="(min-width: 1024px) min(49.51vw, 951px), 100vw"
        className="mx-auto w-full scale-120 lg:scale-100 lg:absolute lg:top-[calc(2.78*var(--pvw))] lg:w-[calc(49.51*var(--pvw))] lg:right-0"
      />
      <div className="lg:mt-fl-72">
        <div className="grid gap-fl-24 md:grid-cols-[auto_1fr] md:gap-fl-32 max-w-[clamp(43.75rem,16.25vw+40.5rem,60rem)]">
          <div className="relative size-24 md:aspect-square md:size-auto md:h-full md:max-w-full">
            <MediaImage
              src={headshot.key}
              alt={headshot.alt}
              fill
              sizes="200px"
              loading="eager"
              placeholder="blur"
              blurDataURL={headshot.blurDataURL}
              className="frame object-cover saturate-[.85]"
            />
          </div>
          <p className="text-fl-24 leading-intro text-pretty text-body">
            I’m Joe di Stefano, a designer and developer in Burlington, Vermont. For fifteen years I’ve worked alongside
            small teams, founders, and non-profits to figure out what’s worth building, then build it well.
          </p>
        </div>
      </div>
    </Container>
  );
}

function Approach() {
  return (
    <Container as="section" id="approach" className="grid-12 gap-y-fl-48 py-fl-96">
      <div className="col-span-12 flex flex-col gap-fl-20 lg:col-span-4">
        <Eyebrow n="01">How I work</Eyebrow>
        <h2 className="display text-fl-60 leading-heading-60 tracking-display-60 text-balance">
          A partner, not a vendor.
        </h2>
      </div>
      <div className="col-span-12 grid gap-x-fl-48 gap-y-fl-56 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
        {principles.map((p) => (
          <div key={p.n} className="flex flex-col gap-fl-12 border-t border-rule pt-fl-20">
            <div className="mono-text text-pink-ink">{p.n}</div>
            <h3 className="display text-fl-30 leading-heading-30 tracking-display-30">{p.t}</h3>
            <p className="text-fl-18 leading-copy text-pretty text-body">{p.d}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}

function Services() {
  return (
    <Container as="section" id="services" className="py-fl-96">
      <div className="mb-fl-48 flex flex-col justify-between gap-fl-24 md:flex-row md:items-end">
        <div className="flex flex-col gap-fl-20">
          <Eyebrow n="02">How I help</Eyebrow>
          <h2 className="display text-fl-60 leading-heading-60 tracking-display-60">Where I fit in.</h2>
        </div>
        <p className="max-w-[400px] text-fl-18 leading-copy text-body">
          Most engagements touch more than one of these. We’ll figure out which one matters first.
        </p>
      </div>
      <div className="grid gap-fl-24 lg:grid-cols-3">
        {Object.values(services).map((s) => (
          <Link
            key={s.slug}
            href={`/${s.slug}`}
            className="frame hover-card hover-lift flex flex-col gap-fl-18 bg-clip-padding border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised px-fl-32 pt-fl-28 pb-fl-32 lg:min-h-[calc(25*var(--pvw))]"
          >
            <div className="mono-label text-muted">{s.audience}</div>
            <h3 className="display mt-fl-40 text-fl-36 leading-heading-36 tracking-display-36">
              <span className="hover-title">{s.title}</span>
            </h3>
            <p className="flex-1 text-fl-18 leading-copy text-pretty text-body">{s.intro}</p>
            <div className="border-t border-rule pt-fl-18 text-fl-18 leading-[1.4] font-semibold">{s.tagline}</div>
          </Link>
        ))}
      </div>
    </Container>
  );
}

function About() {
  return (
    <div id="about" className="relative -scroll-mt-[calc(var(--nav-h)+var(--spacing-fl-24))] overflow-hidden">
      <div className="relative h-[max(640px,62.5vw)]">
        <MediaImage
          src={festival.key}
          alt={festival.alt}
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={festival.blurDataURL}
          className="object-cover object-[30%_30%]"
        />
        <div className="absolute inset-0 bg-linear-to-b from-ink/0 from-35% via-ink/95 via-88% to-ink" />
        <Container className="absolute inset-x-0 bottom-fl-64 flex flex-col items-start justify-between gap-fl-24 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-fl-24">
            <Eyebrow n="03" className="text-muted-light">
              About
            </Eyebrow>
            <h2 className="display text-fl-96 leading-heading-96 tracking-display-96">
              Hi, I’m Joe.
              <br />
              (On the left.)
            </h2>
          </div>
          <p className="max-w-[400px] text-fl-20 leading-copy text-pretty lg:w-[calc(27.78*var(--pvw))] lg:max-w-none">
            I’ve spent my career on the same side of the table as creative directors, marketers, and business owners,
            turning fuzzy goals into things that ship. You work with me directly, from the first call to launch and
            after.
          </p>
        </Container>
      </div>
    </div>
  );
}

function Testimonials() {
  const quotes = [testimonials.tony, testimonials.kathleen, testimonials.tom, testimonials.jeremy];
  return (
    <Container as="section" aria-labelledby="kind-words" className="pt-fl-120">
      <div className="mb-fl-64 flex flex-col gap-fl-20">
        <Eyebrow n="04" className="text-muted-light">
          In their words
        </Eyebrow>
        <h2 id="kind-words" className="display text-fl-60 leading-heading-60 tracking-display-60">
          Kicking ass and <s>taking names</s> <span className="text-pink">making friends.</span>
        </h2>
      </div>
      <div className="grid gap-x-fl-96 gap-y-fl-64 lg:grid-cols-2">
        {quotes.map((q) => (
          <figure key={q.initials} className="flex flex-col gap-fl-24">
            <blockquote className="text-fl-20 leading-copy text-pretty">“{q.q}”</blockquote>
            <Cite t={q} />
          </figure>
        ))}
      </div>
    </Container>
  );
}
