import type { Metadata } from "next";
import { SCENES } from "@/components/illustrations/gl/scenes";
import manifest from "@/data/media.json";
import { getAllNotes } from "@/lib/notes";
import { isOgKeyFor, ogCard, ogMediaKey } from "@/lib/og-cards";
import { sitePaths } from "@/lib/routes";
import { readManifest } from "../../../../scripts/media.mjs";
import { AdminShell } from "../AdminShell";
import { type CardStatus, OgAdmin, type OgPage } from "./OgAdmin";

// Dev-only (see pageExtensions in next.config.ts): every route's Open Graph card as
// the page's meta tags point to it, plus a playground that renders cards from query params.

export const metadata: Metadata = { title: "Open Graph", robots: { index: false, follow: false } };

type Listed = Pick<OgPage, "path" | "label" | "draft">;

export default function OgAdminPage() {
  // A note that fails to parse costs the list its notes, not every route.
  let notes: ReturnType<typeof getAllNotes> = [];
  let notesError: string | null = null;
  try {
    notes = getAllNotes();
  } catch (e) {
    notesError = (e as Error).message;
  }
  const drafts = new Set(notes.filter((n) => n.draft).map((n) => `/notes/${n.slug}`));
  // Each route is labelled by its card's alt text, less the site name; home's alt is a whole sentence.
  const listed: Listed[] = sitePaths(notes).map((path) => ({
    path,
    label: path === "/" ? "Home" : (ogCard(path)?.alt.replace(/ — Okayplus$/, "") ?? path),
    draft: drafts.has(path) || undefined,
  }));
  // Whether each route's Gelica card is saved for the card as it is now. Read fresh,
  // since the capture route rewrites media.json while this page is open.
  const keys = Object.keys(readManifest());
  const status = (path: string): CardStatus | undefined => {
    const card = ogCard(path);
    if (!card) return undefined;
    if (keys.includes(ogMediaKey(path, card))) return "saved";
    return keys.some((k) => isOgKeyFor(path, k)) ? "stale" : "missing";
  };
  // What sets its title width's default and range (as og.tsx lays the card out: SVG images
  // are left out), and for a note, the flags its checkboxes set.
  const layout = (path: string): Omit<OgPage, keyof Listed | "card"> => {
    const card = ogCard(path);
    return {
      titleWidth: card?.titleWidth,
      image: card?.image?.type === "image" || card?.image?.type === "video",
      illustration: Boolean(card?.illustration),
      flags: path.startsWith("/notes/") ? { backdrop: Boolean(card?.backdrop), dark: Boolean(card?.dark) } : undefined,
    };
  };
  const pages = listed.map((p) => ({ ...p, card: status(p.path), ...layout(p.path) }));
  // Anything satori can draw: images and video posters, not SVGs.
  const mediaKeys = Object.entries(manifest as Record<string, { type: string }>)
    .filter(([, e]) => e.type !== "svg")
    .map(([k]) => k)
    .sort();

  return (
    <AdminShell>
      <OgAdmin pages={pages} notesError={notesError} scenes={Object.keys(SCENES)} mediaKeys={mediaKeys} />
    </AdminShell>
  );
}
