import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { Container } from "@/components/Container";
import { Contact, SiteFooter } from "@/components/Footer";
import { MediaImage } from "@/components/MediaImage";
import { PuzzleCube } from "@/components/illustrations";
import { Cite } from "@/components/Testimonial";
import { principles, services, testimonials } from "@/data/home";
import { getMedia } from "@/lib/media";

const headshot = getMedia("home/headshot.jpg");
const festival = getMedia("home/festival.jpg");

export default function Home() {
  return (
    <>
      <main id="main">
        <Hero />
        <Approach />
        <Services />
      </main>
      <SiteFooter>
        <About />
        <Testimonials />
        <Container>
          <Contact n="05" className="pt-fl-160 pb-fl-40" />
        </Container>
      </SiteFooter>
    </>
  );
}

function Hero() {
  return (
    <Container as="header" className="relative pt-fl-56 pb-fl-88 lg:min-h-[calc(61.11*var(--pvw))]">
      <Eyebrow n="00">Introduction</Eyebrow>
      <h1 className="display relative z-10 mt-fl-48 w-fit text-fl-168 leading-[.9] tracking-display">
        Let’s think
        <br />
        it through,
        <br />
        <span className="text-pink">together.</span>
      </h1>
      <PuzzleCube className="mx-auto mt-fl-40 w-full max-w-[540px] lg:absolute lg:top-[calc(2.78*var(--pvw))] lg:right-[calc(1.67*var(--pvw))] lg:mt-0 lg:w-[calc(43.06*var(--pvw))] lg:max-w-none" />
      <div className="grid-12 mt-fl-72 items-end gap-y-fl-40">
        <p className="col-span-12 text-fl-24 leading-normal text-pretty text-body lg:col-span-6">
          I’m Joe, a designer and developer in Burlington, Vermont. For fifteen years I’ve worked alongside small
          teams, founders, and non-profits to figure out what’s worth building, then build it well.
        </p>
        <div className="col-span-12 flex items-center gap-[18px] border-t border-rule pt-fl-20 sm:col-span-6 lg:col-span-4 lg:col-start-9">
          <MediaImage
            src={headshot.key}
            alt={headshot.alt}
            width={72}
            height={72}
            placeholder="blur"
            blurDataURL={headshot.blurDataURL}
            className="size-[72px] rounded-[2px] object-cover saturate-[.85]"
          />
          <div className="font-mono text-fl-14 leading-[1.6] text-muted">
            JOE DI STEFANO
            <br />
            Usually mid-question.
          </div>
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
        <h2 className="display text-fl-60 leading-none tracking-heading text-balance">A partner, not a vendor.</h2>
      </div>
      <div className="col-span-12 grid gap-x-fl-48 gap-y-fl-56 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
        {principles.map((p) => (
          <div key={p.n} className="flex flex-col gap-fl-12 border-t border-ink pt-fl-20">
            <div className="font-mono text-fl-14 text-pink-ink">{p.n}</div>
            <h3 className="display text-fl-30 tracking-[-.01em]">{p.t}</h3>
            <p className="text-fl-18 leading-[1.55] text-pretty text-body">{p.d}</p>
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
          <h2 className="display text-fl-60 leading-none tracking-heading">Where I fit in.</h2>
        </div>
        <p className="max-w-[380px] text-fl-18 leading-[1.55] text-body">
          Most engagements touch more than one of these. We’ll figure out which one matters first.
        </p>
      </div>
      <div className="grid gap-fl-24 lg:grid-cols-3">
        {services.map((s) => (
          <Link
            key={s.n}
            href={s.href}
            className="card-link flex flex-col gap-[18px] border border-rule bg-paper-raised px-fl-32 pt-fl-28 pb-fl-32 lg:min-h-[calc(25*var(--pvw))]"
          >
            <div className="mono-label flex justify-between gap-4 text-muted">
              <span>{s.kicker}</span>
              <span className="shrink-0 whitespace-nowrap">/ {s.n}</span>
            </div>
            <h3 className="display mt-fl-40 text-fl-36 tracking-[-.015em]">{s.t}</h3>
            <p className="flex-1 text-fl-18 leading-[1.55] text-pretty text-body">{s.d}</p>
            <div className="border-t border-rule pt-[18px] text-fl-18 leading-[1.45] font-semibold">
              {s.a}
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
}

function About() {
  return (
    <div id="about" className="relative scroll-mt-0 overflow-hidden">
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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#1C191600_35%,#1C1916F2_88%,#1C1916_100%)]" />
        <Container className="absolute inset-x-0 bottom-fl-64 flex flex-col items-start justify-between gap-fl-24 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-fl-24">
            <Eyebrow n="03" className="text-muted-on-dark">
              About
            </Eyebrow>
            <h2 className="display text-fl-96 leading-[.95] tracking-[-.03em]">
              Hi, I’m Joe.
              <br />
              The one on the left.
            </h2>
          </div>
          <p className="max-w-[400px] text-fl-20 leading-[1.6] text-pretty lg:w-[calc(27.78*var(--pvw))] lg:max-w-none">
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
        <Eyebrow n="04" className="text-muted-on-dark">
          In their words
        </Eyebrow>
        <h2 id="kind-words" className="display text-fl-60 leading-none tracking-heading">
          Kind words from good people.
        </h2>
      </div>
      <div className="grid gap-x-fl-96 gap-y-fl-64 lg:grid-cols-2">
        {quotes.map((q) => (
          <figure key={q.initials} className="flex flex-col gap-fl-24">
            <blockquote className="text-fl-20 leading-[1.6] text-pretty">“{q.q}”</blockquote>
            <Cite t={q} />
          </figure>
        ))}
      </div>
    </Container>
  );
}
