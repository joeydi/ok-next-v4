// Syncs src/data/media.json with the R2 media bucket.
//
// Every image/video in the bucket gets an entry keyed by its object key, with the
// facts the site needs at build time (dimensions, blur placeholder, dominant colour,
// video poster + duration) plus hand-written fields (alt, caption, context) that
// sync never overwrites. Objects whose ETag hasn't changed are skipped.
//
// Video posters are extracted with ffmpeg and uploaded to _posters/<key>.jpg.
//
// Run: npm run media            (whole bucket; drops entries for deleted objects)
//      npm run media -- <key>…   (just these keys)
// The /admin/media page calls syncMedia() directly.

import { execFile as execFileCb } from "node:child_process";
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const execFile = promisify(execFileCb);

export const MANIFEST = path.join(process.cwd(), "src/data/media.json");
export const POSTERS = "_posters/";
export const CACHE_CONTROL = "public, max-age=31536000, immutable";

const TYPES = {
  image: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
  svg: ["svg"],
  video: ["mp4", "webm", "mov", "m4v"],
};

/** "image" | "svg" | "video" | undefined for unsupported files. */
export function mediaType(key) {
  const ext = key.split(".").pop()?.toLowerCase();
  return Object.keys(TYPES).find((t) => TYPES[t].includes(ext));
}

export const posterKey = (key) => `${POSTERS}${key.replace(/\.[^.]+$/, "")}.jpg`;

// ── R2 ────────────────────────────────────────────────────────────────────────

let client;

export function r2() {
  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) throw new Error(`media: set ${missing.join(", ")} in .env.local`);
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    // The SDK's default CRC32 checksums break presigned uploads to R2.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { s3: client, Bucket: process.env.R2_BUCKET };
}

async function listObjects() {
  const { s3, Bucket } = r2();
  const objects = [];
  let ContinuationToken;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken }));
    for (const o of res.Contents ?? []) objects.push({ key: o.Key, etag: o.ETag.replaceAll('"', ""), bytes: o.Size });
    ContinuationToken = res.NextContinuationToken;
  } while (ContinuationToken);
  return objects;
}

export async function getObjectBuffer(key) {
  const { s3, Bucket } = r2();
  const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

async function downloadTo(key, file) {
  const { s3, Bucket } = r2();
  const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  await pipeline(res.Body, createWriteStream(file));
}

// ── Manifest ──────────────────────────────────────────────────────────────────

export function readManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
}

function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + "\n");
}

/** Read-modify-write, so concurrent admin edits aren't lost to a long sync. */
export function updateManifest(fn) {
  const manifest = readManifest();
  fn(manifest);
  writeManifest(manifest);
  return manifest;
}

// Written by people (or drafted by Claude in the admin); sync carries them over.
const HUMAN = { alt: "", caption: "", context: "", altSource: null, reviewed: false };

function merge(prev, facts) {
  const human = Object.fromEntries(Object.keys(HUMAN).map((k) => [k, prev?.[k] ?? HUMAN[k]]));
  // A replaced file needs its alt text looked at again.
  if (prev && prev.etag !== facts.etag) human.reviewed = false;
  return { ...facts, ...human };
}

// ── Probing ───────────────────────────────────────────────────────────────────

const hex = ({ r, g, b }) => "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");

