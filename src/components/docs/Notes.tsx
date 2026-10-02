import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { getAllNotes, getNote, type NoteMeta, TAGS } from "@/lib/notes";
import { DocTable } from "./DocTable";

// The Notes doc's visuals: the frontmatter fields src/lib/notes.ts reads, a note's
// own article grid for live specimens, and every note's contents, found by reading
// src/content/notes.

const DIR = path.join(process.cwd(), "src/content/notes");

/** Every note's raw frontmatter and body (drafts included), with code blocks blanked like getToc does. */
function rawNotes() {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(DIR, f), "utf8"));
      return {
        slug: f.replace(/\.mdx$/, ""),
        data: data as Record<string, unknown>,
        body: content.replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length)),
      };
    });
}

const Code = ({ children }: { children: ReactNode }) => <code className="text-ink">{children}</code>;

// ---------- Frontmatter ----------

type Field = {
  key: Exclude<keyof NoteMeta, "slug" | "plainTitle">;
  required?: boolean;
  value: ReactNode;
  shows: ReactNode;
};

const FIELDS: Field[] = [
  {
    key: "title",
    required: true,
    value: (
      <>
        Text. <Code>*word*</Code> sets it in pink
      </>
    ),
    shows: "Post heading and social card, with the accent. Index, More notes, RSS and the page title, without it",
  },
  {
    key: "description",
    value: "One or two sentences of plain text",
    shows: "Index list and featured block, meta description, RSS, JSON-LD. Not on the post itself",
  },
  {
    key: "date",
    required: true,
    value: <Code>YYYY-MM-DD</Code>,
    shows: "Orders notes newest first. Header, social card, sitemap, RSS",
  },
  {
    key: "tag",
    required: true,
    value: (
      <>
        One of{" "}
        {TAGS.map((t, i) => (
          <span key={t}>
            {i > 0 && ", "}
            <Code>{t}</Code>
          </span>
        ))}
      </>
    ),
    shows: "The filter on /notes, each row's label, the social card. The header too, unless topic is set",
  },
  {
    key: "topic",
    value: (
      <>
        Short label. Defaults to <Code>tag</Code>
      </>
    ),
    shows: "Header beside the date, JSON-LD articleSection",
  },
  {
    key: "featured",
    value: <Code>true</Code>,
    shows: "Shown large at the top of /notes instead of in the list. Only the newest featured note is",
  },
  {
    key: "image",
    value: "Media key from src/data/media.json",
    shows: "Cover on the post (16:9), index thumbnail, social card, JSON-LD",
  },
  {
    key: "imageLabel",
    value: (
      <>
        Text. Defaults to <Code>image — title</Code>
      </>
    ),
    shows: "The striped placeholder's label until image is set",
  },
  {
    key: "byline",
    value: (
      <>
        Text. Defaults to <Code>Designer + developer</Code>
      </>
    ),
    shows: "Under the author's name in the header",
  },
  {
    key: "tools",
    value: "List of names",
    shows: "Sidebar, under Tools. JSON-LD keywords",
  },
  {
    key: "client",
    value: "Name",
    shows: "Sidebar, under Client. JSON-LD about, as an Organization",
  },
  { key: "role", value: "Text", shows: "Sidebar, under Role" },
  { key: "year", value: "Year", shows: "Sidebar, under Year" },
  {
    key: "link",
    value: "URL",
    shows: "Sidebar, as Visit the site ↗, but only alongside client, role or year. The client's url in JSON-LD",
  },
  {
    key: "draft",
    value: <Code>true</Code>,
    shows: "Under next dev only. Left out of production builds, the index, sitemap and RSS",
  },
];

/**
 * Every frontmatter field src/lib/notes.ts reads, with what it takes, where it
 * shows and how many notes set it. Keys a note sets that nothing reads are listed
 * after, in pink.
 */
