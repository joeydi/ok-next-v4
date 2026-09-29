import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  // page.dev.tsx / route.dev.ts (the /admin tools) only exist under `next dev`,
  // so they never ship in a production build.
  pageExtensions: [...(phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", "dev.ts"] : []), "ts", "tsx", "md", "mdx"],
  // Paper.js (/network) only runs in the browser, but bundling it for the server
  // follows its Node-only requires (jsdom, canvas), which aren't installed.
  serverExternalPackages: ["paper"],
  // URLs from the previous site. Its old blog posts lived at the root and weren't
  // carried over, so they're left to 404. `:path*` also matches the bare path,
  // and the first matching rule wins, so specific case studies come first.
  redirects: async () => [
    { source: "/services", destination: "/#services", permanent: true },
    { source: "/contact", destination: "/#contact", permanent: true },
    { source: "/blog/:path*", destination: "/notes", permanent: true },
    { source: "/work/columbia-capital", destination: "/notes/columbia-capital", permanent: true },
    { source: "/work/expect-more-arizona", destination: "/notes/arizona-education-progress-meter", permanent: true },
    { source: "/work/:path*", destination: "/notes", permanent: true },
  ],
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
