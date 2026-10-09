import Link from "next/link";
import type { CareClient } from "@/data/care";
import { cn } from "@/lib/cn";

const card = "frame bg-clip-padding border border-rule/50 bg-linear-to-b from-paper-light to-paper-raised";

/** Long-term clients, a card each with the year they started, linking to a case study when there is one. On the website care and non-profits pages. */
export function ClientCards({ items, className }: { items: readonly CareClient[]; className?: string }) {
  return (
    <ul className={cn("grid gap-fl-24 lg:grid-cols-3", className)}>
      {items.map((client) => {
        const body = (
          <>
            <div className="mono-label text-muted">{client.place}</div>
            <h3 className="display mt-fl-40 flex-1 text-fl-36 leading-heading-36 tracking-display-36">
              <span className={cn(client.href && "hover-title")}>{client.name}</span>
            </h3>
            <div className="mono-label flex justify-between gap-fl-16 border-t border-rule pt-fl-18">
              <span className="text-body">Since {client.since}</span>
              {client.href && (
                <span className="text-pink-ink">
                  Case study <span className="nudge">→</span>
                </span>
              )}
            </div>
          </>
        );
        const className = cn(card, "flex h-full flex-col gap-fl-18 px-fl-32 pt-fl-28 pb-fl-32");
        return (
          <li key={client.name}>
            {client.href ? (
              <Link href={client.href} className={cn(className, "hover-card hover-lift")}>
                {body}
              </Link>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
