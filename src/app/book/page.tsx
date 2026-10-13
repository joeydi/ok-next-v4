import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Accent } from "@/components/Accent";
import { BookPicker } from "@/components/booking/BookPicker";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, SiteFooter } from "@/components/Footer";
import { CALENDLY_URL, NATIVE_BOOKING, SITE } from "@/data/site";
import { OPEN_GRAPH } from "@/lib/metadata";

// The booking picker as a page: where the "Book a call" links lead when they're
// opened in a new tab, and where the emails' reschedule links land
// (?reschedule=<token>, read in the browser so the page stays static). Until
// NEXT_PUBLIC_BOOKING is "native", it sends visitors on to Calendly.

export const metadata: Metadata = {
  title: "Book a 20-min call",
  description: `Pick a time for a 20-minute video call with ${SITE.author} about your website, project or idea.`,
  alternates: { canonical: "/book" },
  openGraph: { ...OPEN_GRAPH, url: "/book" },
};

export default function BookPage() {
  if (!NATIVE_BOOKING) redirect(CALENDLY_URL);
  return (
    <>
      <main id="main">
        <Container className="pt-fl-56">
          <Eyebrow>Book a call</Eyebrow>
          <h1 className="display mt-fl-20 max-w-[11em] text-fl-96 leading-heading-96 tracking-display-96">
            <Accent text="Let’s *talk.*" />
          </h1>
          <p className="mt-fl-28 max-w-[36em] text-fl-24 leading-intro text-pretty text-body">
            Twenty minutes on a video call, about your website, a project or an idea. Pick a time that suits you.
          </p>
          <div className="frame mt-fl-48 overflow-hidden bg-paper-light md:h-[min(760px,100dvh-4rem)]">
            <BookPicker />
          </div>
          <noscript>
            <p className="mt-fl-20 text-fl-18 leading-copy">
              The booking calendar needs JavaScript. Write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a> and
              we’ll find a time.
            </p>
          </noscript>
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
