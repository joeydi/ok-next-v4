import manifest from "@/data/media.json";

// Images and videos live in the R2 bucket; src/data/media.json (written by
// `npm run media` and the /admin/media page) describes them. Server-only: the
// manifest carries a blur placeholder per asset, so resolve keys here and pass
// the resulting `Media` to client components rather than importing this there.

export type MediaKey = keyof typeof manifest & string;

type Entry = {
  type: "image" | "svg" | "video";
  width: number;
  height: number;
  bytes: number;
  etag: string;
  duration?: number;
  hasAudio?: boolean;
  poster?: string;
  /** Video only: the poster frame's time (s), chosen in the admin; null for the default, half a second in. */
  posterAt?: number | null;
  /** Video only: VIDEO_PRESET version it was encoded with, and where the upload is kept. */
  encode?: string;
  original?: string;
  blurDataURL?: string;
  color?: string;
  alt: string;
  caption: string;
  context: string;
  altSource: "ai" | "human" | null;
  reviewed: boolean;
  /** Video only: keep or remove its sound (null until decided in the admin). */
  audio?: "keep" | "remove" | null;
};

/** What a component needs to render one asset. */
export type Media = Pick<
  Entry,
  "type" | "width" | "height" | "alt" | "caption" | "blurDataURL" | "color" | "poster" | "posterAt" | "hasAudio"
> & {
  key: string;
};

const entries = manifest as unknown as Record<string, Entry>;

/** Resolves a key from the manifest. Throws on unknown keys so a typo fails the build. */
export function getMedia(key: string): Media {
  const e = entries[key];
  if (!e) throw new Error(`media: unknown key "${key}" — upload it to R2 and run \`npm run media\``);
  const { type, width, height, alt, caption, blurDataURL, color, poster, posterAt, hasAudio } = e;
  return { key, type, width, height, alt, caption, blurDataURL, color, poster, posterAt, hasAudio };
}
