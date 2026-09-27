import type { Metadata } from "next";
import { readManifest } from "../../../../scripts/media.mjs";
import { MediaAdmin, type AdminItem } from "./MediaAdmin";
import { scanUsage } from "./usage";

// Dev-only (see pageExtensions in next.config.ts). Reads media.json from disk on
// every request so edits made by the actions show up after router.refresh().

export const metadata: Metadata = { title: "Media admin", robots: { index: false, follow: false } };

export default function MediaAdminPage() {
  const manifest: Record<string, Omit<AdminItem, "key" | "usedIn">> = readManifest();
  const { usage, broken } = scanUsage(Object.keys(manifest));
  const items: AdminItem[] = Object.entries(manifest).map(([key, e]) => ({ key, ...e, usedIn: usage[key] }));
  return <MediaAdmin items={items} broken={broken} host={process.env.NEXT_PUBLIC_MEDIA_HOST} />;
}
