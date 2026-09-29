import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// Design docs live in src/content/docs/*.mdx and show in the dev-only admin at
// /admin/docs/<slug>, listed in its sidebar. Frontmatter is read here, like notes;
// the body is compiled by @next/mdx via dynamic import.

const DIR = path.join(process.cwd(), "src/content/docs");

export type DocMeta = {
  slug: string;
  /** Heading and sidebar label. The heading adds a pink full stop. */
  title: string;
  /** The lede under the heading. */
  description: string;
  /** Position in the sidebar; docs without one come last, A–Z. */
  order?: number;
  /** "large" sets the heading a size up. */
  size?: "large";
};

function parse(file: string): DocMeta {
  const { data } = matter(fs.readFileSync(path.join(DIR, file), "utf8"));
  if (!data.title) throw new Error(`docs/${file}: missing "title" in frontmatter`);
  if (data.size !== undefined && data.size !== "large") throw new Error(`docs/${file}: size must be "large"`);
  if (data.order !== undefined && typeof data.order !== "number")
    throw new Error(`docs/${file}: order must be a number`);
  return {
    slug: file.replace(/\.mdx$/, ""),
    title: String(data.title),
    description: data.description ?? "",
    order: data.order,
    size: data.size,
  };
}

export function getAllDocs(): DocMeta[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map(parse)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.title.localeCompare(b.title));
}

export function getDoc(slug: string): DocMeta | null {
  const file = `${slug}.mdx`;
  return /^[a-z0-9-]+$/.test(slug) && fs.existsSync(path.join(DIR, file)) ? parse(file) : null;
}
