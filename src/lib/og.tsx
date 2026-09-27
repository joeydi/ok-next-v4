import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { cubeMarkSvg } from "./cube-mark";
import type { Media } from "./media";
import { mediaImageUrl } from "./media-url";

// Shared Open Graph card in the Field Notes style. Gelica can't be embedded
// server-side (Adobe Fonts licence), so titles use Hanken Grotesk.

export const OG_SIZE = { width: 1200, height: 630 };

const fonts = Promise.all([
  readFile(path.join(process.cwd(), "src/app/_fonts/hanken-500.ttf")),
  readFile(path.join(process.cwd(), "src/app/_fonts/plex-mono-400.ttf")),
]);

const logo = readFile(path.join(process.cwd(), "public/assets/okayplus.svg"), "utf8").then(
  (svg) => `data:image/svg+xml;base64,${Buffer.from(svg.replace(/#374151/g, "#1C1916")).toString("base64")}`,
);

const cube = `data:image/svg+xml;base64,${Buffer.from(cubeMarkSvg({ background: null, size: 160 })).toString("base64")}`;

// The framed image beside the title, at 16:9.
const FRAME = { width: 520, height: 293 };

/** The asset (a video's poster) as a JPEG data URI, since satori can't read AVIF/WebP or SVG. */
async function imageData(media: Media) {
  const key = media.type === "video" ? media.poster : media.type === "image" ? media.key : undefined;
  if (!key) return undefined;
  // A network hiccup at build time costs the image, not the deploy: the card falls back to the cube.
  const res = await fetch(mediaImageUrl(key, { width: FRAME.width * 2, quality: 85, format: "jpeg" })).catch(() => null);
  if (!res?.ok) {
    console.warn(`og: couldn't fetch ${key} (${res?.status ?? "network error"}); using the cube`);
    return undefined;
  }
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

/**
 * `title` may contain *starred* words, rendered in pink. Separate eyebrow parts with two spaces.
 * An `image` (a video's poster) sits framed beside the title; without one, or for an SVG, the cube mark does.
 */
export async function renderOg({ eyebrow, title, image }: { eyebrow: string; title: string; image?: Media }) {
  const [[hanken, mono], logoSrc, imageSrc] = await Promise.all([fonts, logo, image && imageData(image)]);
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
    ? title.length > 48 ? 52 : title.length > 28 ? 64 : 80
    : title.length > 60 ? 64 : title.length > 32 ? 80 : 104;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#F3EFE8",
          color: "#1C1916",
          fontFamily: "Hanken",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={150} height={35} alt="" />
          <div style={{ fontFamily: "Plex Mono", fontSize: 20, letterSpacing: "0.06em", color: "#6B645B" }}>
            JOE DI STEFANO / DESIGNER + DEVELOPER
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: imageSrc ? 24 : 28,
              ...(imageSrc ? { width: 504 } : { maxWidth: 860 }),
            }}
          >
            <div style={{ display: "flex", gap: 24, fontFamily: "Plex Mono", fontSize: 22, letterSpacing: "0.06em", color: "#6B645B" }}>
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
                <span key={i} style={{ color: pink ? "#FF4D6A" : "#1C1916", marginRight: size * 0.24 }}>
                  {w}
                </span>
              ))}
            </div>
          </div>
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} {...FRAME} alt="" style={{ objectFit: "cover", border: "1px solid #D9D1C4", borderRadius: 2 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cube} width={160} height={160} alt="" />
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Hanken", data: hanken, weight: 500, style: "normal" },
        { name: "Plex Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
