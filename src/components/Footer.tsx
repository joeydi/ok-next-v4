import type { ReactNode } from "react";
import { SITE } from "@/data/site";
import { cn } from "@/lib/cn";
import { BookingLink } from "./BookingLink";
import { Eyebrow } from "./Eyebrow";

const dark = "bg-ink text-paper";

/** Dark footer shell. Pages put their own blocks before <Contact>. */
export function SiteFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer data-nav-theme="dark" className={cn(dark, className)}>
      {children}
    </footer>
  );
}

/** A dark block at the end of <main> that runs on into the footer, for page content (Home's about and quotes) that should still count as the page's main text. */
export function DarkSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // The shadow runs a pixel under the footer, so the paper behind can't show through
    // the seam when it lands on a fractional pixel.
    <div data-nav-theme="dark" className={cn(dark, "shadow-[0_1px_0_var(--color-ink)]", className)}>
      {children}
    </div>
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
    <div id="contact" className={className}>
      <Eyebrow n={n} className="text-muted-light">
        Contact
      </Eyebrow>
      <h2 className="display mt-fl-32 text-fl-168 leading-heading-168 tracking-display-168">Say hello.</h2>
      {note && <p className="mt-fl-28 max-w-[880px] text-fl-24 leading-intro text-muted-light">{note}</p>}
      <div
        className={cn("flex flex-wrap items-baseline gap-x-fl-56 gap-y-4 text-fl-30", note ? "mt-fl-40" : "mt-fl-48")}
      >
        <a href={`mailto:${SITE.email}`} className="border-b-2 border-pink pb-fl-4">
          {SITE.email}
        </a>
        <BookingLink className="text-muted-light">
          Book a 20-min call <span className="nudge">→</span>
        </BookingLink>
      </div>
      <div className="mono-label mt-fl-120 flex flex-wrap justify-between gap-x-6 gap-y-fl-8 border-t border-ink-2 pt-fl-24 text-muted-light">
        <span>{SITE.name}</span>
        <span>{SITE.location}</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
