import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { SceneName } from "@/components/illustrations/gl/scenes";
import { Logo } from "@/components/Logo";
import { networkSvg } from "@/components/network/frame";
import type { Rect } from "@/components/network/simulation";
import type { Media } from "./media";
import { mediaImageUrl, mediaUrl } from "./media-url";
import { type OgCard, ogCard, ogMediaKey } from "./og-cards";
import { defaultTitleWidth } from "./og-title";

// Shared Open Graph card in the Field Notes style. Gelica can't be embedded
// server-side (Adobe Fonts licence), so this satori version sets titles in Hanken
// Grotesk; a Gelica one drawn in the browser (OgCardHtml, saved from /admin/og)
// replaces it once it's in the media store. See ogImage.

export const OG_SIZE = { width: 1200, height: 630 };

const fonts = Promise.all([
  readFile(path.join(process.cwd(), "src/app/_fonts/hanken-500.ttf")),
  readFile(path.join(process.cwd(), "src/app/_fonts/plex-mono-400.ttf")),
]);

// The framed image beside the title, at 16:9.
const FRAME = { width: 520, height: 293 };

/** The asset (a video's poster) as a JPEG data URI `width` px wide, since satori can't read AVIF/WebP or SVG. */
export async function imageData(media: Media, width = FRAME.width * 2) {
  const key = media.type === "video" ? media.poster : media.type === "image" ? media.key : undefined;
  if (!key) return undefined;
  // A network hiccup at build time costs the image, not the deploy: the card goes without it.
  const res = await fetch(mediaImageUrl(key, { width, quality: 85, format: "jpeg" })).catch(() => null);
  if (!res?.ok) {
    console.warn(`og: couldn't fetch ${key} (${res?.status ?? "network error"}); leaving it out`);
    return undefined;
  }
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

// The box an illustration poster is fitted into, in the bottom-right corner.
const POSTER = { width: 440, height: 380 };

/** A scene's poster (public/illustrations/), trimmed to its content and fitted to POSTER, as a PNG data URI. */
export async function posterData(scene: SceneName) {
  const { data, info } = await sharp(path.join(process.cwd(), `public/illustrations/${scene}-1240.webp`))
    .trim({ threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const scale = Math.min(POSTER.width / info.width, POSTER.height / info.height);
  return {
    src: `data:image/png;base64,${data.toString("base64")}`,
    width: Math.round(info.width * scale),
    height: Math.round(info.height * scale),
  };
}

// The card's text blocks, padded so the network backdrop's nodes clear them: the
// logo, the tagline, and the eyebrow + title.
const NETWORK_AVOID: Rect[] = [
  [24, 24, 254, 139],
  [608, 24, 1176, 139],
  [24, 384, 660, 606],
];

/** The /network animation's still for the card, as an SVG document at OG_SIZE. */
export const networkBackdrop = () => networkSvg({ ...OG_SIZE, avoid: NETWORK_AVOID, color: "#FF4D6A" });

/** An SVG drawing as a PNG data URI at the card's size, since satori can't read SVG. */
async function svgData(svg: string) {
  const data = await sharp(Buffer.from(svg)).resize(OG_SIZE.width, OG_SIZE.height).png().toBuffer();
  return `data:image/png;base64,${data.toString("base64")}`;
}

/** What fills the card behind its text, if anything: the network still, or with `backdrop`, the image. */
export function backdropData({ image, network, backdrop }: Pick<OgCard, "image" | "network" | "backdrop">) {
  if (network) return svgData(networkBackdrop());
  if (backdrop && image) return imageData(image, OG_SIZE.width * 2);
  return undefined;
}

/**
 * `title` may contain *starred* words, rendered in pink. Separate eyebrow parts with two spaces.
 * An `image` (a video's poster) sits framed beside the title, or with `backdrop`, fills the
 * card behind it; SVGs are skipped. Without one, an `illustration` scene's poster sits in the
 * bottom-right corner. `network` fills the card with a still of the /network animation.
 * `dark` sets the text light, for a dark backdrop.
 */
export async function renderOg({
  eyebrow,
  title,
  image,
  illustration,
  network,
  backdrop,
  dark,
  titleWidth,
}: Omit<OgCard, "alt">) {
  const [[hanken, mono], imageSrc, backdropSrc] = await Promise.all([
    fonts,
    image && !backdrop ? imageData(image) : undefined,
    backdropData({ image, network, backdrop }),
  ]);
  const poster = !imageSrc && illustration ? await posterData(illustration) : undefined;
  // Words break only at spaces, so a star mid-word ("Notes*.*") colours part of it
  // without adding word spacing.
  const words: { text: string; pink: boolean }[][] = [[]];
  for (const chunk of title.split(/(\*.+?\*)/)) {
    const pink = chunk.startsWith("*");
    for (const part of chunk.replace(/\*/g, "").split(/(\s+)/)) {
      if (/^\s+$/.test(part)) words.push([]);
      else if (part) words[words.length - 1].push({ text: part, pink });
    }
  }
  const column = titleWidth ?? defaultTitleWidth(Boolean(imageSrc), Boolean(poster));
  // `dark` sets the text light: paper, with the labels a little dimmer (as OgCardHtml does).
  const ink = dark ? "#F2ECE6" : "#1D1A17";
  const muted = dark ? "rgba(242, 236, 230, 0.8)" : "#746759";
  // Beside an image the title gets a narrower column, so it steps down sooner.
  const size = imageSrc
    ? title.length > 48
      ? 52
      : title.length > 28
        ? 64
        : 80
    : title.length > 60
      ? 64
      : title.length > 32
        ? 80
        : 104;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: dark ? "#1D1A17" : "#F2ECE6",
        color: ink,
        fontFamily: "Hanken",
      }}
    >
      {backdropSrc && (
        <img
          src={backdropSrc}
          {...OG_SIZE}
          alt=""
          style={{ position: "absolute", left: 0, top: 0, objectFit: "cover" }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo width={150} height={35} style={{ color: "#FF4D6A" }} />
        <div style={{ fontFamily: "Plex Mono", fontSize: 20, letterSpacing: "0.06em", color: muted }}>
          JOE DI STEFANO / DESIGNER + DEVELOPER
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: imageSrc ? 24 : 28,
            ...(imageSrc ? { width: column } : { maxWidth: column }),
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              fontFamily: "Plex Mono",
              fontSize: 22,
              letterSpacing: "0.06em",
              color: muted,
              whiteSpace: "nowrap",
            }}
          >
            {eyebrow
              .toUpperCase()
              .split(/\s{2,}/)
              .map((part, i) => (
                <span key={i} style={{ flexShrink: 0 }}>
                  {part}
                </span>
              ))}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: size,
              lineHeight: 1,
              letterSpacing: "-0.035em",
            }}
          >
            {words
              .filter((pieces) => pieces.length)
              .map((pieces, i) => (
                <div key={i} style={{ display: "flex", marginRight: size * 0.24 }}>
                  {pieces.map(({ text, pink }, j) => (
                    <span key={j} style={{ color: pink ? "#FF4D6A" : ink }}>
                      {text}
                    </span>
                  ))}
                </div>
              ))}
          </div>
        </div>
        {imageSrc && (
          <img
            src={imageSrc}
            {...FRAME}
            alt=""
            style={{ objectFit: "cover", border: "1px solid #D8CCBF", borderRadius: 2 }}
          />
        )}
      </div>
      {poster && (
        <img
          src={poster.src}
          width={poster.width}
          height={poster.height}
          alt=""
          style={{ position: "absolute", right: 48, bottom: 40 }}
        />
      )}
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Hanken", data: hanken, weight: 500, style: "normal" },
        { name: "Plex Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}

/**
 * Whether media.json has a key, read from disk rather than imported: under `next dev`
 * the capture route rewrites it, and an imported copy keeps the version it loaded.
 */
async function inManifest(key: string) {
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "src/data/media.json"), "utf8"));
  return key in manifest;
}

/**
 * A route's card: the Gelica one saved from /admin/og when the media store has it
 * for the card as it is now, otherwise (none saved, stale, or unreachable) the
 * satori one, with a warning at build time.
 */
export async function ogImage(path: string) {
  const card = ogCard(path);
  if (!card) throw new Error(`og: no card for ${path}`);
  const key = ogMediaKey(path, card);
  const warn = (why: string) =>
    process.env.NODE_ENV === "production" && console.warn(`og: ${path} ${why}; using the Hanken card`);

  if (!(await inManifest(key))) {
    warn("has no current Gelica card (save it from /admin/og)");
    return renderOg(card);
  }
  const res = await fetch(mediaUrl(key)).catch(() => null);
  if (!res?.ok) {
    warn(`couldn't fetch ${key} (${res?.status ?? "network error"})`);
    return renderOg(card);
  }
  return new Response(await res.arrayBuffer(), { headers: { "Content-Type": "image/png" } });
}
