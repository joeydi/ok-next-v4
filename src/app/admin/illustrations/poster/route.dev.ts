import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { POSTER_WIDTHS, posterPath, type PosterFormat } from "@/components/illustrations/gl/poster";
import { SCENES } from "@/components/illustrations/gl/scenes";

// Dev-only (route.dev.ts): takes a scene's poster frame as a PNG from the lab
// and writes the AVIF/WebP sizes GLIllustration serves into public/.

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const scene = new URL(request.url).searchParams.get("scene") ?? "";
  if (!(scene in SCENES)) return Response.json({ error: `Unknown scene "${scene}"` }, { status: 400 });

  const png = Buffer.from(await request.arrayBuffer());
  const written: { file: string; bytes: number }[] = [];
  for (const width of POSTER_WIDTHS)
    for (const format of ["avif", "webp"] as PosterFormat[]) {
      const file = posterPath(scene, width, format);
      const img = sharp(png).resize(width);
      const out = format === "avif" ? img.avif({ quality: 60 }) : img.webp({ quality: 82, alphaQuality: 90 });
      const dest = path.join(process.cwd(), "public", file);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const { size } = await out.toFile(dest);
      written.push({ file, bytes: size });
    }
  return Response.json({ written });
}
