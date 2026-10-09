import { audiences, services } from "@/data/catalog";
import manifest from "@/data/media.json";
import { ADMIN_NAV, type NavLink, SITE } from "@/data/site";
import { siteCheck } from "@/data/site-check";
import { getAllDocs } from "./docs";
import { formatDate, getAllNotes } from "./notes";
import { ogCard, ogMediaKey } from "./og-cards";

// Every public page, listed once. The sitemap, the social cards (and the dev-only
// /admin/og and media usage) all read it, so a new page only needs adding here;
// service and audience pages come from the catalog. llms.txt is written by hand,
// so it keeps its own list.

/**
 * The site's paths, in the order the admin lists them. Pass `notes` to use notes
 * already read (the admin's survive a note that fails to parse); otherwise they're
 * read here, drafts showing only under `next dev`.
 */
export function sitePaths(notes: { slug: string }[] = getAllNotes()) {
  return [
    "/",
    ...Object.keys(services).map((s) => `/${s}`),
    ...Object.keys(audiences).map((a) => `/${a}`),
    "/notes",
    ...notes.map((n) => `/notes/${n.slug}`),
    "/network",
    "/site-check",
  ];
}

export type CommandItem = NavLink & {
  description?: string;
  /** The media key of the route's saved social card, when it has a current one. */
  card?: string;
  /** Label and value rows for the detail panel. */
  info: [string, string][];
};

export type CommandGroup = { label: string; items: CommandItem[] };

/** Descriptions for the pages in `sitePaths` that aren't services, audiences or notes; any without a label shows its path. */
const PAGES: Record<string, { label: string; description?: string }> = {
  "/": { label: "Home", description: SITE.description },
  "/notes": { label: "Notes" },
  "/network": { label: "Network" },
  "/site-check": { label: "Site check", description: siteCheck.metaDescription },
};

/** The route's saved Gelica social card, if media.json has one for the card as it is now. */
function savedCard(path: string) {
  const card = ogCard(path);
  const key = card && ogMediaKey(path, card);
  return key && key in manifest ? key : undefined;
}

/**
 * The hidden ⌘K menu's groups (see CommandMenu.tsx): every path in `sitePaths`, with
 * the admin tools and design docs under `next dev`, where they exist.
 */
export function commandGroups(): CommandGroup[] {
  const notes = getAllNotes();
  const item = (href: string, label: string, description: string | undefined, info: [string, string][] = []) => ({
    href,
    label,
    description,
    card: savedCard(href),
    info: [["Path", href], ...info] as [string, string][],
  });
  const named = [
    {
      label: "Services",
      items: Object.values(services).map((s) =>
        item(`/${s.slug}`, s.title, s.metaDescription, [["Audience", s.audience]]),
      ),
    },
    {
      label: "Who I work with",
      items: Object.values(audiences).map((a) =>
        item(`/${a.slug}`, a.title, a.metaDescription, [["Audience", a.audience]]),
      ),
    },
    {
      label: "Notes",
      items: notes.map((n) =>
        item(`/notes/${n.slug}`, n.plainTitle, n.description, [
          ["Published", formatDate(n.date)],
          ["Tag", n.tag],
          ...(n.client ? [["Client", n.client] as [string, string]] : []),
          ...(n.draft ? [["Status", "Draft"] as [string, string]] : []),
        ]),
      ),
    },
  ];
  const listed = new Set(named.flatMap((g) => g.items.map((l) => l.href)));
  const pages = sitePaths(notes)
    .filter((p) => !listed.has(p))
    .map((p) => item(p, PAGES[p]?.label ?? p, PAGES[p]?.description));
  const groups: CommandGroup[] = [{ label: "Pages", items: pages }, ...named];
  if (process.env.NODE_ENV === "development") {
    const dev: [string, string] = ["Status", "Dev only"];
    groups.push(
      { label: "Tools", items: ADMIN_NAV.map((l) => ({ ...l, info: [["Path", l.href], dev] })) },
      {
        label: "Docs",
        items: getAllDocs().map((d) => ({
          label: d.title,
          href: `/admin/docs/${d.slug}`,
          description: d.description,
          info: [["Path", `/admin/docs/${d.slug}`], dev],
        })),
      },
    );
  }
  return groups;
}
