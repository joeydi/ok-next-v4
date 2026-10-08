import { audiences, services } from "@/data/catalog";
import { SITE } from "@/data/site";
import { getAllNotes } from "@/lib/notes";

export const dynamic = "force-static";

// An llms.txt (llmstxt.org): a Markdown summary of the site and its pages for language models.
export function GET() {
  const link = (title: string, path: string, description?: string) =>
    `- [${title}](${SITE.url}${path})${description ? `: ${description}` : ""}`;

  const txt = `# ${SITE.name}

> ${SITE.description}

${SITE.author} works directly with each client, from the first call to launch and after. Get in touch at ${SITE.email} or book a call at ${SITE.bookingUrl}.

## Services

${Object.values(services)
  .map((s) => link(s.title, `/${s.slug}`, s.metaDescription))
  .join("\n")}

## Who I work with

${Object.values(audiences)
  .map((a) => link(a.title, `/${a.slug}`, a.metaDescription))
  .join("\n")}

## Notes

${link("All notes", "/notes", "Project write-ups, process notes, and the occasional thing I made for fun.")}
${getAllNotes()
  .map((n) => link(n.plainTitle, `/notes/${n.slug}`, n.description || undefined))
  .join("\n")}

## Optional

${link("Notes RSS feed", "/notes/rss.xml")}
`;
  return new Response(txt, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
