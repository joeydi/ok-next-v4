# okaypl.us

The Okayplus site: Joe di Stefano, designer + developer, Burlington, Vermont.

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · MDX · WebGL2 · Cloudflare R2 · Vercel

Every route is statically generated, including the social cards and the RSS feed. The admin tools exist only under `next dev` and never ship.

## Getting started

Requires Node 22+. `ffmpeg` is needed only for media work (`brew install ffmpeg`).

```bash
echo "NEXT_PUBLIC_MEDIA_HOST=media.okaypl.us" > .env.local
npm install
npm run dev      # http://localhost:3000
```

`NEXT_PUBLIC_MEDIA_HOST` is the only variable needed to run or build the site. Media URLs are built from it, and pages with media fail without it. `media.json` is committed, so nothing else touches the bucket. The media admin and `npm run media` need the R2 and Anthropic keys too (see [One-time setup](#one-time-setup)).

### Commands

```bash
npm run dev      # dev server, including the /admin tools
npm run build    # production build: type-checks, validates note frontmatter and media keys, prerenders every route
npm run start    # serve the production build
npm run lint     # Biome lint
npm run format   # Biome: format and sort imports (writes)
npm run check    # lint, format and imports together, without writing
npm run media    # sync src/data/media.json with the R2 bucket (see Media)
node scripts/fluid.mjs   # regenerate src/app/fluid.css after changing the fluid scale
```

There is no test suite. `npm run check` and `npm run build` are the gates.

## Project layout

```
src/
  app/                    routes, globals.css (tokens), fluid.css (generated)
    page.tsx              home
    digital-production/   service pages, one folder each, rendered by ServicePage
    cms-integrations/
    business-tools/
    notes/                index, [slug] post page, rss.xml
    admin/                dev-only media admin and illustration lab (*.dev.tsx)
    */opengraph-image.tsx social cards, built on src/lib/og.tsx
  components/             shared UI; illustrations/ holds the WebGL renderer and scenes
  content/notes/          notes and case studies (MDX)
  data/                   site constants, page copy, media.json
  lib/                    notes loader, media lookups, OG card, helpers
  mdx-components.tsx      components available in every note
scripts/
  fluid.mjs               writes src/app/fluid.css
  media.mjs               R2 sync, video encoding, manifest
public/illustrations/     illustration posters (saved from the lab)
docs/                     standalone design reference pages
design_handoff_okayplus_site/   the original design handoff and 1440px comps
```

## Editing copy

- **Site constants** (`src/data/site.ts`): name, email, booking link, description and the nav.
- **Service pages** (`src/data/services.ts`): all copy for the three service pages, plus the homepage service cards built from them. Words wrapped in `*asterisks*` in an `h1` line render pink.
- **Home** (`src/data/home.ts`): the approach principles and testimonials, which the service pages also quote. The hero and about copy is inline in `src/app/page.tsx`. The contact block shared by every page is in `src/components/Footer.tsx`, and each service page adds its own `contactNote`.

## Writing notes

Notes (blog posts and case studies) are MDX files in `src/content/notes/`. The filename is the URL slug. Frontmatter is validated at build time (`src/lib/notes.ts`): a missing `title`, `date` or `tag`, an unknown tag or an unknown image key fails the build.

```mdx
---
title: Designing a Website That Feels Alive While Keeping Content Front and *Center* # *words* render pink on the post page
description: One or two sentences for the index, RSS and social cards.
date: 2026-05-19
tag: PROCESS # CASE STUDY | PROCESS | VERMONT | COMMUNITY
topic: Interaction design # optional label beside the date (defaults to tag)
featured: true # optional — the one post shown large on /notes
image: notes/foo/hero.jpg # optional — media key (see Media); striped placeholder until set
imageLabel: image — Simple Creature homepage
byline: Co-Founder, Simple Creature # optional (default "Designer + developer")
tools: [CSS 3D transforms, GSAP ScrollTrigger]
# Case studies can also set:
client: Columbia Capital
role: Design + development
year: 2025
link: https://colcap.com
draft: true # optional — shows in dev, hidden from production builds
---

<Lead>Opening paragraph in Gelica.</Lead>

Regular **markdown** paragraphs sit in the centre column.

<Figure label="video — client constellation" caption="01 / Client constellation" dark />
<Figure layout="half" media="notes/foo/scroll.mp4" caption="02 / Scroll reveal" />
<Figure layout="half" media="notes/foo/about.jpg" caption="03 / About page scene" />

<TocAnchor label="04 / Services pathway" />

<PullQuote>Projects like this are a balancing act between *experimentation and usability.*</PullQuote>
```

- `## headings` build the "In this post" list. A note with no headings lists its numbered figure captions (`01 / …`) and `<TocAnchor>` labels instead.
- `Figure` layouts: `wide` (default, columns 2–12), `full`, `half` (put two in a row). Without `media`, a figure shows a striped placeholder with its `label`.
- `Figure media` takes the alt text (and, without a `caption` prop, the caption) from the manifest; `alt="…"` overrides it.
- Relative links (`/…`, `#…`) use client-side navigation. Other links open in a new tab.
- Notes appear in the index, the sitemap and the RSS feed at `/notes/rss.xml`. Each gets a generated social card.

## Media

Images and videos live in a Cloudflare R2 bucket, not in the repo. `src/data/media.json` describes every object in it (dimensions, blur placeholder, video poster, alt text, caption) and is committed, so builds never touch the bucket. Components take a **media key** (the object's path in the bucket, e.g. `notes/thinkmd/hero.jpg`); an unknown key fails the build.

- **Images** go through `next/image` with a Cloudflare Image Transformations loader (`/cdn-cgi/image/width=…,format=auto/`), so each breakpoint gets a resized AVIF/WebP.
- **Videos** without sound loop silently while on screen, like animated images; videos with sound get controls. Under `prefers-reduced-motion` all videos show their poster with controls.
- **Video encoding:** upload whatever you have (MOV, MP4, WebM, any size). Sync re-encodes it with `VIDEO_PRESET` in `scripts/media.mjs`: H.264 High, max 1920px wide (never upscaled), max 30fps, CRF 23, faststart, metadata stripped. The upload is kept at `_originals/<key>` and replaced by `<key>.mp4`, so reference the `.mp4` key. Silent audio tracks are dropped. Real sound is kept until you choose **Keep sound** or **Remove sound** in the admin (the **Sound?** filter lists these). To change the preset, edit it and bump `version`. The next `npm run media` re-encodes every video from its original, and `-- --reencode` forces a re-encode.
- **Workflow:** run `npm run dev` and open [localhost:3000/admin/media](http://localhost:3000/admin/media). Upload into a folder, write or generate alt text, save, and commit `media.json`. Or put files in the bucket some other way and run `npm run media` (`-- <key>…` for specific files, `--force` to re-read everything).
- The admin page only exists under `next dev` (its files are `*.dev.tsx`, see `pageExtensions` in `next.config.ts`). "Generate alt text" sends the image, your context notes, and the titles of the notes that use it to Claude. The draft is saved as unreviewed until you save/approve it. An empty alt that you've saved means decorative.
- Key names: `home/…`, `notes/<slug>/…`, `services/<slug>/…`. The upload folder field suggests these. To fix a key later, use **Move / rename** in the detail panel. It moves the file (plus its poster and original) in the bucket and rewrites references in notes and data files. A trailing `/` keeps the file name.
- **Replace / delete:** objects are cached for a year, so **Replace** in the detail panel never overwrites a key. It uploads the new file next to the old one as `<name>-v2.<ext>` (then `-v3`, …; the format can change). It carries over the alt text, caption and sound choice, flagged for review. Then it rewrites references and deletes the old file, poster and original. **Delete** removes the file, poster and original. If source still references the key, the build fails until you remove the references, and the admin lists them.

### One-time setup

1. In Cloudflare, create an R2 bucket (e.g. `okayplus-media`). Under **Settings → Custom Domains**, connect `media.okaypl.us`. This needs the okaypl.us zone on Cloudflare.
2. On the zone, enable **Images → Transformations**.
3. Create an R2 API token (**Object Read & Write**, limited to the bucket).
4. Add a CORS policy to the bucket so the admin can upload from the browser:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type", "cache-control"]
     }
   ]
   ```
5. `.env.local`:
   ```bash
   R2_ACCOUNT_ID=…
   R2_ACCESS_KEY_ID=…
   R2_SECRET_ACCESS_KEY=…
   R2_BUCKET=okayplus-media
   NEXT_PUBLIC_MEDIA_HOST=media.okaypl.us
   ANTHROPIC_API_KEY=…      # for alt text drafts
   ```
6. In Vercel, set `NEXT_PUBLIC_MEDIA_HOST` only. The build reads everything else from `media.json`.

## Illustrations

The isometric block illustrations in each hero are small WebGL2 scenes in `src/components/illustrations/gl/`: the puzzle cube on the home page, bounce-row, conveyor and ring on the service pages. Each scene (`scenes/*.ts`) is a `frame(t)` function that returns the boxes and balls at time `t`. A small renderer draws them with soft shadows and ambient occlusion.

- The server renders a **poster** (the scene's `posterTime` frame, from `public/illustrations/`) so something shows at once. WebGL starts once the page is idle and the illustration is near the viewport, and stops off screen. Under `prefers-reduced-motion`, or without WebGL2, the poster stays.
- The puzzle cube is interactive: it defines `play()` and a `hitArea`, so on the page you can drag its slices. Posters and the lab still use `frame(t)`.
- **Lab:** [localhost:3000/admin/illustrations](http://localhost:3000/admin/illustrations) (dev only) shows each scene with a time scrubber, width presets and the lighting controls. **Copy settings** copies the current lighting to paste into `DEFAULT_SETTINGS` in `gl/renderer.ts`. **Save poster** writes the scene's AVIF/WebP posters into `public/illustrations/`.
- After changing a scene or `DEFAULT_SETTINGS`, re-save the affected posters in the lab and commit them.

## Styling

- **Tokens** (`src/app/globals.css`): colours (`--color-*`), easing curves (`--ease-*`), fonts, shared utilities (`px-page`, `grid-12`, `mono-label`, `display`, `stripes`, `nudge`) and the hover treatment (`hover-card`, `hover-title`, `hover-lift`).
- **Fluid scale:** `text-fl-*` and `*-fl-*` spacing tokens scale linearly from 320px to 1920px and hit the design's exact px at 1440. They're generated into `src/app/fluid.css` by `scripts/fluid.mjs`. Edit the script and re-run it; don't edit the CSS.
- **Page width:** page-level blocks go in `<Container>`, which adds the gutter and caps the width at 1920px. For widths taken from the comp as a share of the viewport, use `calc(N*var(--pvw))` rather than `vw`, so they stop growing at the cap.
- **Fonts:** Gelica (display) comes from the Adobe Fonts kit `llb6krb`. Hanken Grotesk and IBM Plex Mono come from `next/font`. Social cards set titles in Hanken Grotesk, because Gelica's licence doesn't allow embedding it server-side.
- **Page transitions:** `PageTransition` wraps each page in a React `<ViewTransition>`. The next page is revealed through a mask that grows from the click point, using the `.page` rules in `globals.css`.

## Linting and formatting

[Biome](https://biomejs.dev) lints, formats and sorts imports for TS, JS, JSON and CSS (`biome.json`). The lint includes the React Compiler rule (`useReactCompiler`), so components must follow the Rules of React. Markdown, MDX and HTML are formatted with Prettier in the editor only.

`.vscode/settings.json` sets these formatters and organises imports on save. Install the Biome and Prettier extensions.

## Design references

The original design handoff is in `design_handoff_okayplus_site/`, with 1440px comps in `screenshots/`. Two service pages have been renamed since the handoff: `creative-production` is now `digital-production`, and `tools-for-better-work` is now `business-tools`.

Standalone pages in `docs/` explain parts of the design system. Open them in a browser; they don't need the dev server.

- [Palette](docs/palette.html): every `--color-*` token with its HSL position and contrast against paper and ink.
- [Easing curves](docs/easing-curves.html): the five easing tokens (`--ease-*`), with where each one is used.
- [Page reveal](docs/page-reveal.html): how the page transition reveals the next page from the click point, with a playable preview and every animation's timing and easing on one timeline.

They copy their values from `src/app/globals.css` by hand, so update them when the tokens, curves or transition timings change.

## Deployment

Vercel runs `npm run build`. Only `NEXT_PUBLIC_MEDIA_HOST` needs setting there. Preview deployments build their social card URLs from their own deployment URL; production uses `https://okaypl.us`. Vercel Web Analytics and Speed Insights are included in the root layout.

## Before launch

- Add `okaypl.us` (and the Vercel preview domain) to the Adobe Fonts kit `llb6krb`, or Gelica won't load.
- Replace the last striped placeholder: the River video in `src/content/notes/poetry-in-motion.mdx`.
- Check note dates and bodies in `src/content/notes/`.
- Set `NEXT_PUBLIC_MEDIA_HOST` in the Vercel project (see Media).
- Enable Web Analytics and Speed Insights in the Vercel project.
