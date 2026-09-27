// Syncs src/data/media.json with the R2 media bucket.
//
// Every image/video in the bucket gets an entry keyed by its object key, with the
// facts the site needs at build time (dimensions, blur placeholder, dominant colour,
// video poster + duration) plus hand-written fields (alt, caption, context) that
// sync never overwrites. Objects whose ETag hasn't changed are skipped.
//
// New videos are re-encoded to VIDEO_PRESET with ffmpeg: the upload is kept at
// _originals/<key>, and the encode replaces it as <key>.mp4. A real audio track is
// kept until someone chooses to remove it in the admin; silent tracks are dropped.
// Video posters are extracted from the encode and uploaded to _posters/<key>.jpg.
//
// Run: npm run media               (whole bucket; drops entries for deleted objects)
//      npm run media -- <key>…      (just these keys)
//      npm run media -- --reencode  (re-encode videos from their originals)
// The /admin/media page calls syncMedia() directly.

import { execFile as execFileCb } from "node:child_process";
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const execFile = promisify(execFileCb);

export const MANIFEST = path.join(process.cwd(), "src/data/media.json");
export const POSTERS = "_posters/";
export const ORIGINALS = "_originals/";
export const CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Every video on the site is encoded with these settings. Bump `version` after
 * changing them and the next sync re-encodes each video from its original.
 */
export const VIDEO_PRESET = {
  version: "1",
  maxWidth: 1920, // never upscaled
  maxFps: 30,
  crf: 23, // x264 quality: lower is better and bigger
  speed: "slow",
  audioBitrate: "128k",
};
// Audio tracks whose loudest moment is quieter than this count as silent.
const SILENT_DB = -50;

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
    for (const o of res.Contents ?? []) {
      if (o.Key.startsWith(POSTERS) || o.Key.startsWith(ORIGINALS) || o.Key.endsWith("/")) continue;
      objects.push({ key: o.Key, etag: o.ETag.replaceAll('"', ""), bytes: o.Size });
    }
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
// `audio` is the keep/remove choice for a video's sound (null until someone decides).
const HUMAN = { alt: "", caption: "", context: "", altSource: null, reviewed: false };
const HUMAN_VIDEO = { ...HUMAN, audio: null };

