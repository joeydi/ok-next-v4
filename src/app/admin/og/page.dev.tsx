import type { Metadata } from "next";
import { SCENES } from "@/components/illustrations/gl/scenes";
import manifest from "@/data/media.json";
import { services } from "@/data/services";
import { getAllNotes } from "@/lib/notes";
import { isOgKeyFor, ogCard, ogMediaKey } from "@/lib/og-cards";
import { readManifest } from "../../../../scripts/media.mjs";
import { AdminShell } from "../AdminShell";
import { type CardStatus, OgAdmin, type OgPage } from "./OgAdmin";

// Dev-only (see pageExtensions in next.config.ts): every route's Open Graph card as
// the page's meta tags point to it, plus a playground that renders cards from query params.

export const metadata: Metadata = { title: "Open Graph", robots: { index: false, follow: false } };

export default function OgAdminPage() {
  let notes: OgPage[] = [];
  let notesError: string | null = null;
  try {
    notes = getAllNotes().map((n) => ({ path: `/notes/${n.slug}`, label: n.plainTitle, draft: n.draft }));
  } catch (e) {
    notesError = (e as Error).message;
  }
  const listed: OgPage[] = [
    { path: "/", label: "Home" },
    ...Object.entries(services).map(([slug, s]) => ({ path: `/${slug}`, label: s.title })),
    { path: "/notes", label: "Notes" },
    ...notes,
    { path: "/network", label: "Network" },
  ];
  // Whether each route's Gelica card is saved for the card as it is now. Read fresh,
  // since the capture route rewrites media.json while this page is open.
  const keys = Object.keys(readManifest());
  const status = (path: string): CardStatus | undefined => {
    const card = ogCard(path);
    if (!card) return undefined;
    if (keys.includes(ogMediaKey(path, card))) return "saved";
    return keys.some((k) => isOgKeyFor(path, k)) ? "stale" : "missing";
  };
  const pages = listed.map((p) => ({ ...p, card: status(p.path) }));
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
