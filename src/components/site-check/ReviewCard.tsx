"use client";

import { useEffect, useRef, useState } from "react";
import { Accent } from "@/components/Accent";
import { BookingLink } from "@/components/BookingLink";
import { MediaImage } from "@/components/MediaImage";
import { SITE } from "@/data/site";
import { siteCheck as copy } from "@/data/site-check";
import { cn } from "@/lib/cn";
import type { Media } from "@/lib/media";
import { trackSiteCheck } from "@/lib/site-check/analytics";
import { ReviewError, sendReviewRequest } from "@/lib/site-check/client";
import type { SiteCheckRun } from "@/lib/site-check/schema";

/** Ink card on paper; its focus rings take the pink that holds up on ink. */
const card = "frame bg-ink px-fl-32 pt-fl-28 pb-fl-32 text-paper [&_:focus-visible]:outline-pink/80";

/** Asks for an email after a run, for the personal review; thanks them once it's sent. */
export function ReviewCard({
  run,
  headshot,
  sentTo,
  onSent,
}: {
  run: SiteCheckRun;
  headshot: Media;
  sentTo: string | null;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const thanks = useRef<HTMLHeadingElement>(null);
  const [moveFocus, setMoveFocus] = useState(false);

  // The form goes away once it's sent, so focus moves to the thanks rather than the page.
  useEffect(() => {
    if (sentTo && moveFocus) thanks.current?.focus();
  }, [sentTo, moveFocus]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFailed(null);
    try {
      await sendReviewRequest({ runId: run.id, email });
    } catch (error) {
      trackSiteCheck("Site check review failed", { host: run.host });
      setFailed(error instanceof ReviewError ? error.code : "failed");
      setSending(false);
      return;
    }
    trackSiteCheck("Site check review requested", { host: run.host, score: run.score });
    setSending(false);
    setMoveFocus(true);
    onSent(email);
  };

  if (sentTo) {
    return (
      <div className={cn(card, "site-check-rise")}>
        <div className="flex items-center gap-fl-12">
          <Headshot media={headshot} />
          <div className="mono-label text-muted-light">/ {copy.sent.label}</div>
        </div>
        <h2
          ref={thanks}
          tabIndex={-1}
          className="display mt-fl-24 text-fl-36 leading-heading-36 tracking-display-36 focus:outline-none"
        >
          <Accent text={copy.sent.heading} />
        </h2>
        <p className="mt-fl-16 text-fl-18 leading-copy">
          I’ve sent a link to <span className="font-semibold">{sentTo}</span>. Open it to confirm, and I’ll send your
          report once I’ve been through {run.host} myself. It expires in an hour.
        </p>
        <BookingLink
          className="mt-fl-20 inline-block text-fl-18 leading-copy"
          onOpen={() => trackSiteCheck("Site check booking opened")}
        >
          <span className="border-b-2 border-pink box-decoration-clone">{copy.sent.booking}</span>{" "}
          <span className="nudge">→</span>
        </BookingLink>
      </div>
    );
  }

  return (
    <div className={cn(card, "site-check-rise")}>
      <div className="flex items-center gap-fl-12">
        <Headshot media={headshot} />
        <div>
          <div className="text-fl-18 leading-body font-semibold">{SITE.author}</div>
          <div className="mono-text leading-body text-muted-light">{SITE.name}</div>
        </div>
      </div>
      <h2 className="display mt-fl-24 text-fl-36 leading-heading-36 tracking-display-36">
        <Accent text={copy.review.heading} />
      </h2>
      <p className="mt-fl-16 text-fl-18 leading-copy text-pretty">{copy.review.body}</p>
      <form onSubmit={submit} className="mt-fl-24">
        <label htmlFor="site-check-email" className="mono-label block text-muted-light">
          {copy.review.label}
        </label>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <input
            id="site-check-email"
            type="email"
            required
            autoComplete="email"
            placeholder={copy.review.placeholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-13 min-w-0 flex-[1_1_220px] rounded-xs bg-paper-light px-fl-16 text-fl-18 text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={sending}
            className="mono-label min-h-13 shrink-0 cursor-pointer rounded-xs bg-pink px-fl-20 text-ink disabled:cursor-default disabled:opacity-70"
          >
            {copy.review.cta} <span className="nudge">→</span>
          </button>
        </div>
      </form>
      {failed && (
        <p role="alert" className="mt-fl-12 text-fl-18 leading-copy text-pink">
          {failed in copy.review.errors ? (
            copy.review.errors[failed as keyof typeof copy.review.errors]
          ) : (
            <>
              {copy.review.error} <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
            </>
          )}
        </p>
      )}
      <p className="mt-fl-16 text-fl-14 leading-copy text-muted-light">{copy.review.note}</p>
    </div>
  );
}

/** Joe's photo in the Avatar's 48px circle. Decorative: his name is beside it, or it's his card. */
function Headshot({ media }: { media: Media }) {
  return (
    <MediaImage
      src={media.key}
      alt=""
      width={48}
      height={48}
      placeholder="blur"
      blurDataURL={media.blurDataURL}
      className="size-12 shrink-0 rounded-full object-cover saturate-[.85]"
    />
  );
}
