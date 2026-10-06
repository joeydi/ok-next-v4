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
import { ADMIN_NAV, CONTACT_HREF, NAV, SITE } from "@/data/site";
import { cn } from "@/lib/cn";
import { Container } from "./Container";
import { DockLogo } from "./logo/DockLogo";

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

function closeAdmin() {
  document.getElementById("admin-menu")?.hidePopover();
}

// The admin tools only exist under `next dev`; this is inlined, so production drops the menu.
const DEV = process.env.NODE_ENV === "development";

/** Settings cog (Material Symbols, rounded fill), sized to the label text. */
function Cog() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[1.25em]">
      <path
        fill="currentColor"
        d="M10.825 22q-.675 0-1.162-.45t-.588-1.1L8.85 18.8q-.325-.125-.612-.3t-.563-.375l-1.55.65q-.625.275-1.25.05t-.975-.8l-1.175-2.05q-.35-.575-.2-1.225t.675-1.075l1.325-1Q4.5 12.5 4.5 12.337v-.675q0-.162.025-.337l-1.325-1Q2.675 9.9 2.525 9.25t.2-1.225L3.9 5.975q.35-.575.975-.8t1.25.05l1.55.65q.275-.2.575-.375t.6-.3l.225-1.65q.1-.65.588-1.1T10.825 2h2.35q.675 0 1.163.45t.587 1.1l.225 1.65q.325.125.613.3t.562.375l1.55-.65q.625-.275 1.25-.05t.975.8l1.175 2.05q.35.575.2 1.225t-.675 1.075l-1.325 1q.025.175.025.338v.674q0 .163-.05.338l1.325 1q.525.425.675 1.075t-.2 1.225l-1.2 2.05q-.35.575-.975.8t-1.25-.05l-1.5-.65q-.275.2-.575.375t-.6.3l-.225 1.65q-.1.65-.587 1.1t-1.163.45zm1.225-6.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5"
      />
    </svg>
  );
}

/**
 * A desktop dropdown that opens on mouse hover or keyboard focus. Its popover sits inside
 * the trigger's <li> in the DOM, so pointer and focus events treat it as part of the
 * trigger; a short delay carries the pointer across the gap below the bar.
 */
