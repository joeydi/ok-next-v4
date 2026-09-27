import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// Where each media key is referenced, found by plain text search over the source.
// Also collects references to keys that aren't in the manifest.

const ROOT = process.cwd();
const DIRS = ["src/content", "src/data", "src/app", "src/components"];
const SKIP = new Set(["src/app/admin", "src/data/media.json"]);
const EXT = /\.(mdx?|tsx?)$/;

// media="…" / media={"…"} (MDX, JSX) · media: "…" (data files) · getMedia("…")
const REFS = [/\bmedia=\{?["']([^"']+)["']/g, /\bmedia:\s*["']([^"']+)["']/g, /\bgetMedia\(\s*["']([^"']+)["']/g];

export type Usage = { file: string; title?: string; description?: string };
export type BrokenRef = { key: string; file: string };

function walk(dir: string): string[] {
  const rel = path.relative(ROOT, dir);
  if (SKIP.has(rel) || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return EXT.test(d.name) && !SKIP.has(path.relative(ROOT, p)) ? [p] : [];
  });
}

export function scanUsage(keys: string[]) {
  const known = new Set(keys);
  const usage: Record<string, Usage[]> = Object.fromEntries(keys.map((k) => [k, []]));
  const broken: BrokenRef[] = [];

  for (const abs of DIRS.flatMap((d) => walk(path.join(ROOT, d)))) {
    const file = path.relative(ROOT, abs);
    const text = fs.readFileSync(abs, "utf8");
    const refs = REFS.flatMap((re) => [...text.matchAll(re)].map((m) => m[1]));

    // Notes: the title/description give Claude context, and `image:` is a reference.
    let note: Omit<Usage, "file"> = {};
    if (file.endsWith(".mdx")) {
      const { data } = matter(text);
      note = { title: data.title && String(data.title).replace(/\*(.+?)\*/g, "$1"), description: data.description };
      if (data.image) refs.push(String(data.image));
    }

    for (const key of keys) if (text.includes(key)) usage[key].push({ file, ...note });
    for (const key of refs) if (!known.has(key)) broken.push({ key, file });
  }
  return { usage, broken };
}
