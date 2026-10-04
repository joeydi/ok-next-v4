import fs from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import matter from "gray-matter";
import { figureId } from "./figure-id";
import { getMedia, type Media } from "./media";

// Notes (and case studies) live in src/content/notes/*.mdx. Frontmatter is read
// here with gray-matter; the body is compiled by @next/mdx via dynamic import.

const DIR = path.join(process.cwd(), "src/content/notes");

export const TAGS = ["CASE STUDY", "PROCESS", "VERMONT", "COMMUNITY"] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  "CASE STUDY": "Case studies",
  PROCESS: "Process",
  VERMONT: "Vermont",
  COMMUNITY: "Community",
};

export type NoteMeta = {
  slug: string;
  /** May contain *accent* words, shown in pink on the post page. */
  title: string;
  plainTitle: string;
  /** The <title> (before " — Okayplus"), for a headline too long for search listings. Defaults to `plainTitle`. */
  metaTitle: string;
  description: string;
  date: string; // ISO
  tag: Tag;
  /** Header label shown next to the date, e.g. "Interaction design". Defaults to the tag. */
  topic?: string;
  /** Resolved from the `image:` frontmatter key (an R2 key in src/data/media.json). */
  image?: Media;
  /** Placeholder label shown until `image` exists. */
  imageLabel: string;
  /** The social card shows `image` behind the title, filling the card, instead of framed beside it. */
  ogBackdrop: boolean;
  featured: boolean;
  draft: boolean;
  byline: string;
  tools?: string[];
  // Case study extras
  client?: string;
  role?: string;
  year?: string;
  link?: string;
};

export type TocItem = { id: string; label: string };

const stripAccent = (s: string) => s.replace(/\*(.+?)\*/g, "$1");

function parse(file: string) {
  const slugName = file.replace(/\.mdx$/, "");
  const raw = fs.readFileSync(path.join(DIR, file), "utf8");
  const { data, content } = matter(raw);

  for (const key of ["title", "date", "tag"]) {
    if (!data[key]) throw new Error(`notes/${file}: missing "${key}" in frontmatter`);
  }
  if (!TAGS.includes(data.tag)) {
    throw new Error(`notes/${file}: tag must be one of ${TAGS.join(", ")} (got "${data.tag}")`);
  }
  let image: Media | undefined;
  try {
    image = data.image ? getMedia(String(data.image)) : undefined;
  } catch (err) {
    throw new Error(`notes/${file}: ${(err as Error).message}`);
  }

  const meta: NoteMeta = {
    slug: slugName,
    title: String(data.title),
    plainTitle: stripAccent(String(data.title)),
    metaTitle: data.metaTitle ?? stripAccent(String(data.title)),
    description: data.description ?? "",
    date: new Date(data.date).toISOString(),
    tag: data.tag,
    topic: data.topic,
    image,
    imageLabel: data.imageLabel ?? `image — ${stripAccent(String(data.title))}`,
    ogBackdrop: Boolean(data.ogBackdrop),
    featured: Boolean(data.featured),
    draft: Boolean(data.draft),
    byline: data.byline ?? "Designer + developer",
    tools: data.tools,
    client: data.client,
    role: data.role,
    year: data.year ? String(data.year) : undefined,
    link: data.link,
  };
  return { meta, content };
}

const showDrafts = process.env.NODE_ENV !== "production";

export function getAllNotes(): NoteMeta[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => parse(f).meta)
    .filter((n) => showDrafts || !n.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getNote(slugName: string) {
  const file = `${slugName}.mdx`;
  if (!fs.existsSync(path.join(DIR, file))) return null;
  const { meta, content } = parse(file);
  if (meta.draft && !showDrafts) return null;
  return { meta, toc: getToc(content) };
}

/**
 * "In this post" entries, in document order: every `## Heading`. A note with no
 * headings lists every <Figure> or technique diagram (<…Diagram>) caption, or <TocAnchor> label, numbered like
 * "01 / Client constellation" instead.
 */
function getToc(content: string): TocItem[] {
  const slugger = new GithubSlugger();
  const body = content.replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length));

  const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => {
    const label = m[1].trim();
    return { id: slugger.slug(label), label };
  });
  if (headings.length) return headings;

  return [...body.matchAll(/<(?:Figure|TocAnchor|\w+Diagram)\b[^>]*?\b(?:caption|label)="(\d+ \/ [^"]+)"/g)].map(
    (m) => ({
      id: figureId(m[1]),
      label: m[1].replace(" / ", " "),
    }),
  );
}

export function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}
