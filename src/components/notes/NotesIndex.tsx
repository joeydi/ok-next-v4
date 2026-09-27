"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Placeholder } from "../Placeholder";
import { cn } from "@/lib/cn";
import type { NoteMeta, Tag } from "@/lib/notes";

export type NoteSummary = Pick<NoteMeta, "slug" | "plainTitle" | "description" | "tag" | "image" | "imageLabel">;
type Filter = "ALL" | Tag;

const FILTERS: { value: Filter; label: string; param?: string }[] = [
  { value: "ALL", label: "All" },
  { value: "CASE STUDY", label: "Case studies", param: "case-studies" },
  { value: "PROCESS", label: "Process", param: "process" },
  { value: "VERMONT", label: "Vermont", param: "vermont" },
  { value: "COMMUNITY", label: "Community", param: "community" },
];

/** Filterable post list. The filter is kept in `?tag=` so it can be linked to. */
export function NotesIndex({ notes }: { notes: NoteSummary[] }) {
  const params = useSearchParams();
  const filter = FILTERS.find((f) => f.param && f.param === params.get("tag"))?.value ?? "ALL";

  const pick = (value: Filter) => {
    const param = FILTERS.find((f) => f.value === value)?.param;
    const url = new URL(window.location.href);
    if (param) url.searchParams.set("tag", param);
    else url.searchParams.delete("tag");
    window.history.replaceState(null, "", url);
  };

  return <NotesList notes={notes} filter={filter} onPick={pick} />;
}

/** Stateless view — also used as the server-rendered fallback. */
export function NotesList({
  notes,
  filter = "ALL",
  onPick,
}: {
  notes: NoteSummary[];
  filter?: Filter;
  onPick?: (f: Filter) => void;
}) {
  const shown = notes.filter((n) => filter === "ALL" || n.tag === filter);
  const count = (f: Filter) => (f === "ALL" ? notes.length : notes.filter((n) => n.tag === f).length);

  return (
    <>
      <div
        role="group"
        aria-label="Filter notes"
        className="mb-fl-24 flex flex-wrap items-baseline gap-x-fl-40 gap-y-3"
      >
        <span className="mono-label text-muted">/ Filter</span>
        {FILTERS.map((f) => {
          const on = f.value === filter;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={on}
              onClick={onPick && (() => onPick(f.value))}
              className={cn(
                "mono-label flex cursor-pointer items-baseline gap-2 border-b-2 pb-1.5 transition-colors hover:text-ink",
                on ? "border-pink text-ink" : "border-transparent text-muted",
              )}
            >
              {f.label}
              <span className={on ? "text-pink-ink" : "text-muted-on-dark"}>
                {String(count(f.value)).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" role="status">
        {filter === "ALL" ? `Showing all ${shown.length} notes` : `Showing ${shown.length} of ${notes.length} notes`}
      </p>
      <ol>
        {shown.map((n, i) => (
          <li key={n.slug}>
            <Link
              href={`/notes/${n.slug}`}
              className="hover-card grid-12 items-start gap-y-fl-12 border-t border-rule py-fl-32"
            >
              <span className="col-span-2 font-mono text-fl-14 text-pink-ink md:col-span-1 lg:pt-2.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mono-label col-span-10 text-muted md:col-span-2 lg:pt-2.5">{n.tag}</span>
              <span className="col-span-12 flex flex-col gap-fl-12 md:col-span-9 md:col-start-4 lg:col-span-6">
                <span className="display text-fl-36 leading-[1.05] tracking-[-.015em] text-balance">
                  <span className="hover-title">{n.plainTitle}</span>
                </span>
                {n.description && (
                  <span className="text-fl-18 leading-[1.55] text-pretty text-body">{n.description}</span>
                )}
              </span>
              <Placeholder
                label={n.imageLabel}
                media={n.image}
                small
                sizes="22vw"
                className="hover-lift hidden aspect-video lg:col-span-3 lg:flex"
              />
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
