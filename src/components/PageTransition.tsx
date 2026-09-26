"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

// The old page's snapshots are as tall as its elements, which usually run well
// past the viewport, so `transform-origin: bottom` would stretch it from somewhere
// offscreen. Once the transition is ready, pin each old snapshot's origin to the
// bottom of the screen instead, based on where its group was captured.
function anchorExitToViewportBottom() {
  const root = document.documentElement;
  const rules = document
    .getAnimations()
    .filter((a): a is CSSAnimation => a instanceof CSSAnimation && a.animationName === "page-out")
    .map((a) => (a.effect as KeyframeEffect).pseudoElement?.match(/^::view-transition-old\((.+)\)$/)?.[1])
    .filter((name) => name !== undefined)
    .map((name) => {
      const top = new DOMMatrix(getComputedStyle(root, `::view-transition-group(${name})`).transform).m42;
      return `::view-transition-old(${name}) { transform-origin: 50% ${innerHeight - top}px; }`;
    });

  const style = document.createElement("style");
  style.textContent = rules.join("\n");
  document.head.append(style);
  return () => style.remove();
}

// Keying on the pathname makes every navigation an exit of the old page and an
// enter of the new one, which the `.page` view transition rules in globals.css
// animate. Hash and query changes keep the same key, so they don't animate.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ViewTransition key={pathname} enter="page" exit="page" default="none" onExit={anchorExitToViewportBottom}>
      {children}
    </ViewTransition>
  );
}