export function NoteFrontmatter() {
  const notes = rawNotes();
  const set = (key: string) => notes.filter((n) => n.data[key] !== undefined).length;
  const known = new Set<string>(FIELDS.map((f) => f.key));
  const unknown = [...new Set(notes.flatMap((n) => Object.keys(n.data)))].filter((k) => !known.has(k));

  return (
    <div className="doc-wide flex flex-col gap-fl-16">
      <DocTable
        columns={[{ label: "Field" }, { label: "Takes" }, { label: "Shows" }, { label: "Set in", align: "end" }]}
        rows={FIELDS.map((f) => {
          const n = set(f.key);
          return [
            <span key="k" className="flex flex-col whitespace-nowrap">
              <span className={f.required ? "text-pink-ink" : "text-ink"}>{f.key}</span>
              {f.required && <span className="text-fl-12 text-muted">required</span>}
            </span>,
            f.value,
            f.shows,
            <span key="n" className={cn("whitespace-nowrap", n ? "text-ink-2" : "text-muted")}>
              {n} / {notes.length}
            </span>,
          ];
        })}
      />
      {unknown.length > 0 && (
        <p className="mono-label text-pink-ink">
          Set but never read: {unknown.join(", ")} ({notes.filter((n) => unknown.some((k) => k in n.data)).length}{" "}
          notes)
        </p>
      )}
    </div>
  );
}

// ---------- Specimens ----------

/**
 * Its children in a note's own article grid (`.note-body`), over the twelve
 * columns, so Markdown and the note components render exactly as on a post.
 */
export function NoteSpecimen({ children }: { children: ReactNode }) {
  const cols = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-fl-12">
      <div aria-hidden="true" className="grid grid-cols-12 gap-x-fl-24">
        {cols.map((c) => (
          <span key={c} className="mono-label text-center text-muted">
            {c}
          </span>
        ))}
      </div>
      <div className="relative">
        <div aria-hidden="true" className="absolute inset-0 grid grid-cols-12 gap-x-fl-24">
          {cols.map((c) => (
            <span key={c} className="bg-sand/60" />
          ))}
        </div>
        <div className="note-body relative py-fl-24">{children}</div>
      </div>
    </div>
  );
}

// ---------- In use ----------

const count = (body: string, re: RegExp) => [...body.matchAll(re)].length;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * Every note newest first, as next dev lists them: how its "In this post" list is
 * built, the components it uses and what's still a placeholder.
 */
export function NotesInUse() {
  const raw = new Map(rawNotes().map((n) => [n.slug, n.body]));
  const notes = getAllNotes();

  return (
    <DocTable
      columns={[
        { label: "Note" },
        { label: "Tag" },
        { label: "In this post" },
        { label: "Components" },
        { label: "Placeholders" },
      ]}
      rows={notes.map((meta) => {
        const body = raw.get(meta.slug) ?? "";
        const toc = getNote(meta.slug)?.toc ?? [];
        const headings = count(body, /^##\s+/gm);
        const figures = [...body.matchAll(/<Figure\b[^>]*>/g)].map((m) => m[0]);
        const profiles = [...body.matchAll(/<Profile\b[^>]*>/g)].map((m) => m[0]);
        const placeholders = [...figures, ...profiles].filter((f) => !/\bmedia=/.test(f)).length + (meta.image ? 0 : 1);
        const diagrams = count(body, /<\w+Diagram\b/g);
        const parts = [
          count(body, /<Lead\b/g) && "Lead",
          figures.length && plural(figures.length, "Figure"),
          count(body, /<PullQuote\b/g) && plural(count(body, /<PullQuote\b/g), "PullQuote"),
          count(body, /<TocAnchor\b/g) && plural(count(body, /<TocAnchor\b/g), "TocAnchor"),
          profiles.length && plural(profiles.length, "Profile"),
          diagrams && plural(diagrams, "diagram"),
        ].filter(Boolean);
        const flags = [meta.draft && "draft", meta.featured && "featured"].filter(Boolean);

        return [
          <span key="n" className="flex flex-col">
            <span className="text-ink">{meta.slug}</span>
            {flags.length > 0 && <span className="text-fl-12 text-pink-ink">{flags.join(" · ")}</span>}
          </span>,
          <span key="t" className="whitespace-nowrap">
            {meta.tag}
          </span>,
          toc.length === 0 ? (
            <span key="c" className="text-muted">
              None
            </span>
          ) : headings ? (
            plural(toc.length, "heading")
          ) : (
            plural(toc.length, "caption")
          ),
          parts.join(", ") || <span className="text-muted">None</span>,
          <span key="p" className={placeholders ? "text-pink-ink" : "text-muted"}>
            {placeholders ? `${placeholders}${meta.image ? "" : ", incl. cover"}` : "None"}
          </span>,
        ];
      })}
    />
  );
}
