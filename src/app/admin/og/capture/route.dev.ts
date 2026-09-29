import { PutObjectCommand } from "@aws-sdk/client-s3";
import { chromium } from "playwright-core";
import { isOgKeyFor, ogCard, ogMediaKey, ogPaths } from "@/lib/og-cards";
import {
  CACHE_CONTROL,
  deleteMedia,
  r2,
  readManifest,
  syncMedia,
  updateManifest,
} from "../../../../../scripts/media.mjs";

// Dev-only (route.dev.ts): screenshots a route's card as the browser draws it
// (/admin/og/card, titles in Gelica) with the installed Chrome, uploads it to the
// media store as og/<name>-<hash>.png, adds it to media.json, and deletes the
// route's older cards. ?path=/network for one, ?all=stale for every route whose
// current card isn't saved.

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const manifest = readManifest();
  const paths =
    url.searchParams.get("all") === "stale"
      ? ogPaths().filter((p) => !manifest[ogMediaKey(p, ogCard(p)!)])
      : path && ogCard(path)
        ? [path]
        : null;
  if (!paths) return Response.json({ error: `No card for ${path}` }, { status: 400 });

  const { s3, Bucket } = r2();
  const written: string[] = [];
  const removed: string[] = [];
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    for (const p of paths) {
      const card = ogCard(p)!;
      const key = ogMediaKey(p, card);

      await page.goto(`${url.origin}/admin/og/card?path=${encodeURIComponent(p)}`);
      await page.waitForSelector("[data-ready]", { timeout: 30_000 });
      const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });

      await s3.send(
        new PutObjectCommand({ Bucket, Key: key, Body: png, ContentType: "image/png", CacheControl: CACHE_CONTROL }),
      );
      const { errors } = await syncMedia({ keys: [key], log: () => {} });
      if (errors.length) throw new Error(`${key}: ${errors[0].error}`);
      updateManifest((m: Record<string, Record<string, unknown>>) => {
        Object.assign(m[key], {
          alt: card.alt,
          context: `Open Graph card for ${p}`,
          altSource: "human",
          reviewed: true,
        });
      });
      written.push(key);

      for (const old of Object.keys(readManifest()).filter((k) => k !== key && isOgKeyFor(p, k))) {
        await deleteMedia(old);
        removed.push(old);
      }
    }
  } finally {
    await browser.close();
  }
  return Response.json({ written, removed });
}
