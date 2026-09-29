import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { docComponents } from "@/components/docs";
import { cn } from "@/lib/cn";
import { getDoc } from "@/lib/docs";
import { AdminShell } from "../../AdminShell";

// Dev-only (see pageExtensions in next.config.ts): a design doc from src/content/docs,
// beside the admin sidebar. Every doc shares this header and the article grid
// (.note-body with .doc-body in globals.css); its visuals come from src/components/docs.

type Props = { params: Promise<{ doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDoc((await params).doc)?.title ?? "Docs", robots: { index: false, follow: false } };
}

export default async function DocPage({ params }: Props) {
  const { doc } = await params;
  const meta = getDoc(doc);
  if (!meta) notFound();
  const { default: Body } = await import(`@/content/docs/${doc}.mdx`);

  return (
    <AdminShell>
      <article className="pt-fl-56 pb-fl-96">
        <header className="flex flex-col gap-fl-8 border-b border-rule pb-fl-40">
          <span className="mono-label text-muted">/ Docs · dev only</span>
          <h1
            className={cn(
              "display leading-none tracking-heading",
              meta.size === "large" ? "text-fl-96 tracking-display" : "text-fl-60",
            )}
          >
            {meta.title}
            <span className="text-pink">.</span>
          </h1>
          {meta.description && <p className="note-lead mt-fl-16 max-w-[48rem] text-pretty">{meta.description}</p>}
        </header>
        <div className="note-body doc-body pt-fl-48">
          <Body components={docComponents} />
        </div>
      </article>
    </AdminShell>
  );
}
