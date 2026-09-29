import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ADMIN_DOCS } from "@/data/site";
import { AdminShell } from "../../AdminShell";

// Dev-only (see pageExtensions in next.config.ts): a design doc from docs/ beside the
// admin sidebar, in a frame since each doc is a standalone page with its own styles.

type Props = { params: Promise<{ doc: string }> };

const find = (doc: string) => ADMIN_DOCS.find((d) => d.href === `/admin/docs/${doc}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: find((await params).doc)?.label ?? "Docs", robots: { index: false, follow: false } };
}

export default async function DocPage({ params }: Props) {
  const { doc } = await params;
  const entry = find(doc);
  if (!entry) notFound();
  return (
    <AdminShell>
      <div className="pt-fl-56 pb-fl-24">
        <iframe
          src={`/admin/docs/raw/${doc}.html`}
          title={entry.label}
          className="h-[calc(100svh-var(--nav-h)-var(--spacing-fl-56)-var(--spacing-fl-24))] w-full rounded-lg border border-rule"
        />
      </div>
    </AdminShell>
  );
}
