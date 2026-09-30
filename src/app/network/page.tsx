import type { Metadata } from "next";
import { Accent } from "@/components/Accent";
import { Container } from "@/components/Container";
import { Contact, SiteFooter } from "@/components/Footer";
import { NetworkCanvas } from "@/components/network/NetworkCanvas";

/** Her 2003 commencement address at Vassar College. */
const SOURCE =
  "https://www.openculture.com/2022/06/susan-sontags-commencement-address-advice-pay-attention-it-connects-you-with-others-it-makes-you-eager-stay-eager.html";

const QUOTE =
  "Do stuff. Be clenched, curious. Not waiting for inspiration’s shove or society’s kiss on your forehead. Pay attention. It’s all about paying attention. Attention is vitality. It connects you with others. It makes you eager. *Stay eager.*";

// A holdover from the old site. Deliberately left out of the nav and sitemap.
export const metadata: Metadata = {
  title: "Network",
  description: QUOTE.replaceAll("*", ""),
  alternates: { canonical: "/network" },
};

export default function NetworkPage() {
  return (
    <>
      <main id="main">
        {/* Pulled up so the canvas runs under the nav. */}
        <section className="relative isolate -mt-(--nav-h) flex min-h-svh items-center overflow-hidden pt-(--nav-h)">
          <NetworkCanvas className="pointer-events-none absolute inset-0 z-10 size-full text-pink" />
          <Container className="grid-12 w-full py-fl-96">
            {/* Set like the notes' PullQuote (.note-quote). */}
            <figure data-network-avoid className="col-span-12 lg:col-span-10">
              <blockquote
                cite={SOURCE}
                className="display text-fl-60 leading-display-text-60 tracking-display-60 text-balance"
              >
                <p>
                  <Accent text={QUOTE} />
                </p>
              </blockquote>
              <figcaption className="mono-label mt-fl-40 flex flex-wrap gap-x-fl-20 gap-y-fl-8">
                <span>— Susan Sontag</span>
                <a href={SOURCE} target="_blank" rel="noopener noreferrer" className="text-pink-ink">
                  Vassar College commencement, 2003 ↗
                </a>
              </figcaption>
            </figure>
          </Container>
        </section>
      </main>
      <SiteFooter className="pt-fl-96 pb-fl-40">
        <Container>
          <Contact />
        </Container>
      </SiteFooter>
    </>
  );
}
