import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";
import { getAllNotes } from "@/lib/notes";
import { sitePaths } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const notes = getAllNotes();
  const dates = new Map(notes.map((n) => [`/notes/${n.slug}`, n.date]));
  return sitePaths(notes).map((path) => {
    const url = `${SITE.url}${path === "/" ? "" : path}`;
    const date = dates.get(path);
    if (date) return { url, lastModified: date, changeFrequency: "yearly", priority: 0.6 };
    return { url, changeFrequency: "monthly", priority: path === "/" ? 1 : 0.8 };
  });
}
