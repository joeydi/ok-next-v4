# okaypl.us

The Okayplus site: Joe di Stefano, designer + developer, Burlington, Vermont.

Next.js 16 · React 19 · Tailwind CSS v4 · MDX · Vercel

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static build; every route is prerendered
npm run lint
node scripts/fluid.mjs   # regenerate src/app/fluid.css after changing the scale
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
image: /images/notes/foo.jpg  # optional — striped placeholder until set
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
<Figure layout="half" src="/images/a.jpg" alt="…" caption="02 / Scroll reveal" />
<Figure layout="half" src="/images/b.jpg" alt="…" caption="03 / About page scene" />

<TocAnchor label="04 / Services pathway" />

<PullQuote>Projects like this are a balancing act between *experimentation and usability.*</PullQuote>
```

- Numbered figure captions (`01 / …`), `<TocAnchor>` labels and `## headings` build the "In this post" list.
- `Figure` layouts: `wide` (default, columns 2–12), `full`, `half` (put two in a row).

## Before launch

- Add `okaypl.us` (and the Vercel preview domain) to the Adobe Fonts kit `duf7mcy`, or Gelica won't load.
- Set the scheduling link in `src/data/site.ts` (`bookingUrl`).
- Replace placeholder dates and bodies in `src/content/notes/`, and swap striped placeholders for real images.
- Enable Web Analytics and Speed Insights in the Vercel project.
