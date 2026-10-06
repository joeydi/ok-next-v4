import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import codeTheme from "./src/lib/code-theme.json";

// Hardening headers for production builds; `next dev` skips them, since the admin
// tools frame the site's own pages and upload straight to R2. Scripts and styles
// allow 'unsafe-inline' because every page is static, so there's no per-request
// nonce. Typekit serves Gelica, the media host serves images and video, Calendly
// is framed by BookingLink, and preview builds also load the Vercel toolbar.
const media = `https://${process.env.NEXT_PUBLIC_MEDIA_HOST}`;
const toolbar = process.env.VERCEL_ENV === "preview" ? "https://vercel.live" : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${toolbar}`,
  `style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net ${toolbar}`,
  `font-src 'self' data: https://use.typekit.net ${toolbar && "https://assets.vercel.com"}`,
  `img-src 'self' data: blob: ${media} ${toolbar && "https://vercel.live https://vercel.com"}`,
  `media-src 'self' ${media}`,
  `connect-src 'self' ${toolbar && "https://vercel.live wss://ws-us3.pusher.com"}`,
  `frame-src https://calendly.com ${toolbar}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .map((d) => d.trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig = (phase: string): NextConfig => ({
  // page.dev.tsx / route.dev.ts (the /admin tools) only exist under `next dev`,
  // so they never ship in a production build.
  pageExtensions: [...(phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", "dev.ts"] : []), "ts", "tsx", "md", "mdx"],
  headers: async () => (phase === PHASE_DEVELOPMENT_SERVER ? [] : [{ source: "/:path*", headers: securityHeaders }]),
  // Next ships polyfills for Array.prototype.at, Object.hasOwn and the like to every
  // browser, though its own targets (Chrome/Edge/Firefox 111, Safari 16.4) have them
  // all, bar URL.canParse on Safari 16, which only its dev client calls. Swap the
  // module for an empty one; both specifiers are how Next's client imports it.
  turbopack: {
    resolveAlias: {
      "../build/polyfills/polyfill-module": "./src/lib/no-polyfills.js",
      "next/dist/build/polyfills/polyfill-module": "./src/lib/no-polyfills.js",
    },
  },
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

// Plugins are passed by name so they work under Turbopack, which also means their
// options must be plain data: no functions, so no Shiki transformers. A local
// plugin goes in by absolute path, since names resolve from each MDX file's folder.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-pretty-code", { theme: codeTheme, keepBackground: false }],
      fileURLToPath(new URL("./src/lib/rehype-terminal.mjs", import.meta.url)),
    ],
  },
});

const config = (phase: string) => withMDX(nextConfig(phase));

export default config;
