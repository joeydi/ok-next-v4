"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, type NavLink } from "@/data/site";
import { cn } from "@/lib/cn";

/**
 * The admin tools and design docs, in the nav dropdowns' glass (see .nav-menu in
 * globals.css) with more room. Sticky beside the page from lg; above it before that.
 * Like the nav, its view transition name holds it still above the pages as they change.
 * `docs` comes from src/content/docs (see src/lib/docs.ts), read on the server.
 */
export function AdminSidebar({ docs }: { docs: readonly NavLink[] }) {
  const pathname = usePathname();
  const groups = [
    { label: "Tools", links: ADMIN_NAV },
    { label: "Docs", links: docs },
  ];
  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Admin"
      className="grid grid-cols-2 [view-transition-name:admin-sidebar] gap-x-fl-32 gap-y-5 rounded-lg border border-ink-2/10 bg-paper-light/50 px-6 py-5 font-mono text-sm tracking-label uppercase backdrop-blur-md lg:w-56 lg:grid-cols-1"
    >
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <h2 className="mono-label text-muted">{g.label}</h2>
          <ul className="flex flex-col">
            {g.links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={current(l.href) ? "page" : undefined}
                  className={cn(
                    "-mx-2.5 block rounded-md px-2.5 py-2.5 transition-colors duration-200 hover:bg-ink/5 motion-reduce:transition-none",
                    current(l.href) && "text-pink-ink",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
