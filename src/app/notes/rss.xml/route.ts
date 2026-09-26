import { SITE } from "@/data/site";
import { getAllNotes } from "@/lib/notes";

export const dynamic = "force-static";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const notes = getAllNotes();
  const items = notes
    .map((n) => {
      const url = `${SITE.url}/notes/${n.slug}`;
      return `    <item>
      <title>${esc(n.plainTitle)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(n.date).toUTCString()}</pubDate>
      <category>${esc(n.tag)}</category>
      <description>${esc(n.description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.name} Notes</title>
    <link>${SITE.url}/notes</link>
    <description>Project write-ups, process notes, and the occasional thing I made for fun.</description>
    <language>en-us</language>
    <atom:link href="${SITE.url}/notes/rss.xml" rel="self" type="application/rss+xml"/>
${notes[0] ? `    <lastBuildDate>${new Date(notes[0].date).toUTCString()}</lastBuildDate>\n` : ""}${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