function merge(prev, facts, { reencoded = false } = {}) {
  const defaults = facts.type === "video" ? HUMAN_VIDEO : HUMAN;
  const human = Object.fromEntries(Object.keys(defaults).map((k) => [k, prev?.[k] ?? defaults[k]]));
  // A replaced file needs its alt text looked at again (a re-encode of the same original doesn't).
  if (prev && prev.etag !== facts.etag && !reencoded) human.reviewed = false;
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

async function checkFfmpeg() {
  if (ffmpegChecked) return;
  await execFile("ffprobe", ["-version"]).catch(() => {
    throw new Error("media: ffprobe/ffmpeg not found on PATH (brew install ffmpeg)");
  });
  ffmpegChecked = true;
}

// Encodes use every core, so run them one at a time.
let encodeQueue = Promise.resolve();
function serially(fn) {
  const run = encodeQueue.then(fn);
  encodeQueue = run.catch(() => {});
  return run;
}

const ffprobe = async (file) =>
  JSON.parse((await execFile("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file])).stdout);

async function isSilent(file) {
  const { stderr } = await execFile(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-map", "0:a:0", "-af", "volumedetect", "-vn", "-f", "null", "-"],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const max = stderr.match(/max_volume:\s*(-?[\d.]+|-inf) dB/)?.[1];
  return max === "-inf" || (max != null && Number(max) < SILENT_DB);
}

/** Encodes `src` to `out` with VIDEO_PRESET. Returns whether the output has sound. */
async function encodeVideo(src, out, { removeAudio }) {
  const P = VIDEO_PRESET;
  const hasTrack = (await ffprobe(src)).streams.some((s) => s.codec_type === "audio");
  const keepAudio = hasTrack && !removeAudio && !(await isSilent(src));
  await serially(() =>
    execFile("ffmpeg", [
      "-v", "error", "-y", "-i", src,
      "-map", "0:v:0",
      ...(keepAudio ? ["-map", "0:a:0", "-c:a", "aac", "-b:a", P.audioBitrate, "-ac", "2"] : ["-an"]),
      // Width capped and kept even (required by yuv420p); height follows the aspect ratio.
      "-vf", `scale='min(${P.maxWidth},trunc(iw/2)*2)':-2:flags=lanczos`,
      "-fpsmax", String(P.maxFps),
      "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", P.speed, "-crf", String(P.crf),
      // moov atom first, so playback starts before the whole file has downloaded.
      "-movflags", "+faststart",
      "-map_metadata", "-1",
      out,
    ]),
  );
  return keepAudio;
}

/** Dimensions, duration and a poster (uploaded to _posters/) for an encoded video file. */
async function readVideo(file, key) {
  const probe = await ffprobe(file);
  const video = probe.streams.find((s) => s.codec_type === "video");
  if (!video) throw new Error("no video stream");
  const rotation = Math.abs(Number(video.side_data_list?.find((d) => d.rotation != null)?.rotation ?? video.tags?.rotate ?? 0));
  const sideways = rotation === 90 || rotation === 270;
  const duration = Math.round(Number(probe.format.duration) * 10) / 10;

  const poster = `${file}.poster.jpg`;
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
}

const copySource = (Bucket, key) => `${Bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

/**
 * Brings one video object up to VIDEO_PRESET. A fresh upload is copied to
 * _originals/ and replaced by its encode at <key>.mp4 (the old key is deleted if
 * the extension changed). Returns the final key and its facts.
 */
async function processVideo(o, prev, { reencode, log }) {
  await checkFfmpeg();
  const { s3, Bucket } = r2();
  const meta = (await s3.send(new HeadObjectCommand({ Bucket, Key: o.key }))).Metadata ?? {};
  const dir = mkdtempSync(path.join(tmpdir(), "okay-media-"));
  try {
    if (meta["okay-encode"] === VIDEO_PRESET.version && !reencode) {
      const file = path.join(dir, "video.mp4");
      await downloadTo(o.key, file);
      const facts = await readVideo(file, o.key);
      return { key: o.key, facts: { ...facts, encode: VIDEO_PRESET.version, original: meta["okay-original"] } };
    }

    // No encode tag means someone just uploaded this: it becomes the original.
    const original = meta["okay-original"] ?? `${ORIGINALS}${o.key}`;
    if (!meta["okay-original"]) {
      await s3.send(new CopyObjectCommand({ Bucket, Key: original, CopySource: copySource(Bucket, o.key) }));
    }
    const src = path.join(dir, `original${path.extname(original)}`);
    await downloadTo(original, src);

    const key = o.key.replace(/\.[^.]+$/, ".mp4");
    const out = path.join(dir, "video.mp4");
    const audio = await encodeVideo(src, out, { removeAudio: prev?.audio === "remove" });
    const body = readFileSync(out);
    const put = await s3.send(
      new PutObjectCommand({
        Bucket,
        Key: key,
        Body: body,
        ContentType: "video/mp4",
        CacheControl: CACHE_CONTROL,
        Metadata: { "okay-encode": VIDEO_PRESET.version, "okay-original": original, "okay-audio": audio ? "aac" : "none" },
      }),
    );
    if (key !== o.key) await s3.send(new DeleteObjectCommand({ Bucket, Key: o.key }));
    log(`  encoded ${o.key}${key !== o.key ? ` → ${key}` : ""} (${mb(o.bytes)} → ${mb(body.length)})`);

    const facts = await readVideo(out, key);
    return {
      key,
      facts: { ...facts, bytes: body.length, etag: put.ETag.replaceAll('"', ""), encode: VIDEO_PRESET.version, original },
      // Same source as before (audio change or preset bump), so reviewed alt text still holds.
      reencoded: Boolean(meta["okay-original"]),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function probe(o, prev, opts) {
  const type = mediaType(o.key);
  let key = o.key;
  let facts;
  let reencoded = false;
  if (type === "video") {
    const v = await processVideo(o, prev, opts);
    key = v.key;
    reencoded = Boolean(v.reencoded);
    facts = { bytes: o.bytes, etag: o.etag, ...v.facts };
  } else {
    const buf = await getObjectBuffer(o.key);
    facts = { bytes: o.bytes, etag: o.etag, ...(type === "svg" ? await svgFacts(buf) : await imageFacts(buf)) };
  }
  // Fixed field order keeps manifest diffs readable.
  const { width, height, bytes, etag, ...rest } = facts;
  return { key, reencoded, entry: { type, width, height, bytes, etag, ...rest } };
}

// ── Move ──────────────────────────────────────────────────────────────────────

/**
 * Moves an asset to a new key in the bucket and the manifest, taking its poster
 * and (for videos) its original along. Source references are the caller's job.
 */
export async function moveMedia(from, to) {
  const { s3, Bucket } = r2();
  const manifest = readManifest();
  const e = manifest[from];
  if (!e) throw new Error(`media: unknown key ${from}`);
  if (manifest[to]) throw new Error(`media: ${to} already exists`);
  const taken = await s3.send(new HeadObjectCommand({ Bucket, Key: to })).then(
    () => true,
    () => false,
  );
  if (taken) throw new Error(`media: ${to} already exists in the bucket`);

  const copy = (src, dest, extra = {}) =>
    s3.send(new CopyObjectCommand({ Bucket, Key: dest, CopySource: copySource(Bucket, src), ...extra }));
  const del = (key) => s3.send(new DeleteObjectCommand({ Bucket, Key: key }));

  const original = e.original && `${ORIGINALS}${to.replace(/\.[^.]+$/, "")}${path.extname(e.original)}`;
  const poster = e.poster && posterKey(to);
  if (original) await copy(e.original, original);
  if (poster) await copy(e.poster, poster);
  // Replace the metadata so a video's okay-original points at the moved original.
  const head = await s3.send(new HeadObjectCommand({ Bucket, Key: from }));
  const res = await copy(from, to, {
    MetadataDirective: "REPLACE",
    ContentType: head.ContentType,
    CacheControl: head.CacheControl ?? CACHE_CONTROL,
    Metadata: { ...head.Metadata, ...(original && { "okay-original": original }) },
  });

  await del(from);
  if (original) await del(e.original);
  if (poster) await del(e.poster);

  updateManifest((m) => {
    m[to] = {
      ...m[from],
      etag: res.CopyObjectResult.ETag.replaceAll('"', ""),
      ...(poster && { poster }),
      ...(original && { original }),
    };
    delete m[from];
  });
}

// ── Sync ──────────────────────────────────────────────────────────────────────

const upToDate = (entry, o) =>
  entry?.etag === o.etag && (entry.type !== "video" || entry.encode === VIDEO_PRESET.version);

/**
 * Brings the manifest up to date with the bucket. With `keys`, only those objects
 * are (re)checked and nothing is removed. `force` re-reads unchanged objects;
 * `reencode` also re-encodes videos from their originals.
 * @param {{ keys?: string[], force?: boolean, reencode?: boolean, log?: (msg: string) => void }} [options]
 */
export async function syncMedia({ keys, force = false, reencode = false, log = console.log } = {}) {
  const objects = await listObjects();
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
    if (!force && !reencode && upToDate(current[o.key], o)) skipped.push(o.key);
    else todo.push(o);
  }
  if (wanted) {
    for (const k of wanted) if (!objects.some((o) => o.key === k)) log(`  missing ${k} (not in bucket)`);
  }

  const results = [];
  const errors = [];
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const o = todo[next++];
      try {
        // A renamed upload (clip.mov → clip.mp4) inherits whatever was written for either key.
        const prev = current[o.key] ?? current[o.key.replace(/\.[^.]+$/, ".mp4")];
        const r = await probe(o, prev, { reencode, log });
        results.push({ from: o.key, ...r });
        log(`  ${current[r.key] ? "updated" : "added"} ${r.key}`);
      } catch (err) {
        errors.push({ key: o.key, error: err.message });
        log(`  error ${o.key}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const present = new Set([...objects.map((o) => o.key), ...results.map((r) => r.key)]);
  const renamed = results.filter((r) => r.from !== r.key).map((r) => ({ from: r.from, to: r.key }));
  for (const r of renamed) present.delete(r.from);
  const removed = wanted
    ? renamed.map((r) => r.from).filter((k) => current[k])
    : Object.keys(current).filter((k) => !present.has(k));

  updateManifest((m) => {
    for (const r of results) {
      m[r.key] = merge(m[r.key] ?? m[r.from], r.entry, { reencoded: r.reencoded });
    }
    for (const key of removed) delete m[key];
  });
  for (const key of removed) log(`  removed ${key}`);

  const added = results.filter((r) => !current[r.key]).map((r) => r.key);
  const updated = results.filter((r) => current[r.key]).map((r) => r.key);
  return { added, updated, removed, renamed, skipped, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const keys = args.filter((a) => !a.startsWith("--"));
  const r = await syncMedia({
    keys: keys.length ? keys : undefined,
    force: args.includes("--force"),
    reencode: args.includes("--reencode"),
  });
  console.log(
    `media.json: ${r.added.length} added, ${r.updated.length} updated, ${r.removed.length} removed, ${r.skipped.length} unchanged` +
      (r.errors.length ? `, ${r.errors.length} failed` : ""),
  );
  if (r.errors.length) process.exitCode = 1;
}
