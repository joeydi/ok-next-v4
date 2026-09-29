import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { SceneName } from "@/components/illustrations/gl/scenes";
import { Logo } from "@/components/Logo";
import type { Media } from "./media";
import { mediaImageUrl } from "./media-url";

// Shared Open Graph card in the Field Notes style. Gelica can't be embedded
// server-side (Adobe Fonts licence), so titles use Hanken Grotesk.

export const OG_SIZE = { width: 1200, height: 630 };

const fonts = Promise.all([
  readFile(path.join(process.cwd(), "src/app/_fonts/hanken-500.ttf")),
  readFile(path.join(process.cwd(), "src/app/_fonts/plex-mono-400.ttf")),
]);

// The framed image beside the title, at 16:9.
const FRAME = { width: 520, height: 293 };

/** The asset (a video's poster) as a JPEG data URI, since satori can't read AVIF/WebP or SVG. */
async function imageData(media: Media) {
  const key = media.type === "video" ? media.poster : media.type === "image" ? media.key : undefined;
  if (!key) return undefined;
  // A network hiccup at build time costs the image, not the deploy: the card goes without it.
  const res = await fetch(mediaImageUrl(key, { width: FRAME.width * 2, quality: 85, format: "jpeg" })).catch(
    () => null,
  );
  if (!res?.ok) {
    console.warn(`og: couldn't fetch ${key} (${res?.status ?? "network error"}); leaving it out`);
    return undefined;
  }
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

// The box an illustration poster is fitted into, in the bottom-right corner.
const POSTER = { width: 440, height: 380 };

/** A scene's poster (public/illustrations/), trimmed to its content and fitted to POSTER, as a PNG data URI. */
async function posterData(scene: SceneName) {
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

/**
 * `title` may contain *starred* words, rendered in pink. Separate eyebrow parts with two spaces.
 * An `image` (a video's poster) sits framed beside the title; SVGs are skipped. Without one, an
 * `illustration` scene's poster sits in the bottom-right corner.
 */
export async function renderOg({
  eyebrow,
  title,
  image,
  illustration,
}: {
  eyebrow: string;
  title: string;
  image?: Media;
  illustration?: SceneName;
}) {
  const [[hanken, mono], imageSrc] = await Promise.all([fonts, image && imageData(image)]);
  const poster = !imageSrc && illustration ? await posterData(illustration) : undefined;
  const words = title.split(/(\*.+?\*)/).flatMap((chunk) => {
    const pink = chunk.startsWith("*");
    return chunk
      .replace(/\*/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ w, pink }));
  });
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
        background: "#F2ECE6",
        color: "#1D1A17",
        fontFamily: "Hanken",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo width={150} height={35} style={{ color: "#FF4D6A" }} />
        <div style={{ fontFamily: "Plex Mono", fontSize: 20, letterSpacing: "0.06em", color: "#746759" }}>
          JOE DI STEFANO / DESIGNER + DEVELOPER
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: imageSrc ? 24 : 28,
            ...(imageSrc ? { width: 504 } : { maxWidth: poster ? 680 : 860 }),
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              fontFamily: "Plex Mono",
              fontSize: 22,
              letterSpacing: "0.06em",
              color: "#746759",
            }}
          >
            {eyebrow
              .toUpperCase()
              .split(/\s{2,}/)
              .map((part, i) => (
                <span key={i}>{part}</span>
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
            {words.map(({ w, pink }, i) => (
              <span key={i} style={{ color: pink ? "#FF4D6A" : "#1D1A17", marginRight: size * 0.24 }}>
                {w}
              </span>
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
