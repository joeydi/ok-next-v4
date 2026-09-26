"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

// Keying on the pathname makes every navigation an exit of the old page and an
// enter of the new one, which the `.page` view transition rules in globals.css
// animate. Hash and query changes keep the same key, so they don't animate.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ViewTransition key={pathname} enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
