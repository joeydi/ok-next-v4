import type { Metadata } from "next";
import { SITE } from "@/data/site";

/**
 * The Open Graph fields every page shares. Metadata merges shallowly, so a page that sets `openGraph`
 * (as each does, for its `url`) replaces the layout's whole object and spreads these back in.
 */
export const OPEN_GRAPH = {
  type: "website",
  siteName: SITE.name,
  locale: "en_US",
} satisfies NonNullable<Metadata["openGraph"]>;
