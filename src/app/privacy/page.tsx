import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { Accent } from "@/components/Accent";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, SiteFooter } from "@/components/Footer";
import { type PrivacyBlock, privacy as p } from "@/data/privacy";
import { SITE } from "@/data/site";
import { OPEN_GRAPH } from "@/lib/metadata";
import { formatDate } from "@/lib/notes";

// The privacy policy, set in the notes' article grid: what's on the page is in
// src/data/privacy.ts.

export const metadata: Metadata = {
  title: p.metaTitle,
  description: p.metaDescription,
  alternates: { canonical: "/privacy" },
  openGraph: { ...OPEN_GRAPH, url: "/privacy" },
};

/** A line of policy text, with [label](url) as a link and {email} as the contact address. */
function Text({ text }: { text: string }): ReactNode {
  return text
    .split(/(\[[^\]]+\]\([^)]+\)|\{email\})/)
    .filter(Boolean)
    .map((part, i) => {
      if (part === "{email}")
        return (
          <a key={i} href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>
        );
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      return link ? (
        <a key={i} href={link[2]} rel="noopener">
          {link[1]}
        </a>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      );
    });
}

function Block({ block }: { block: PrivacyBlock }) {
  if (typeof block === "string") {
    return (
      <p>
        <Text text={block} />
      </p>
    );
  }
  return (
    <ul>
      {block.list.map((item) => (
        <li key={item}>
          <Text text={item} />
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <main id="main">
        <Container as="header" className="pt-fl-56 pb-fl-32">
          <Eyebrow details={[<time key="updated" dateTime={p.updated}>{`Updated ${formatDate(p.updated)}`}</time>]}>
            {p.title}
          </Eyebrow>
          <h1 className="display mt-fl-48 max-w-[11em] text-fl-96 leading-heading-96 tracking-display-96">
            <Accent text="Your data, *plainly.*" />
          </h1>
        </Container>

        <Container className="note-body pt-fl-48 pb-fl-64">
          <aside className="note-aside">
            <nav aria-label="On this page" className="flex flex-col gap-fl-8">
              <span className="mono-label text-ink">ON THIS PAGE</span>
              {p.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`}>
                  {s.heading}
                </a>
              ))}
            </nav>
            <div className="flex flex-col">
              <span className="mono-label text-ink">QUESTIONS</span>
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </div>
          </aside>
          <p className="text-fl-24 leading-intro text-body">{p.intro}</p>
          {p.sections.map((s) => (
            <Fragment key={s.id}>
              <h2 id={s.id} className="scroll-mt-[calc(var(--nav-h)+1rem)]">
                {s.heading}
              </h2>
              {s.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </Fragment>
          ))}
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