async function imageFacts(input) {
  const meta = await sharp(input).metadata();
  // EXIF orientations 5–8 are rotated 90°; browsers and Cloudflare display them upright.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : (meta.pageHeight ?? meta.height);
  const blur = await sharp(input).rotate().resize(16).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(input).stats();
  return { width, height, blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`, color: hex(dominant) };
}

async function svgFacts(input) {
  const { width, height } = await sharp(input).metadata();
  return { width, height };
}

let ffmpegChecked = false;

async function videoFacts(key) {
  if (!ffmpegChecked) {
    await execFile("ffprobe", ["-version"]).catch(() => {
      throw new Error("media: ffprobe/ffmpeg not found on PATH (brew install ffmpeg)");
    });
    ffmpegChecked = true;
  }
  const dir = mkdtempSync(path.join(tmpdir(), "okay-media-"));
  try {
    const file = path.join(dir, path.basename(key));
    await downloadTo(key, file);

    const { stdout } = await execFile("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
    const probe = JSON.parse(stdout);
    const video = probe.streams.find((s) => s.codec_type === "video");
    if (!video) throw new Error("no video stream");
    const rotation = Math.abs(Number(video.side_data_list?.find((d) => d.rotation != null)?.rotation ?? video.tags?.rotate ?? 0));
    const sideways = rotation === 90 || rotation === 270;
    const duration = Math.round(Number(probe.format.duration) * 10) / 10;

    const poster = path.join(dir, "poster.jpg");
    const at = duration > 1 ? "0.5" : "0";
    await execFile("ffmpeg", ["-v", "error", "-ss", at, "-i", file, "-frames:v", "1", "-q:v", "3", "-y", poster]);
    const posterBuf = readFileSync(poster);
    const { s3, Bucket } = r2();
    await s3.send(
      new PutObjectCommand({ Bucket, Key: posterKey(key), Body: posterBuf, ContentType: "image/jpeg", CacheControl: CACHE_CONTROL }),
    );
    const { blurDataURL, color } = await imageFacts(posterBuf);

    return {
      width: sideways ? video.height : video.width,
      height: sideways ? video.width : video.height,
      duration,
      hasAudio: probe.streams.some((s) => s.codec_type === "audio"),
      poster: posterKey(key),
      blurDataURL,
      color,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function probe({ key, etag, bytes }) {
  const type = mediaType(key);
  const facts =
    type === "video"
      ? await videoFacts(key)
      : type === "svg"
        ? await svgFacts(await getObjectBuffer(key))
        : await imageFacts(await getObjectBuffer(key));
  // Fixed field order keeps manifest diffs readable.
  return { type, width: facts.width, height: facts.height, bytes, etag, ...facts };
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Brings the manifest up to date with the bucket. With `keys`, only those objects
 * are (re)checked and nothing is removed; `force` re-probes unchanged objects too.
 * @param {{ keys?: string[], force?: boolean, log?: (msg: string) => void }} [options]
 */
export async function syncMedia({ keys, force = false, log = console.log } = {}) {
  const objects = (await listObjects()).filter((o) => !o.key.startsWith(POSTERS) && !o.key.endsWith("/"));
  const current = readManifest();
  const wanted = keys ? new Set(keys) : null;

  const todo = [];
  const skipped = [];
  for (const o of objects) {
    if (wanted && !wanted.has(o.key)) continue;
    if (!mediaType(o.key)) {
      log(`  skip ${o.key} (unsupported type)`);
      continue;
    }
    if (!force && current[o.key]?.etag === o.etag) skipped.push(o.key);
    else todo.push(o);
  }
  if (wanted) {
    for (const k of wanted) if (!objects.some((o) => o.key === k)) log(`  missing ${k} (not in bucket)`);
  }

  const facts = {};
  const errors = [];
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const o = todo[next++];
      try {
        facts[o.key] = await probe(o);
        log(`  ${current[o.key] ? "updated" : "added"} ${o.key}`);
      } catch (err) {
        errors.push({ key: o.key, error: err.message });
        log(`  error ${o.key}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const inBucket = new Set(objects.map((o) => o.key));
  const removed = wanted ? [] : Object.keys(current).filter((k) => !inBucket.has(k));

  updateManifest((m) => {
    for (const [key, f] of Object.entries(facts)) m[key] = merge(m[key], f);
    for (const key of removed) delete m[key];
  });
  for (const key of removed) log(`  removed ${key}`);

  const added = Object.keys(facts).filter((k) => !current[k]);
  const updated = Object.keys(facts).filter((k) => current[k]);
  return { added, updated, removed, skipped, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const keys = args.filter((a) => !a.startsWith("--"));
  const r = await syncMedia({ keys: keys.length ? keys : undefined, force });
  console.log(
    `media.json: ${r.added.length} added, ${r.updated.length} updated, ${r.removed.length} removed, ${r.skipped.length} unchanged` +
      (r.errors.length ? `, ${r.errors.length} failed` : ""),
  );
  if (r.errors.length) process.exitCode = 1;
}
