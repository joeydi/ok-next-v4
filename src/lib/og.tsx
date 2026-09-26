import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { cubeMarkSvg } from "./cube-mark";

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

/** `title` may contain *starred* words, rendered in pink. Separate eyebrow parts with two spaces. */
export async function renderOg({ eyebrow, title }: { eyebrow: string; title: string }) {
  const [[hanken, mono], logoSrc] = await Promise.all([fonts, logo]);
  const words = title.split(/(\*.+?\*)/).flatMap((chunk) => {
    const pink = chunk.startsWith("*");
    return chunk
      .replace(/\*/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ w, pink }));
  });
  const size = title.length > 60 ? 64 : title.length > 32 ? 80 : 104;

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
          <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 860 }}>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cube} width={160} height={160} alt="" />
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
