"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CONTACT_HREF, NAV, SITE } from "@/data/site";
import { cn } from "@/lib/cn";
import { Container } from "./Container";
import { Logo } from "./Logo";

const SERVICE_PATHS = ["/creative-production", "/cms-integrations", "/tools-for-better-work"];

function isActive(label: string, pathname: string) {
  if (label === "Notes") return pathname.startsWith("/notes");
  if (label === "Services") return SERVICE_PATHS.includes(pathname);
  return false;
}

function closeMenu() {
  document.getElementById("site-menu")?.hidePopover();
}

function onScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}

export function Nav() {
  const pathname = usePathname();
  const links = NAV.map((l) => ({ ...l, active: isActive(l.label, pathname) }));
  const scrolled = useSyncExternalStore(onScroll, () => window.scrollY > 0, () => false);

  // Sticky rather than fixed: as a direct child of <body> it stays put for the whole
  // page but keeps its space in the flow. The bar reaches half a gutter past the
  // content so the links stay on the page grid once its background shows.
  return (
    <Container className="pointer-events-none sticky top-0 z-40 py-fl-12 lg:py-3">
      <nav
        aria-label="Primary"
        className={cn(
          "grid-12 mono-label pointer-events-auto -mx-[calc(var(--spacing-gutter)/2)] items-center rounded-lg border border-transparent px-[calc(var(--spacing-gutter)/2)] py-fl-16 transition-[background-color,border-color,backdrop-filter] duration-200 motion-reduce:transition-none lg:py-[17px]",
          scrolled && "border-rule-dark/10 bg-paper-light/50 backdrop-blur-md",
        )}
      >
        <Link href="/" className="col-span-6 flex lg:col-span-3" aria-label="Okayplus home">
          <Logo />
        </Link>

        <div className="hidden text-muted xl:col-span-4 xl:block">
          {SITE.author} / {SITE.tagline}
        </div>

        {/* Desktop links */}
        <ul className="hidden justify-end gap-fl-32 lg:col-span-9 lg:flex xl:col-span-5">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={l.active ? "page" : undefined} className={l.active ? "text-pink-ink" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href={CONTACT_HREF} className="text-pink-ink">
              Say hello <span className="nudge">→</span>
            </Link>
          </li>
        </ul>

        {/* Mobile: toggle + anchored popover */}
        <div className="col-span-6 flex justify-end lg:hidden">
          <button type="button" popoverTarget="site-menu" className="menu-toggle mono-label -my-2 cursor-pointer py-2">
            Menu
          </button>
          <div id="site-menu" popover="auto" className="site-menu">
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={closeMenu}
                    aria-current={l.active ? "page" : undefined}
                    className={cn("block py-2.5", l.active && "text-pink-ink")}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-rule pt-2">
                <Link href={CONTACT_HREF} onClick={closeMenu} className="block py-2.5 text-pink-ink">
                  Say hello →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </Container>
  );
}
