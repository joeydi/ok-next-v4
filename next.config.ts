import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  // page.dev.tsx / route.dev.ts (the /admin tools) only exist under `next dev`,
  // so they never ship in a production build.
  pageExtensions: [...(phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", "dev.ts"] : []), "ts", "tsx", "md", "mdx"],
});

// Plugins are passed by name so they work under Turbopack.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

const config = (phase: string) => withMDX(nextConfig(phase));

export default config;
