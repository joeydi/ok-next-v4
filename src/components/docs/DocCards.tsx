import type { ReactNode } from "react";

/** Short parallel cases side by side, each with a mono label, a Gelica title and a line or two. */
export function DocCards({ children }: { children: ReactNode }) {
  return <div className="doc-wide grid gap-fl-24 md:grid-cols-3">{children}</div>;
}

export function DocCard({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-fl-12 border-t border-rule pt-fl-20">
      <span className="mono-label text-muted">{label}</span>
      <h3 className="display text-fl-30 leading-[1.1] tracking-heading text-ink">{title}</h3>
      <div className="text-fl-18 leading-[1.6] text-pretty text-body">{children}</div>
    </div>
  );
}
