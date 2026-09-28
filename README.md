# okaypl.us

The Okayplus site: Joe di Stefano, designer + developer, Burlington, Vermont.

Next.js 16 · React 19 · Tailwind CSS v4 · MDX · Vercel

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static build; every route is prerendered
npm run lint
node scripts/fluid.mjs   # regenerate src/app/fluid.css after changing the scale
npm run media            # sync src/data/media.json with the R2 bucket (see Media)
```

## Writing notes

Notes (blog posts and case studies) are MDX files in `src/content/notes/`. The filename is the URL slug.

```mdx
---
title: Designing a Website That Feels Alive While Keeping Content Front and *Center*   # *words* render pink on the post page
description: One or two sentences for the index, RSS and social cards.
date: 2026-05-19
tag: PROCESS                  # CASE STUDY | PROCESS | VERMONT | COMMUNITY
topic: Interaction design     # optional label beside the date (defaults to tag)
featured: true                # optional — the one post shown large on /notes
image: notes/foo/hero.jpg     # optional — media key (see Media); striped placeholder until set
imageLabel: image — Simple Creature homepage
byline: Co-Founder, Simple Creature   # optional (default "Designer + developer")
tools: [CSS 3D transforms, GSAP ScrollTrigger]
# Case studies can also set:
client: Columbia Capital
role: Design + development
year: 2025
link: https://colcap.com
draft: true                   # optional — hidden from production builds
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
- `Figure` layouts: `wide` (default, columns 2–12), `full`, `half` (put two in a row).
- `Figure media` takes the alt text (and, without a `caption` prop, the caption) from the manifest; `alt="…"` overrides it.

## Media

Images and videos live in a Cloudflare R2 bucket, not in the repo. `src/data/media.json` describes every object in it (dimensions, blur placeholder, video poster, alt text, caption) and is committed, so builds never touch the bucket. Components take a **media key** (the object's path in the bucket, e.g. `notes/thinkmd/hero.jpg`); an unknown key fails the build.

- **Images** go through `next/image` with a Cloudflare Image Transformations loader (`/cdn-cgi/image/width=…,format=auto/`), so each breakpoint gets a resized AVIF/WebP.
- **Videos** without sound loop silently while on screen, like animated images; videos with sound get controls. Under `prefers-reduced-motion` all videos show their poster with controls.
- **Video encoding:** upload whatever you have (MOV, MP4, WebM, any size). Sync re-encodes it with `VIDEO_PRESET` in `scripts/media.mjs`: H.264 High, max 1920px wide (never upscaled), max 30fps, CRF 23, faststart, metadata stripped. The upload is kept at `_originals/<key>` and replaced by `<key>.mp4`, so reference the `.mp4` key. Silent audio tracks are dropped. Real sound is kept until you choose **Keep sound** or **Remove sound** in the admin (the **Sound?** filter lists these). To change the preset, edit it and bump `version`. The next `npm run media` re-encodes every video from its original, and `-- --reencode` forces a re-encode.
- **Workflow:** run `npm run dev` and open [localhost:3000/admin/media](http://localhost:3000/admin/media). Upload into a folder, write or generate alt text, save, and commit `media.json`. Or put files in the bucket some other way and run `npm run media` (`-- <key>…` for specific files, `--force` to re-read everything).
- The admin page only exists under `next dev` (its files are `*.dev.tsx`, see `pageExtensions` in `next.config.ts`). "Generate alt text" sends the image, your context notes, and the titles of the notes that use it to Claude. The draft is saved as unreviewed until you save/approve it. An empty alt that you've saved means decorative.
- Key names: `home/…`, `notes/<slug>/…`, `services/<slug>/…`. The upload folder field suggests these. To fix a key later, use **Move / rename** in the detail panel. It moves the file (plus its poster and original) in the bucket and rewrites references in notes and data files. A trailing `/` keeps the file name. To replace a file, prefer uploading under a new key. Objects are cached for a year, so the CDN may keep serving the old file at an existing key.
- Video encoding, probing and posters need `ffmpeg` locally (`brew install ffmpeg`).

### One-time setup

1. In Cloudflare, create an R2 bucket (e.g. `okayplus-media`). Under **Settings → Custom Domains**, connect `media.okaypl.us`. This needs the okaypl.us zone on Cloudflare.
2. On the zone, enable **Images → Transformations**.
3. Create an R2 API token (**Object Read & Write**, limited to the bucket).
4. Add a CORS policy to the bucket so the admin can upload from the browser:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3000"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type", "cache-control"] }]
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

## Design references

Standalone pages in `docs/` that explain parts of the design system. Open them in a browser; they don't need the dev server.

- [Palette](docs/palette.html): every `--color-*` token with its HSL position and contrast against paper and ink.
- [Easing curves](docs/easing-curves.html): the three `cubic-bezier()` curves used across the interface, with where each one is used.
- [Page reveal](docs/page-reveal.html): how the page transition reveals the next page from the click point, with a playable preview and every animation's timing and easing on one timeline.

They copy their values from `src/app/globals.css` by hand, so update them when the tokens, curves or transition timings change.

## Before launch

- Add `okaypl.us` (and the Vercel preview domain) to the Adobe Fonts kit `llb6krb`, or Gelica won't load.
- Set the scheduling link in `src/data/site.ts` (`bookingUrl`).
- Replace placeholder dates and bodies in `src/content/notes/`, and swap striped placeholders for real images.
- Set `NEXT_PUBLIC_MEDIA_HOST` in the Vercel project (see Media).
- Enable Web Analytics and Speed Insights in the Vercel project.
