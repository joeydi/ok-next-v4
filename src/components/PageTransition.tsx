"use client";

import { usePathname } from "next/navigation";
import { useEffect, ViewTransition } from "react";

// Where the navigation started, in viewport px: the pointer for a click, the link's
// centre for a keyboard press. Back and forward have none and start from the centre.
let origin: { x: number; y: number } | null = null;

function recordOrigin(e: MouseEvent) {
  const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!link) return;
  if (e.detail === 0) {
    const r = link.getBoundingClientRect();
    origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  } else {
    origin = { x: e.clientX, y: e.clientY };
  }
}

function clearOrigin() {
  origin = null;
}

// Each page snapshot is as big as its element, which usually runs well past the
// viewport and sits wherever its group was captured. Once the transition is ready,
// give each one the start point in its own coordinates, which the `.page` rules in
// globals.css scale and reveal from.
function pinToOrigin(animationName: string) {
  return () => {
    const root = document.documentElement;
    const { x, y } = origin ?? { x: innerWidth / 2, y: innerHeight / 2 };
    // The mask grows until it covers the farthest corner of the screen.
    const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const rules = document
      .getAnimations()
      .filter((a): a is CSSAnimation => a instanceof CSSAnimation && a.animationName === animationName)
      .map((a) => (a.effect as KeyframeEffect).pseudoElement)
      .filter((pseudo) => pseudo != null)
      .map((pseudo) => {
        const name = pseudo.match(/\((.+)\)$/)?.[1];
        const group = new DOMMatrix(getComputedStyle(root, `::view-transition-group(${name})`).transform);
        return `${pseudo} { --reveal-x: ${x - group.m41}px; --reveal-y: ${y - group.m42}px; --reveal-reach: ${reach}px; }`;
      });

    // Both sides of a navigation read the origin in the same frame; forget it after.
    requestAnimationFrame(clearOrigin);

    const style = document.createElement("style");
    style.textContent = rules.join("\n");
    document.head.append(style);
    return () => style.remove();
  };
}

const pinExit = pinToOrigin("page-out");
const pinEnter = pinToOrigin("page-in");

// Keying on the pathname makes every navigation an exit of the old page and an
// enter of the new one, which the `.page` view transition rules in globals.css
// animate. Hash and query changes keep the same key, so they don't animate.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Capture, so the point is recorded before Link's handler starts navigating.
    document.addEventListener("click", recordOrigin, true);
    window.addEventListener("popstate", clearOrigin);
    return () => {
      document.removeEventListener("click", recordOrigin, true);
      window.removeEventListener("popstate", clearOrigin);
    };
  }, []);

  return (
    <ViewTransition key={pathname} enter="page" exit="page" default="none" onExit={pinExit} onEnter={pinEnter}>
      {children}
    </ViewTransition>
  );
}
