import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Accent } from "@/components/Accent";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Contact, SiteFooter } from "@/components/Footer";
import { MediaImage } from "@/components/MediaImage";
import { Placeholder } from "@/components/Placeholder";
import { SITE } from "@/data/site";
import { JsonLd, noteGraph } from "@/lib/jsonld";
import { getMedia } from "@/lib/media";
import { formatDate, getAllNotes, getNote } from "@/lib/notes";

const headshot = getMedia("home/headshot.jpg");

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllNotes().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: PageProps<"/notes/[slug]">): Promise<Metadata> {
  const note = getNote((await params).slug);
  if (!note) return {};
  const { meta } = note;
  return {
    title: meta.plainTitle,
    description: meta.description,
    alternates: { canonical: `/notes/${meta.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE.name,
      publishedTime: meta.date,
      title: meta.plainTitle,
      description: meta.description,
    },
  };
}

export default async function NotePage({ params }: PageProps<"/notes/[slug]">) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) notFound();
  const { meta, toc } = note;
  const { default: Body } = await import(`@/content/notes/${slug}.mdx`);
  const more = getAllNotes()
    .filter((n) => n.slug !== slug)
    .slice(0, 3);

  const project = [
    ["Client", meta.client],
    ["Role", meta.role],
    ["Year", meta.year],
  ].filter((p): p is [string, string] => Boolean(p[1]));

  return (
    <>
      <JsonLd data={noteGraph(meta)} />
      <main id="main">
        <article>
          <Container as="header" className="pt-fl-56 pb-fl-64">
            <Eyebrow
              href="/notes"
              details={[
                <time key="date" dateTime={meta.date}>
                  {formatDate(meta.date)}
                </time>,
                meta.topic ?? meta.tag,
              ]}
            >
              Notes
            </Eyebrow>
            <div className="grid-12 mt-fl-48 gap-y-fl-24">
              <h1 className="display col-span-12 text-fl-96 leading-[.95] tracking-[-.03em] text-balance lg:col-span-10 lg:max-w-[calc(73.61*var(--pvw))]">
                <Accent text={meta.title} />
              </h1>
              <div className="col-span-12 mt-fl-48 flex items-center gap-fl-16 border-t border-rule pt-fl-20 sm:col-span-6 lg:col-span-4">
                <MediaImage
                  src={headshot.key}
                  alt=""
                  width={56}
                  height={56}
                  placeholder="blur"
                  blurDataURL={headshot.blurDataURL}
                  className="size-14 frame object-cover"
                />
                <div className="mono-text text-muted">
                  JOE DI STEFANO
                  <br />
                  {meta.byline}
                </div>
              </div>
            </div>
          </Container>

          <Container as="figure">
            <Placeholder label={meta.imageLabel} media={meta.image} priority className="aspect-video" />
          </Container>

          <Container className="note-body pt-fl-96 pb-fl-64">
            {(toc.length > 0 || meta.tools?.length || project.length > 0) && (
              <aside className="note-aside">
                {toc.length > 0 && (
                  <nav aria-label="In this post" className="flex flex-col gap-1.5">
                    <span className="mono-label text-ink">IN THIS POST</span>
                    {toc.map((t) => (
                      <a key={t.id} href={`#${t.id}`}>
                        {t.label}
                      </a>
                    ))}
                  </nav>
                )}
                {project.length > 0 && (
                  <dl className="flex flex-col gap-1.5">
                    {project.map(([k, v]) => (
                      <div key={k}>
                        <dt className="mono-label text-ink">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                    {meta.link && (
                      <a
                        href={meta.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono-label text-pink-ink"
                      >
                        VISIT THE SITE ↗
                      </a>
                    )}
                  </dl>
                )}
                {meta.tools && meta.tools.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="mono-label text-ink">TOOLS</span>
                    <ul className="flex flex-col gap-1.5">
                      {meta.tools.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            )}
            <Body />
          </Container>
        </article>

        {more.length > 0 && (
          <Container as="section" aria-labelledby="more-notes" className="pt-fl-64 pb-fl-120">
            <div className="mb-fl-32 flex items-baseline justify-between">
              <h2 id="more-notes" className="mono-label text-muted">
                / More notes
              </h2>
              <Link href="/notes" className="mono-label text-pink-ink">
                All notes <span className="nudge">→</span>
              </Link>
            </div>
            <ul>
              {more.map((n) => (
                <li key={n.slug}>
                  <Link
                    href={`/notes/${n.slug}`}
                    className="grid-12 items-baseline gap-y-2 border-t border-rule py-fl-28 hover-card"
                  >
                    <span className="mono-label col-span-12 text-muted md:col-span-2">{n.tag}</span>
                    <span className="display col-span-11 text-fl-36 leading-[1.05] tracking-[-.015em] md:col-span-7 md:col-start-3">
                      <span className="hover-title">{n.plainTitle}</span>
                    </span>
                    <span aria-hidden="true" className="col-span-1 text-right text-fl-24 md:col-start-12">
                      <span className="nudge">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        )}
      </main>
      <SiteFooter className="pt-fl-96 pb-fl-40">
        <Container>
          <Contact />
        </Container>
      </SiteFooter>
    </>
  );
}
