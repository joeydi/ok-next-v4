"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
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
  window.addEventListener("resize", cb);
  return () => {
    window.removeEventListener("scroll", cb);
    window.removeEventListener("resize", cb);
  };
}

type NavState = "top" | "light" | "dark";

/** Transparent at the top of the page; otherwise light or dark to suit whatever sits under the bar's midline. */
function navState(nav: HTMLElement | null): NavState {
  if (window.scrollY <= 0) return "top";
  if (!nav) return "light";
  const { top, height } = nav.getBoundingClientRect();
  const y = top + height / 2;
  for (const el of document.querySelectorAll("[data-nav-theme=dark]")) {
    const r = el.getBoundingClientRect();
    if (r.top <= y && r.bottom > y) return "dark";
  }
  return "light";
}

export function Nav() {
  const pathname = usePathname();
  const links = NAV.map((l) => ({ ...l, active: isActive(l.label, pathname) }));
  const navRef = useRef<HTMLElement>(null);
  const state = useSyncExternalStore(onScroll, () => navState(navRef.current), (): NavState => "top");
  const dark = state === "dark";
  const accent = dark ? "text-pink" : "text-pink-ink";

  // Sticky rather than fixed: as a direct child of <body> it stays put for the whole
  // page but keeps its space in the flow. The bar reaches half a gutter past the
  // content so the links stay on the page grid once its background shows. Its view
  // transition name holds it still above the pages as they transition.
  return (
    <Container className="pointer-events-none sticky top-0 z-40 py-fl-12 lg:py-3">
      <nav
        ref={navRef}
        aria-label="Primary"
        className={cn(
          "grid-12 mono-label pointer-events-auto -mx-[calc(var(--spacing-gutter)/2)] [view-transition-name:site-nav] items-center rounded-lg border border-transparent px-[calc(var(--spacing-gutter)/2)] py-fl-16 transition-[color,background-color,border-color,backdrop-filter] duration-500 ease-in-out-strong motion-reduce:transition-none lg:py-[17px]",
          state === "light" && "border-rule-dark/10 bg-paper-light/50 backdrop-blur-md",
          dark && "border-paper/10 bg-ink/50 text-paper backdrop-blur-md",
        )}
      >
        <Link href="/" className="col-span-6 flex lg:col-span-3" aria-label="Okayplus home">
          <Logo />
        </Link>

        <div className={cn("hidden transition-colors duration-500 ease-in-out-strong motion-reduce:transition-none xl:col-span-4 xl:block", dark ? "text-muted-on-dark" : "text-muted")}>
          {SITE.author} / {SITE.tagline}
        </div>

        {/* Desktop links */}
        <ul className="hidden justify-end gap-fl-32 lg:col-span-9 lg:flex xl:col-span-5">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={l.active ? "page" : undefined} className={l.active ? accent : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href={CONTACT_HREF} className={accent}>
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
