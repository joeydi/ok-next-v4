import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { preload } from "react-dom";
import { CommandMenu } from "@/components/CommandMenu";
import { Nav } from "@/components/Nav";
import { PageTransition } from "@/components/PageTransition";
import { SITE } from "@/data/site";
import { JsonLd, siteGraph } from "@/lib/jsonld";
import { OPEN_GRAPH } from "@/lib/metadata";
import { commandGroups } from "@/lib/routes";
import "./globals.css";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  // Only 500 is loaded, so every mono run renders at 500 whatever weight it asks for.
  weight: "500",
  // Plex Mono has no "→"; let it fall through to the system monospace like the design does.
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

const TYPEKIT_CSS = "https://use.typekit.net/llb6krb.css";

// Preview builds resolve OG images against their own deployment; production (and local) use the real domain.
const previewHost = process.env.VERCEL_ENV === "preview" && (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);

export const metadata: Metadata = {
  metadataBase: new URL(previewHost ? `https://${previewHost}` : SITE.url),
  title: {
    default: `${SITE.name} — Design and development by ${SITE.author}, Burlington, VT`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  authors: [{ name: SITE.author, url: SITE.url }],
  openGraph: OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
  alternates: {
    types: { "application/rss+xml": [{ url: "/notes/rss.xml", title: `${SITE.name} Notes` }] },
  },
};

export const viewport: Viewport = {
  themeColor: "#F0E9E5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  preload(TYPEKIT_CSS, { as: "style" });
  return (
    <html lang="en" className={`${hanken.variable} ${plexMono.variable}`}>
      <head>
        {/* Gelica (display) — Adobe Fonts kit. Add each live domain to the kit. The kit's
            CSS is fetched early by the preload but attached by script, so it never blocks
            first paint; headings show in the Georgia fallback until it arrives. */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input
          dangerouslySetInnerHTML={{
            __html: `{const l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(TYPEKIT_CSS)};document.head.appendChild(l)}`,
          }}
        />
        <noscript>
          <link rel="stylesheet" href={TYPEKIT_CSS} />
        </noscript>
      </head>
      <body>
        <a
          href="#main"
          className="mono-label sr-only z-50 bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <Nav />
        {/* Each page renders its own <main id="main"> followed by its footer variant. */}
        <PageTransition>{children}</PageTransition>
        <CommandMenu groups={commandGroups()} />
        <JsonLd data={siteGraph()} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
