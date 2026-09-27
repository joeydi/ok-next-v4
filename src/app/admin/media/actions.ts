"use server";

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import {
  CACHE_CONTROL,
  getObjectBuffer,
  mediaType,
  moveMedia,
  r2,
  readManifest,
  syncMedia,
  updateManifest,
} from "../../../../scripts/media.mjs";
import { scanUsage } from "./usage";

// Dev-only: this route is page.dev.tsx, so it isn't built for production. The
// check below is a second lock in case these actions are ever imported elsewhere.
function assertDev() {
  if (process.env.NODE_ENV !== "development") throw new Error("Media admin actions only run under `next dev`.");
}

type Fields = { alt: string; caption: string; context: string };

export async function saveEntry(key: string, fields: Fields) {
  assertDev();
  updateManifest((m: Record<string, Fields & { altSource: string | null; reviewed: boolean }>) => {
    const e = m[key];
    if (!e) throw new Error(`Unknown key ${key}`);
    if (e.alt !== fields.alt) e.altSource = fields.alt ? "human" : null;
    Object.assign(e, fields, { reviewed: true });
  });
}

export async function syncBucket(keys?: string[]) {
  assertDev();
  const { added, updated, removed, renamed, errors } = await syncMedia({ keys, log: () => {} });
  return { added: added.length, updated: updated.length, removed: removed.length, renamed, errors };
}

/** Keep or remove a video's sound. Re-encodes from the original when that changes the file. */
export async function setVideoAudio(key: string, audio: "keep" | "remove") {
  assertDev();
  const { hasAudio } = updateManifest((m: Record<string, { audio?: string | null }>) => {
    if (!m[key]) throw new Error(`Unknown key ${key}`);
    m[key].audio = audio;
  })[key];
  if ((audio === "remove") === Boolean(hasAudio)) {
    const { errors } = await syncMedia({ keys: [key], reencode: true, log: () => {} });
    if (errors.length) throw new Error(errors[0].error);
  }
}

const slugName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-(?=\.)/g, "");

/**
 * Turns what was typed into a clean key: each segment slugged like uploads, the
 * extension kept, and a trailing "/" meaning "this folder, same file name".
 */
function destinationKey(from: string, input: string) {
  if (!input.trim()) throw new Error("Enter a key or folder.");
  const ext = path.extname(from);
  const segments = input.split("/").map((s) => slugName(s.trim())).filter(Boolean);
  if (input.trim().endsWith("/") || !segments.length) segments.push(path.basename(from));
  const name = segments.pop()!;
  const nameExt = path.extname(name);
  if (nameExt && nameExt.toLowerCase() !== ext.toLowerCase()) throw new Error(`Keep the ${ext} extension.`);
  return [...segments, nameExt ? name : name + ext].join("/");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Moves an asset to a new key and rewrites references to it in the source. */
export async function moveEntry(from: string, input: string) {
  assertDev();
  const to = destinationKey(from, input);
  if (to === from) return { key: from, files: [] as string[] };
  await moveMedia(from, to);

  // Whole-key matches only: after a quote, "=", ":" or whitespace; before a quote, whitespace or line end.
  const re = new RegExp(`(?<=["'\\s=:])${escapeRe(from)}(?=["'\\s]|$)`, "gm");
  const files: string[] = [];
  for (const { file } of scanUsage([from]).usage[from]) {
    const abs = path.join(process.cwd(), file);
    const text = fs.readFileSync(abs, "utf8");
    const next = text.replace(re, to);
    if (next !== text) {
      fs.writeFileSync(abs, next);
      files.push(file);
    }
  }
  return { key: to, files };
}

/** Presigned PUT URLs so the browser uploads straight to R2 (videos are too big for an action body). */
export async function presignUploads(folder: string, files: { name: string; type: string }[]) {
  assertDev();
  const { s3, Bucket } = r2();
  const prefix = folder.split("/").map((s) => slugName(s.trim())).filter(Boolean).join("/");
  return Promise.all(
    files.map(async (f) => {
      const key = [prefix, slugName(f.name)].filter(Boolean).join("/");
      if (!mediaType(key)) throw new Error(`Unsupported file type: ${f.name}`);
      const headers = { "Content-Type": f.type || "application/octet-stream", "Cache-Control": CACHE_CONTROL };
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket, Key: key, ContentType: headers["Content-Type"], CacheControl: CACHE_CONTROL }),
        { expiresIn: 600 },
      );
      return { key, url, headers };
    }),
  );
}

// ── Alt text ──────────────────────────────────────────────────────────────────

const SYSTEM = `You write alt text for images on okaypl.us, the portfolio and notes site of Joe di Stefano, a designer and developer in Burlington, Vermont. Most images are case-study screenshots, product and UI shots, illustrations, and photos.

Alt text is read aloud by screen readers in place of the image, so it should give a listener what a sighted reader takes from the image in its context, not an inventory of everything in it.

- One sentence, ideally under 125 characters. Go longer only when the image carries information the surrounding text doesn't (a chart, a diagram).
- Don't start with "Image of" or "Photo of". Do name the medium when it matters: "Screenshot of…", "Illustration of…", "Diagram of…".
- Transcribe on-screen text only when it is the point (a headline, a key label), not every UI string.
- Name people, products, and places only when the author's context gives the names; otherwise describe them.
- Plain, specific language. No opinions ("beautiful", "stunning") unless the author's context asks for tone.
- If the image is purely decorative (a texture, a divider, an abstract background) set decorative to true and alt to "".`;

const SCHEMA = {
  type: "object",
  properties: { alt: { type: "string" }, decorative: { type: "boolean" } },
  required: ["alt", "decorative"],
  additionalProperties: false,
};

let anthropic: Anthropic | undefined;

/** Drafts alt text with Claude and saves it as an unreviewed AI draft. */
export async function generateAlt(key: string, context: string) {
  assertDev();
  const entry = readManifest()[key];
  if (!entry) throw new Error(`Unknown key ${key}`);

  // Videos are described from their poster frame. Everything goes to Claude as a
  // ≤1568px JPEG (its max useful size), which also covers SVG.
  const source = entry.type === "video" ? entry.poster : key;
  const buf = await getObjectBuffer(source);
  const jpeg = await sharp(buf, entry.type === "svg" ? { density: 300 } : {})
    .rotate()
    .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const usedIn = scanUsage([key]).usage[key];
  const notes = usedIn
    .filter((u) => u.title)
    .map((u) => `- "${u.title}"${u.description ? ` — ${u.description}` : ""}`);
  const prompt = [
    entry.type === "video" ? "This is the first frame of a short video; describe the video." : null,
    context.trim() ? `Context from the author:\n${context.trim()}` : null,
    notes.length ? `It appears in:\n${notes.join("\n")}` : null,
    `File: ${key}`,
    "Write the alt text.",
  ]
    .filter(Boolean)
    .join("\n\n");

  anthropic ??= new Anthropic();
  const res = await anthropic.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    // If a safety classifier declines, the API retries on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  if (res.stop_reason === "refusal") throw new Error("Claude declined to describe this image.");
  if (res.stop_reason === "max_tokens") throw new Error("Claude ran out of tokens; try again.");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const { alt, decorative } = JSON.parse(text) as { alt: string; decorative: boolean };
  const draft = decorative ? "" : alt.trim();

  updateManifest((m: Record<string, Fields & { altSource: string | null; reviewed: boolean }>) => {
    Object.assign(m[key], { alt: draft, context, altSource: "ai", reviewed: false });
  });
  return { alt: draft, decorative };
}
