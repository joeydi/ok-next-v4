import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { Contact, SiteFooter } from "@/components/Footer";
import { NotesIndex, NotesList, type NoteSummary } from "@/components/notes/NotesIndex";
import { Placeholder } from "@/components/Placeholder";
import { formatDate, getAllNotes } from "@/lib/notes";

export const metadata: Metadata = {
  title: "Notes",
  description:
    "Project write-ups, process notes, and the occasional thing I made for fun. Mostly from Burlington, Vermont.",
  alternates: { canonical: "/notes" },
};

export default function NotesPage() {
  const all = getAllNotes();
  const featured = all.find((n) => n.featured);
  const list: NoteSummary[] = all
    .filter((n) => n !== featured)
    .map(({ slug, plainTitle, description, tag, image, imageLabel }) => ({
      slug,
      plainTitle,
      description,
      tag,
      image,
      imageLabel,
    }));

  return (
    <>
      <main id="main">
        <Container as="header" className="grid-12 items-end gap-y-fl-24 pt-fl-56 pb-fl-72">
          <div className="mono-label col-span-12 flex gap-fl-24 text-muted">
            <span>/ Notes</span>
            <span>{all.length} posts</span>
          </div>
          <h1 className="display col-span-12 mt-fl-40 text-fl-192 leading-[.85] tracking-[-.04em] lg:col-span-7">
            Notes<span className="text-pink">.</span>
          </h1>
          <p className="col-span-12 mt-fl-32 text-fl-24 leading-[1.55] text-pretty text-ink-3 md:col-span-8 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:pb-[18px]">
            Project write-ups, process notes, and the occasional thing I made for fun. Mostly from Burlington, Vermont.
          </p>
        </Container>

        {featured && (
          <Container
            as={Link}
            href={`/notes/${featured.slug}`}
            className="hover-card grid-12 items-end gap-y-fl-32 pb-fl-96"
          >
            <Placeholder
              label={featured.imageLabel}
              media={featured.image}
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="hover-lift col-span-12 aspect-video lg:col-span-7"
            />
            <div className="col-span-12 flex flex-col gap-fl-20 lg:col-span-4 lg:col-start-9">
              <div className="mono-label flex flex-wrap gap-x-fl-20 text-pink-ink">
                <span>Featured</span>
                <span className="text-muted">
                  {featured.tag} · {formatDate(featured.date)}
                </span>
              </div>
              <h2 className="display text-fl-48 leading-[1.02] tracking-heading text-balance">
                <span className="hover-title">{featured.plainTitle}</span>
              </h2>
              <p className="text-fl-18 leading-[1.6] text-pretty text-body">{featured.description}</p>
              <span className="mono-label text-pink-ink">
                Read <span className="nudge">→</span>
              </span>
            </div>
          </Container>
        )}

        <Container as="section" aria-label="All notes" className="pb-fl-120">
          <Suspense fallback={<NotesList notes={list} />}>
            <NotesIndex notes={list} />
          </Suspense>
        </Container>
      </main>
      <SiteFooter className="pt-fl-96 pb-fl-40">
        <Container>
          <Contact />
        </Container>
      </SiteFooter>
    </>
  );
}
