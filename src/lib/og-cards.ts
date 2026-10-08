import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SceneName } from "@/components/illustrations/gl/scenes";
import { type ServiceSlug, services } from "@/data/services";
import { siteCheck } from "@/data/site-check";
import type { Media } from "./media";
import { formatDate, getAllNotes, getNote } from "./notes";

// What each route's Open Graph card says. The card is drawn twice from this: in
// Gelica by the browser (/admin/og saves that to the media store as og/<name>-<hash>.png)
// and in Hanken by satori (renderOg), which stands in until a current one is saved.

/**
 * Part of every card's hash: bump it when the card layout changes (og.tsx, OgCardHtml)
 * or a network/illustration poster it draws is re-saved, so every saved card turns stale.
 */
const CARD_VERSION = 6;

export type OgCard = {
  /** Separate parts with two spaces. The first is drawn after a pink plus. */
  eyebrow: string;
  /** *Starred* words render pink. */
  title: string;
  alt: string;
  /** Framed beside the title, or with `backdrop`, filling the card behind it. */
  image?: Media;
  /** The image fills the card behind the text, as the network still does, instead of framed beside the title. */
  backdrop?: boolean;
  /** Light text, for a dark backdrop. */
  dark?: boolean;
  /** Its poster sits in the bottom-right corner (when there's no image). */
  illustration?: SceneName;
  /** A still of the /network animation fills the card. */
  network?: boolean;
  /** The title column's width in px, tuned by eye in /admin/og to set where the title wraps. */
  titleWidth?: number;
};

const TITLE_WIDTHS = join(process.cwd(), "src/data/og-title-widths.json");

/**
 * Each route's tuned title width, read from disk rather than imported: under `next dev`
 * /admin/og rewrites the file, and an imported copy keeps the version it loaded.
 */
const titleWidths = (): Record<string, number> => JSON.parse(readFileSync(TITLE_WIDTHS, "utf8"));

/** Sets a route's title width, or with none, goes back to the default. */
export function setTitleWidth(path: string, width: number | undefined) {
  const widths = titleWidths();
  if (width) widths[path] = Math.round(width);
  else delete widths[path];
  const sorted = Object.fromEntries(Object.entries(widths).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(TITLE_WIDTHS, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** The route as a key-safe name: home, notes, notes-<slug>, network, … */
const cardName = (path: string) => (path === "/" ? "home" : path.slice(1).replaceAll("/", "-"));

const SERVICE_SLUGS = Object.keys(services) as ServiceSlug[];

/** Every route with a card. */
export function ogPaths() {
  return [
    "/",
    ...SERVICE_SLUGS.map((s) => `/${s}`),
    "/notes",
    ...getAllNotes().map((n) => `/notes/${n.slug}`),
    "/network",
    "/site-check",
  ];
}

/** The card for a route, or null if it has none. */
export function ogCard(path: string): OgCard | null {
  const card = content(path);
  const titleWidth = card && titleWidths()[path];
  return card && titleWidth ? { ...card, titleWidth } : card;
}

/** What the route's card says and shows. */
function content(path: string): OgCard | null {
  if (path === "/")
    return {
      eyebrow: "Burlington, Vermont",
      title: "Let’s think it through, *together.*",
      alt: "Okayplus — Joe di Stefano, designer + developer in Burlington, Vermont",
      illustration: "puzzle-cube",
    };
  if (path === "/notes") return { eyebrow: "Notes", title: "Notes*.*", alt: "Notes — Okayplus" };
  if (path === "/network")
    return { eyebrow: "Network", title: "Stay eager*.*", alt: "Network — Okayplus", network: true };
  if (path === "/site-check")
    return { eyebrow: siteCheck.eyebrow, title: siteCheck.h1, alt: `${siteCheck.metaTitle} — Okayplus` };

  const slug = path.slice(1);
  if (slug in services) {
    const s = services[slug as ServiceSlug];
    return {
      eyebrow: `Services  ${s.n}  ${s.audience}`,
      title: s.h1.join(" "),
      alt: `${s.title} — Okayplus`,
      illustration: s.illustration,
    };
  }

  const note = path.startsWith("/notes/") ? getNote(path.slice("/notes/".length)) : null;
  if (note)
    return {
      eyebrow: `Notes  ${formatDate(note.meta.date)}  ${note.meta.tag}`,
      title: note.meta.title,
      alt: `${note.meta.plainTitle} — Okayplus`,
      image: note.meta.ogImage ?? note.meta.image,
      backdrop: note.meta.ogBackdrop || undefined,
      dark: note.meta.ogDarkMode || undefined,
    };
  return null;
}

/**
 * Where the saved Gelica card lives in the media store. The hash covers everything
 * the card shows, so a changed card gets a new key: the old one reads as stale,
 * and the year-long cache never serves it.
 */
export function ogMediaKey(path: string, card: OgCard) {
  const hash = createHash("sha1")
    .update(
      JSON.stringify([
        CARD_VERSION,
        card.eyebrow,
        card.title,
        card.image?.key,
        card.illustration,
        Boolean(card.network),
        // A video's poster, only when its frame was chosen in the admin, so other cards keep their keys.
        ...(card.image?.posterAt != null ? [card.image.poster] : []),
        // Only when set, so the cards saved before backdrops existed keep their keys.
        ...(card.backdrop ? ["backdrop"] : []),
        ...(card.dark ? ["dark"] : []),
        // Only when tuned, so the cards saved before widths existed keep their keys.
        ...(card.titleWidth ? [card.titleWidth] : []),
      ]),
    )
    .digest("hex")
    .slice(0, 8);
  return `og/${cardName(path)}-${hash}.png`;
}

/**
 * Whether a media key is one of the route's cards, current or stale. Matches the whole
 * key, since one route's name can start another's (og/notes-… and og/notes-<slug>-…).
 */
export const isOgKeyFor = (path: string, key: string) =>
  new RegExp(`^og/${cardName(path)}-[0-9a-f]{8}\\.png$`).test(key);
