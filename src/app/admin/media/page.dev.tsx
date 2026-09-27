import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { services } from "@/data/services";
import { readManifest } from "../../../../scripts/media.mjs";
import { MediaAdmin, type AdminItem } from "./MediaAdmin";
import { scanUsage } from "./usage";

// Dev-only (see pageExtensions in next.config.ts). Reads media.json from disk on
// every request so edits made by the actions show up after router.refresh().

export const metadata: Metadata = { title: "Media admin", robots: { index: false, follow: false } };

// Typed by hand: generated route types don't include dev-only routes.
export default async function MediaAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?key=… opens that asset's details.
  const { key } = await searchParams;
  const manifest: Record<string, Omit<AdminItem, "key" | "usedIn">> = readManifest();
  const { usage, broken } = scanUsage(Object.keys(manifest));
  const items: AdminItem[] = Object.entries(manifest).map(([key, e]) => ({ key, ...e, usedIn: usage[key] }));

  // Upload folder suggestions: the conventional ones plus any folder already in use.
  const folders = [
    ...new Set([
      "home",
      // From file names, not getAllNotes(): that throws on a broken media key, and this page is where you fix those.
      ...fs
        .readdirSync(path.join(process.cwd(), "src/content/notes"))
        .filter((f) => f.endsWith(".mdx"))
        .map((f) => `notes/${f.replace(/\.mdx$/, "")}`),
      ...Object.keys(services).map((slug) => `services/${slug}`),
      ...Object.keys(manifest).flatMap((k) => (k.includes("/") ? [k.slice(0, k.lastIndexOf("/"))] : [])),
    ]),
  ].sort();

  return (
    <MediaAdmin
      items={items}
      broken={broken}
      folders={folders}
      initialKey={typeof key === "string" && manifest[key] ? key : null}
      host={process.env.NEXT_PUBLIC_MEDIA_HOST}
    />
  );
}