function useHoverMenu() {
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number>(undefined);
  const clicked = useRef(false);

  function open() {
    window.clearTimeout(closeTimer.current);
    const menu = ref.current;
    if (menu && !menu.matches(":popover-open")) menu.showPopover();
  }

  function close() {
    ref.current?.hidePopover();
  }

  // The page transition after a click on a link trigger re-enters it under a still
  // pointer, so hover stays off until the pointer really moves away.
  function clickLink(e: MouseEvent<HTMLAnchorElement>) {
    close();
    clicked.current = true;
    const li = e.currentTarget.parentElement;
    const onMove = (m: globalThis.PointerEvent) => {
      if (li?.contains(m.target as Node)) return;
      clicked.current = false;
      document.removeEventListener("pointermove", onMove);
    };
    document.addEventListener("pointermove", onMove);
  }

  /** Spread on the <li> that holds the trigger and the popover. */
  const item = {
    onPointerEnter(e: PointerEvent) {
      if (e.pointerType === "mouse" && !clicked.current) open();
    },
    onPointerLeave(e: PointerEvent) {
      if (e.pointerType === "mouse") closeTimer.current = window.setTimeout(close, 200);
    },
    // Keyboard focus only, so a tap on a link trigger just follows it.
    onFocus(e: FocusEvent) {
      if (e.target.matches(":focus-visible")) open();
    },
    onBlur(e: FocusEvent) {
      if (!e.currentTarget.contains(e.relatedTarget)) close();
    },
  };

  return { ref, open, close, clickLink, item };
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
  const services = useHoverMenu();
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
  // mouse hover or keyboard focus (see useHoverMenu).
  // Positions the menu where anchor positioning isn't supported (see globals.css).
  function toggleServices(e: ToggleEvent<HTMLDivElement>) {
    if (e.newState === "closed") return;
    const trigger = e.currentTarget.previousElementSibling;
    if (trigger) e.currentTarget.style.setProperty("--trigger-left", `${trigger.getBoundingClientRect().left}px`);
  }

  // Sticky rather than fixed: as a direct child of <body> it stays put for the whole
  // page but keeps its space in the flow. The bar reaches half a gutter past the
  // content so the links stay on the page grid once its background shows. Its view
  // transition name holds it still above the pages as they transition. A flex row,
  // so the links never wrap: they keep their width and the tagline gives way.
  return (
    <Container className="pointer-events-none sticky top-0 z-40 py-fl-12 lg:py-3">
      <nav
        ref={navRef}
        aria-label="Primary"
        className={cn(
          "site-nav mono-label pointer-events-auto flex justify-between gap-fl-24 -mx-[calc(var(--spacing-gutter)/2)] [view-transition-name:site-nav] items-center rounded-lg border border-transparent px-[calc(var(--spacing-gutter)/2)] py-fl-16 transition-[color,background-color,border-color,backdrop-filter] duration-500 ease-in-out-quart motion-reduce:transition-none lg:py-[17px]",
          state === "light" && "border-ink-2/10 bg-paper-light/50 backdrop-blur-md",
          // At the top the bar is bare; give it the menus' glass while one is open.
          state === "top" &&
            "has-[.nav-menu:popover-open]:border-ink-2/10 has-[.nav-menu:popover-open]:bg-paper-light/50 has-[.nav-menu:popover-open]:backdrop-blur-md",
          dark && "border-paper/10 bg-ink/50 text-paper backdrop-blur-md",
        )}
      >
        <Link href="/" className="flex shrink-0" aria-label="Okayplus home">
          <DockLogo />
        </Link>

        <div
          className={cn(
            "hidden min-w-0 truncate transition-colors duration-500 ease-in-out-quart motion-reduce:transition-none xl:block",
            dark ? "text-muted-light" : "text-muted",
          )}
        >
          {SITE.author} / {SITE.tagline}
        </div>

        {/* Desktop links */}
        <ul className="hidden shrink-0 gap-fl-32 whitespace-nowrap lg:flex">
          {links.map((l) =>
            l.children ? (
              <li key={l.href} className="group" {...services.item}>
                <Link
                  href={l.href}
                  onClick={services.clickLink}
                  aria-current={l.current}
                  className={cn("services-trigger block", l.current && accent)}
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
                  ref={services.ref}
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
                          onClick={services.close}
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
                <Link href={l.href} aria-current={l.current} className={cn("block", l.current && accent)}>
                  {l.label}
                </Link>
              </li>
            ),
          )}
          <li>
            <Link href={CONTACT_HREF} aria-current={contactCurrent} className={cn("block", accent)}>
              Say hello <span className="nudge">→</span>
            </Link>
          </li>
          {DEV && <AdminMenu pathname={pathname} dark={dark} accent={accent} menuItem={menuItem} />}
        </ul>

        {/* Mobile: toggle + anchored popover */}
        <div className="flex lg:hidden">
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
              {DEV &&
                ADMIN_NAV.map((a, i) => (
                  <li key={a.href} className={i === 0 ? divider : undefined}>
                    <Link
                      href={a.href}
                      onClick={closeMenu}
                      aria-current={pathname === a.href ? "page" : undefined}
                      className={cn(menuItem, pathname === a.href && accent)}
                    >
                      {a.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </nav>
    </Container>
  );
}

/**
 * Dev only: a cog at the end of the bar with the admin tools, hanging from the bar's right
 * corner. Like "Services", the cog is a link (to the first tool) whose menu opens on hover or focus.
 */
function AdminMenu({
  pathname,
  dark,
  accent,
  menuItem,
}: {
  pathname: string;
  dark: boolean;
  accent: string;
  menuItem: string;
}) {
  const { ref, clickLink, item } = useHoverMenu();
  return (
    <li className="group" {...item}>
      <Link
        href={ADMIN_NAV[0].href}
        onClick={clickLink}
        aria-label="Admin"
        className={cn("-my-2 flex items-center py-2", pathname.startsWith("/admin") && accent)}
      >
        <Cog />
      </Link>
      <div
        ref={ref}
        id="admin-menu"
        popover="auto"
        data-theme={dark ? "dark" : undefined}
        className="nav-menu admin-menu"
      >
        <ul className="flex flex-col">
          {ADMIN_NAV.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                onClick={closeAdmin}
                aria-current={pathname === a.href ? "page" : undefined}
                className={cn(menuItem, pathname === a.href && accent)}
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
