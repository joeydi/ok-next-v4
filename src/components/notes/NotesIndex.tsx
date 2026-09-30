"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addTransitionType, startTransition, useState, ViewTransition } from "react";
import { cn } from "@/lib/cn";
import type { NoteMeta, Tag } from "@/lib/notes";
import { Placeholder } from "../Placeholder";

export type NoteSummary = Pick<NoteMeta, "slug" | "plainTitle" | "description" | "tag" | "image" | "imageLabel">;
type Filter = "ALL" | Tag;

const FILTERS: { value: Filter; label: string; param?: string }[] = [
  { value: "ALL", label: "All" },
  { value: "CASE STUDY", label: "Case studies", param: "case-studies" },
  { value: "PROCESS", label: "Process", param: "process" },
  { value: "VERMONT", label: "Vermont", param: "vermont" },
  { value: "COMMUNITY", label: "Community", param: "community" },
];

/**
 * Filterable post list. The filter is kept in `?tag=` so it can be linked to.
 * Picking one sets state in a transition so the rows animate (see the
 * `.filter-move` rules in globals.css); the URL sync Next does for
 * `replaceState` doesn't start a view transition on its own.
 */
export function NotesIndex({ notes }: { notes: NoteSummary[] }) {
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>(
    () => FILTERS.find((f) => f.param && f.param === params.get("tag"))?.value ?? "ALL",
  );

  const pick = (value: Filter) => {
    startTransition(() => {
      addTransitionType("notes-filter");
      setFilter(value);
    });
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
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset brings its own styling and legend for a row of buttons */}
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
              <span aria-hidden="true" className={on ? "text-pink-ink" : "text-muted-light"}>
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
          // Rows blur in and out; rows that stay slide to their new place.
          <ViewTransition key={n.slug} enter="filter" exit="filter" update="filter-move" default="none">
            <li>
              <Link
                href={`/notes/${n.slug}`}
                className="hover-card grid-12 items-start gap-y-fl-12 border-t border-rule py-fl-32"
              >
                <span className="mono-text col-span-2 text-pink-ink md:col-span-1 lg:pt-2.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mono-label col-span-10 text-muted md:col-span-2 lg:pt-2.5">{n.tag}</span>
                <span className="col-span-12 flex flex-col gap-fl-12 md:col-span-9 md:col-start-4 lg:col-span-6">
                  <span className="display text-fl-36 leading-heading-36 tracking-heading text-balance">
                    <span className="hover-title">{n.plainTitle}</span>
                  </span>
                  {n.description && (
                    <span className="text-fl-18 leading-copy text-pretty text-body">{n.description}</span>
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
          </ViewTransition>
        ))}
      </ol>
    </>
  );
}
