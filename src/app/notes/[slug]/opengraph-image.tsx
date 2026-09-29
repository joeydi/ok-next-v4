import { getAllNotes } from "@/lib/notes";
import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "Okayplus note";
export const size = OG_SIZE;
export const contentType = "image/png";

// Prerender one card per note at build time.
export function generateStaticParams() {
  return getAllNotes().map((n) => ({ slug: n.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return ogImage(`/notes/${(await params).slug}`);
}
