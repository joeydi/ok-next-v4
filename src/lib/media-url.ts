import type { ImageLoaderProps } from "next/image";

// URLs for objects in the R2 media bucket, served from its custom domain.
// Safe to import from client components (no manifest, no credentials).

const HOST = process.env.NEXT_PUBLIC_MEDIA_HOST;

function base() {
  if (!HOST) throw new Error("media: set NEXT_PUBLIC_MEDIA_HOST (e.g. media.okaypl.us)");
  return `https://${HOST}`;
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

/** The original file. */
export function mediaUrl(key: string) {
  return `${base()}/${encodeKey(key)}`;
}

/** A resized copy via Cloudflare Image Transformations. `format: "auto"` serves AVIF/WebP to browsers that take them. */
export function mediaImageUrl(
  key: string,
  { width, quality = 75, format = "auto" }: { width: number; quality?: number; format?: "auto" | "jpeg" },
) {
  return `${base()}/cdn-cgi/image/width=${width},quality=${quality},format=${format}/${encodeKey(key)}`;
}

/** next/image loader. */
export function mediaLoader({ src, width, quality }: ImageLoaderProps) {
  return mediaImageUrl(src, { width, quality });
}
