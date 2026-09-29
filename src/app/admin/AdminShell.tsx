import type { ReactNode } from "react";
import { Container } from "@/components/Container";
import { getAllDocs } from "@/lib/docs";
import { AdminSidebar } from "./AdminSidebar";

/**
 * An admin page beside the sidebar of tools and docs. Each page wraps itself in this
 * rather than sharing a layout.dev.tsx: a dev-only layout clashes with the production
 * build's route types. Pages bring their own top and bottom padding.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <Container className="grid gap-x-fl-48 gap-y-fl-32 pt-fl-56 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:pt-0">
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:mt-fl-56">
        <AdminSidebar docs={getAllDocs().map((d) => ({ label: d.title, href: `/admin/docs/${d.slug}` }))} />
      </aside>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
