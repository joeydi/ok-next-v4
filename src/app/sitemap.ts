import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";
import { getAllNotes } from "@/lib/notes";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/digital-production", "/cms-integrations", "/business-tools", "/notes", "/network"].map((p) => ({
    url: `${SITE.url}${p}`,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.8,
  }));
  const notes = getAllNotes().map((n) => ({
    url: `${SITE.url}/notes/${n.slug}`,
    lastModified: n.date,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));
  return [...pages, ...notes];
}
