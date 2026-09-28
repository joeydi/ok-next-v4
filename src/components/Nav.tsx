"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ToggleEvent,
  useRef,
  useSyncExternalStore,
} from "react";
import { CONTACT_HREF, NAV, SITE } from "@/data/site";
import { cn } from "@/lib/cn";
import { Container } from "./Container";
import { Logo } from "./Logo";

/** Home sections the nav links to, in page order. */
const SECTIONS = ["approach", "services", "about", "contact"];

/** The home section being read: the last one whose top has passed 40% down the viewport (or the last one once the page bottoms out). */
function currentSection(): string | null {
  const line = window.innerHeight * 0.4;
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;
  let current: string | null = null;
  for (const id of SECTIONS) {
    const el = document.getElementById(id);
    if (el && (atBottom || el.getBoundingClientRect().top <= line)) current = id;
  }
  return current;
}

/** "page" for the route a link leads to, "location" for the home section scrolled into view. */
function current(href: string, pathname: string, section: string | null): "page" | "location" | undefined {
  if (href === "/notes") return pathname.startsWith("/notes") ? "page" : undefined;
  if (pathname === "/" && href === `/#${section}`) return "location";
  return undefined;
}

function closeMenu() {
  document.getElementById("site-menu")?.hidePopover();
}

function closeServices() {
  document.getElementById("services-menu")?.hidePopover();
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
  const navRef = useRef<HTMLElement>(null);
  const state = useSyncExternalStore(
    onScroll,
    () => navState(navRef.current),
    (): NavState => "top",
  );
  const section = useSyncExternalStore(onScroll, currentSection, () => null);
  // A parent is the current page while one of its children is.
  const links = NAV.map((l) => ({
    ...l,
    current: l.children?.some((c) => c.href === pathname) ? ("page" as const) : current(l.href, pathname, section),
  }));
  const contactCurrent = current(CONTACT_HREF, pathname, section);
  const dark = state === "dark";
  const servicesRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number>(undefined);
  const clicked = useRef(false);
  const accent = dark ? "text-pink" : "text-pink-ink";
  // Menu items bleed into the menu's padding so the hover fill sits around the text, which stays put.
  const menuItem = cn(
    "-mx-2.5 block rounded-md px-2.5 py-2.5 transition-colors duration-200 motion-reduce:transition-none",
    dark ? "hover:bg-paper/10" : "hover:bg-ink/5",
  );
  const divider = cn(
    "mt-2 border-t pt-2 transition-colors duration-500 ease-in-out-quart motion-reduce:transition-none",
    dark ? "border-paper/10" : "border-rule/50",
  );

  // "Services" stays a link to the home section; its menu of service pages opens on
  // mouse hover or keyboard focus. The menu sits inside the <li> in the DOM, so pointer
  // and focus events treat it as part of the link; a short delay carries the pointer
  // across the gap below the bar.
  function openServices() {
    window.clearTimeout(closeTimer.current);
    const menu = servicesRef.current;
    if (menu && !menu.matches(":popover-open")) menu.showPopover();
  }

  function hoverServices(e: PointerEvent) {
    if (e.pointerType === "mouse" && !clicked.current) openServices();
  }

  // The page transition after a click re-enters the link under a still pointer, so hover
  // stays off until the pointer really moves away.
  function clickServices(e: MouseEvent<HTMLAnchorElement>) {
    closeServices();
    clicked.current = true;
    const li = e.currentTarget.parentElement;
    const onMove = (m: globalThis.PointerEvent) => {
      if (li?.contains(m.target as Node)) return;
      clicked.current = false;
      document.removeEventListener("pointermove", onMove);
    };
    document.addEventListener("pointermove", onMove);
  }

  function leaveServices(e: PointerEvent) {
    if (e.pointerType === "mouse") closeTimer.current = window.setTimeout(closeServices, 200);
  }

  // Keyboard focus only, so a tap on the link just follows it.
  function focusServices(e: FocusEvent) {
    if (e.target.matches(":focus-visible")) openServices();
  }

  function blurServices(e: FocusEvent) {
    if (!e.currentTarget.contains(e.relatedTarget)) closeServices();
  }

  // Positions the menu where anchor positioning isn't supported (see globals.css).
  function toggleServices(e: ToggleEvent<HTMLDivElement>) {
    if (e.newState === "closed") return;
    const trigger = e.currentTarget.previousElementSibling;
    if (trigger) e.currentTarget.style.setProperty("--trigger-left", `${trigger.getBoundingClientRect().left}px`);
  }

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
          "site-nav grid-12 mono-label pointer-events-auto -mx-[calc(var(--spacing-gutter)/2)] [view-transition-name:site-nav] items-center rounded-lg border border-transparent px-[calc(var(--spacing-gutter)/2)] py-fl-16 transition-[color,background-color,border-color,backdrop-filter] duration-500 ease-in-out-quart motion-reduce:transition-none lg:py-[17px]",
          state === "light" && "border-ink-2/10 bg-paper-light/50 backdrop-blur-md",
          // At the top the bar is bare; give it the menus' glass while one is open.
          state === "top" &&
            "has-[.nav-menu:popover-open]:border-ink-2/10 has-[.nav-menu:popover-open]:bg-paper-light/50 has-[.nav-menu:popover-open]:backdrop-blur-md",
          dark && "border-paper/10 bg-ink/50 text-paper backdrop-blur-md",
        )}
      >
        <Link href="/" className="col-span-6 flex justify-self-start lg:col-span-3" aria-label="Okayplus home">
          <Logo />
        </Link>

        <div
          className={cn(
            "hidden transition-colors duration-500 ease-in-out-quart motion-reduce:transition-none xl:col-span-4 xl:block",
            dark ? "text-muted-light" : "text-muted",
          )}
        >
          {SITE.author} / {SITE.tagline}
        </div>

        {/* Desktop links */}
        <ul className="hidden justify-end gap-fl-32 lg:col-span-9 lg:flex xl:col-span-5">
          {links.map((l) =>
            l.children ? (
              <li
                key={l.href}
                className="group"
                onPointerEnter={hoverServices}
                onPointerLeave={leaveServices}
                onFocus={focusServices}
                onBlur={blurServices}
              >
                <Link
                  href={l.href}
                  onClick={clickServices}
                  aria-current={l.current}
                  className={cn("services-trigger", l.current && accent)}
                >
                  {l.label}{" "}
                  <span
                    aria-hidden
                    className="inline-block [view-transition-name:nav-caret] transition-transform duration-350 ease-in-out-quart group-has-[:popover-open]:rotate-180 motion-reduce:transition-none"
                  >
                    ↓
                  </span>
                </Link>
                <div
                  ref={servicesRef}
                  id="services-menu"
                  popover="auto"
                  data-theme={dark ? "dark" : undefined}
                  className="nav-menu services-menu"
                  onBeforeToggle={toggleServices}
                >
                  <ul className="flex flex-col">
                    {l.children.map((s) => (
                      <li key={s.href}>
                        <Link
                          href={s.href}
                          onClick={closeServices}
                          aria-current={pathname === s.href ? "page" : undefined}
                          className={cn(menuItem, pathname === s.href && accent)}
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ) : (
              <li key={l.href}>
                <Link href={l.href} aria-current={l.current} className={l.current ? accent : undefined}>
                  {l.label}
                </Link>
              </li>
            ),
          )}
          <li>
            <Link href={CONTACT_HREF} aria-current={contactCurrent} className={accent}>
              Say hello <span className="nudge">→</span>
            </Link>
          </li>
        </ul>

        {/* Mobile: toggle + anchored popover */}
        <div className="col-span-6 flex justify-end lg:hidden">
          <button type="button" popoverTarget="site-menu" className="mono-label -my-2 cursor-pointer py-2">
            Menu
          </button>
          <div id="site-menu" popover="auto" data-theme={dark ? "dark" : undefined} className="nav-menu site-menu">
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={closeMenu}
                    aria-current={l.current}
                    className={cn(menuItem, l.current && accent)}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className={divider}>
                <Link
                  href={CONTACT_HREF}
                  onClick={closeMenu}
                  aria-current={contactCurrent}
                  className={cn(menuItem, accent)}
                >
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
