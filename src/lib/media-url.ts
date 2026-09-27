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

/** next/image loader: resized + AVIF/WebP via Cloudflare Image Transformations. */
export function mediaLoader({ src, width, quality }: ImageLoaderProps) {
  return `${base()}/cdn-cgi/image/width=${width},quality=${quality ?? 75},format=auto/${encodeKey(src)}`;
}
