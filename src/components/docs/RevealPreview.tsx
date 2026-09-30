import Image from "next/image";
import { Fragment } from "react";
import { Accent } from "@/components/Accent";
import { Eyebrow } from "@/components/Eyebrow";
import { posterPath } from "@/components/illustrations/gl/poster";
import { Logo } from "@/components/Logo";
import { services } from "@/data/services";
import { NAV } from "@/data/site";
import { viewTransition } from "@/lib/tokens";
import { RevealPlayer } from "./RevealPlayer";

// The page transition played between two sketches of real pages (the homepage's
// services and the Digital production hero), built from the site's own copy and
// classes. The masks, zooms and blurs are the real .page rules in globals.css.

function Nav() {
  return (
    <div className="absolute inset-x-6 top-4 flex items-center gap-8 rounded-lg border border-ink-2/10 bg-paper-light/80 px-6 py-4">
      <Logo className="h-7 text-ink" />
      <span className="mono-label mr-auto text-muted">Joe di Stefano / Designer + Developer</span>
      {NAV.map((n) => (
        <span key={n.href} className={n.label === "Services" ? "text-pink-ink" : undefined}>
          {n.label}
        </span>
      ))}
      <span className="rounded-full bg-ink px-4 py-2 text-paper">Say hello →</span>
    </div>
  );
}

function Home() {
  return (
    <div className="flex h-full flex-col gap-12 px-18 pt-36">
      <div className="flex flex-col gap-5">
        <Eyebrow n="02">How I help</Eyebrow>
        <h2 className="display text-[60px] leading-none tracking-heading">Where I fit in.</h2>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {Object.values(services).map((s) => (
          <button
            key={s.slug}
            type="button"
            data-reveal-card
            className="frame flex flex-col gap-[18px] border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised px-8 pt-7 pb-8 text-left"
          >
            <span className="mono-label flex justify-between gap-4 text-muted">
              <span>{s.audience}</span>
              <span>/ {s.n}</span>
            </span>
            <span className="display mt-10 text-[36px] leading-[1.05] tracking-heading">{s.title}</span>
            <span className="text-[18px] leading-[1.55] text-body">{s.intro}</span>
          </button>
        ))}
      </div>
      <div className="stripes frame flex-1" />
    </div>
  );
}

function Service() {
  const s = services["digital-production"];
  return (
    <div className="relative h-full px-18 pt-36">
      <Eyebrow details={[s.n, s.audience]}>Services</Eyebrow>
      <h1 className="display relative z-10 mt-12 text-[144px] leading-[.9] tracking-display">
        {s.h1.map((line, i) => (
          <Fragment key={line}>
            {i > 0 && <br />}
            <Accent text={line} />
          </Fragment>
        ))}
      </h1>
      <Image
        src={posterPath(s.illustration, 1240, "webp")}
        width={620}
        height={660}
        alt=""
        unoptimized
        className="absolute top-10 right-10 w-[713px]"
      />
      <div className="mt-18 flex max-w-[680px] flex-col gap-8">
        <p className="text-[24px] leading-intro text-body">{s.intro}</p>
        <p className="border-t border-rule pt-5 font-display text-[24px] leading-[1.3] text-pink-ink">{s.tagline}</p>
      </div>
    </div>
  );
}

/** A framed, playable page transition. Drives the doc's playhead for <Timeline live> and the curve dots. */
export function RevealPreview() {
  return <RevealPlayer total={viewTransition("reveal")} old={<Home />} next={<Service />} nav={<Nav />} />;
}
