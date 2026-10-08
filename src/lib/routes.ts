import { type ServiceSlug, services } from "@/data/services";
import { getAllNotes } from "./notes";

// Every public page, listed once. The sitemap, the social cards (and the dev-only
// /admin/og and media usage) all read it, so a new page only needs adding here.
// llms.txt is written by hand, so it keeps its own list.

/**
 * The site's paths, in the order the admin lists them. Pass `notes` to use notes
 * already read (the admin's survive a note that fails to parse); otherwise they're
 * read here, drafts showing only under `next dev`.
 */
export function sitePaths(notes: { slug: string }[] = getAllNotes()) {
  return [
    "/",
    ...(Object.keys(services) as ServiceSlug[]).map((s) => `/${s}`),
    "/website-care",
    "/notes",
    ...notes.map((n) => `/notes/${n.slug}`),
    "/network",
    "/site-check",
  ];
}
