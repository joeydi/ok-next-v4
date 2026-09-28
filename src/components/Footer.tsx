import type { ReactNode } from "react";
import { SITE } from "@/data/site";
import { cn } from "@/lib/cn";
import { BookingLink } from "./BookingLink";
import { Eyebrow } from "./Eyebrow";

/** Dark footer shell. Pages put their own blocks (about, quotes) before <Contact>. */
export function SiteFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer data-nav-theme="dark" className={cn("bg-ink text-paper", className)}>
      {children}
    </footer>
  );
}

/** "Say hello." block plus the bottom mono row. Every page ends with it. */
export function Contact({
  n,
  note,
  className,
}: {
  /** Section number on Home (`/ 05  CONTACT`); omitted elsewhere (`/ CONTACT`). */
  n?: string;
  note?: string;
  className?: string;
}) {
  return (
    <div id="contact" className={cn("scroll-mt-6", className)}>
      <Eyebrow n={n} className="text-muted-light">
        Contact
      </Eyebrow>
      <h2 className="display mt-fl-32 text-fl-168 leading-[.9] tracking-display">Say hello.</h2>
      {note && <p className="mt-fl-28 max-w-[880px] text-fl-24 leading-normal text-muted-light">{note}</p>}
      <div
        className={cn("flex flex-wrap items-baseline gap-x-fl-56 gap-y-4 text-fl-30", note ? "mt-fl-40" : "mt-fl-48")}
      >
        <a href={`mailto:${SITE.email}`} className="border-b-2 border-pink pb-1">
          {SITE.email}
        </a>
        <BookingLink className="text-muted-light">
          Book a 20-min call <span className="nudge">→</span>
        </BookingLink>
      </div>
      <div className="mono-label mt-fl-120 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-ink-2 pt-fl-24 text-muted-light">
        <span>{SITE.name}</span>
        <span>{SITE.location}</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
