import { readFile } from "node:fs/promises";
import path from "node:path";

// Dev-only (route.dev.ts): serves a design doc from docs/ as it is. Kept under the
// file's own name so the docs' relative links to each other still resolve.

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const { file } = await params;
  if (!/^[a-z0-9-]+\.html$/.test(file)) return new Response("Not found", { status: 404 });
  const html = await readFile(path.join(process.cwd(), "docs", file), "utf8").catch(() => null);
  if (html === null) return new Response("Not found", { status: 404 });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
