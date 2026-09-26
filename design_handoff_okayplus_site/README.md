# Handoff: Okayplus website redesign ("Field Notes")

## Overview
This is a six-page marketing site for Okayplus, Joe di Stefano's design and development consultancy in Burlington, Vermont. The direction is called "Field Notes": warm paper backgrounds, Gelica display type, mono labels, one punchy pink accent (#FF4D6A), animated isometric 3D block illustrations in each hero, and a dark footer that holds the photo, testimonials, and contact block. The tone is meant to be personal and considered, not salesy.

Pages:
1. Home (`index.html`)
2. Creative production (`creative-production.html`)
3. CMS & integrations (`cms-integrations.html`)
4. Tools for better work (`tools-for-better-work.html`)
5. Notes, the blog index (`notes.html`)
6. Blog post template (`blog-post.html`). Case studies will reuse this layout later.

## About the design files
The files in this bundle are **design references built in HTML**. They are prototypes that show the intended look and behavior; they are not production code to copy directly. Recreate them in the target codebase's existing environment using its established patterns. If no codebase exists yet, pick an appropriate stack. A static-friendly framework such as Astro, Next.js, or Eleventy with a CMS for Notes would fit well.

The `.dc.html` files are "Design Components": HTML templates with `{{ }}` holes plus a small JS logic class at the bottom of each file (`class Component extends DCLogic`). `renderVals()` returns the data the template uses. Read the markup for layout and styles and the logic class for content arrays and illustration code. They need `support.js` beside them to open in a browser. The `standalone/` folder holds self-contained builds of the same six pages that open offline (fonts still load from the web).

## Fidelity
**High fidelity.** Colors, type, spacing, copy, and illustration motion are final for desktop. Recreate them pixel-accurately at 1440px.

Not designed yet, so the developer will need to decide these:
- Tablet and mobile layouts. The pages are built as a fixed 1440px canvas centered on a dark body (`#1C1916`). Make them fluid: keep the 12-column grid on desktop, then collapse columns, scale the display type down, and stack or shrink the hero illustration.
- Hover, focus, and active states beyond `a:hover { opacity: .7 }`.
- `prefers-reduced-motion` support. All illustration animation should stop, which matches the design's `motion=false` state.
- Favicon and social share images.
- A case study template, which will follow the blog post layout.

## Global layout
- Page width is 1440px with 64px side padding.
- Content sits on a 12-column grid: `grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 24px`.
- Section padding is usually `96px 64px`, with variants of `96px 64px 120px` and `120px 64px 40px`.
- Hairline dividers are `1px solid #D9D1C4` on paper and `1px solid #3A3631` in the dark footer.
- Section eyebrows are mono labels in the form `/ 01  SECTION NAME`: IBM Plex Mono, 14px, letter-spacing .06em, uppercase, color `#6B645B`, with 24px between the number and the name.
- Image placeholders are striped boxes labeled with what goes there. They will be replaced with real photography and screenshots.

### Nav (all pages)
- 12-column grid, padding `30px 64px`, IBM Plex Mono 14px, .06em, uppercase.
- Columns 1–3: the `assets/okayplus.svg` logo, 28px tall, `filter: brightness(0)`, linking to Home.
- Columns 4–7: "Joe di Stefano / Designer + developer" in `#6B645B`.
- Columns 8–12: links aligned right with a 32px gap. They are Approach, Services, Notes, About, and "Say hello →" in `#D4203F`. Approach, Services, About, and Say hello are anchors on Home (`#approach`, `#services`, `#about`, `#contact`); on other pages they point to `index.html#…`.

### Footer (all pages, dark)
- Background `#1C1916`; text `#F3EFE8`, with secondary text in `#A89F93`.
- On Home the footer also holds the About block ("Hi, I'm Joe. The one on the left.", with the headshot) and the testimonials ("Kind words from good people.").
- Every page ends with "Say hello." in Gelica 168px, followed by `joe@okaypl.us` (26px, 2px `#FF4D6A` bottom border) and "Book a 20-min call →" in `#A89F93`. Below that sits a mono bottom row with a `#3A3631` top border.

## Screens

### 1. Home
- **Hero** (`/ 00 INTRODUCTION`, min-height 880px, padding `56px 64px 88px`)
  - H1 reads "Let's think / it through, / together." in Gelica 500, 168px, line-height .9, letter-spacing -.035em. "together." is `#FF4D6A`.
  - The illustration is absolutely positioned at top 40px on the right, in a 620×660 box scaled 1.15 from the top right. It is the **Puzzle cube** (see Illustrations).
  - Below: an intro paragraph in columns 1–6 (24px, line-height 1.5, `#4A443D`) and a headshot plus short bio in columns 9–12 (72×72 photo, top border `#D9D1C4`).
- **Approach** (`#approach`) is titled "A partner, not a vendor."
- **Services** (`#services`) is titled "Where I fit in." and has three cards in `repeat(3, 1fr)`:
  - Cards use background `#F8F5F0`, a `#D9D1C4` border, padding `28px 32px 32px`, and a minimum height of 360px.
  - Each card has a mono kicker row, a Gelica 36px title, and a description, and links to its service page.
  - Kickers are AGENCIES + MARKETING, NON-PROFITS + LARGE ORGS, and INTERNAL TEAMS.
- **Footer** holds About (`#about`), testimonials, and Contact (`#contact`).

### 2–4. Service pages (shared structure)
Every service page has the same six parts:
1. A hero with its H1 on the left and its animated illustration on the right (620×660, scale 1.15, origin top right).
2. Four capability cards.
3. A problems/situations list ("when to call").
4. Four numbered process steps (01–04).
5. A recent work example with an image placeholder.
6. The dark footer.

| Page | H1 | Capabilities | Situations | Process | Work | Illustration |
|---|---|---|---|---|---|---|
| Creative production | Ready when you are. | An extra pair of hands. | When to call. | Quick, not careless. | Mamava 3D product tour | Quick build |
| CMS & integrations | Content, connected. | Four ways in. | Signs it's time. | Measure twice, migrate once. | Columbia Capital | Migration, conveyor |
| Tools for better work | Tools for better work. | Three kinds of tools. | Signs a tool could help. | Small, useful, then better. | Arizona Education Progress Meter | Dashboard |

The exact copy for cards, lists, and steps is in each file, either in the markup or in the `renderVals()` arrays. Joe still plans a content review pass on the service descriptions, process steps, and capability cards.

### 5. Notes (blog index)
- The H1 is "Notes." with the period in pink. A featured post follows ("Designing a Website That Feels Alive While Keeping Content Front and Center").
- **Filters** are plain mono labels with counts: All, Case studies, Process, Vermont, Community.
  - Unselected labels are `#6B645B` with counts in `#A89F93`.
  - The selected label is `#1C1916` with its count in `#D4203F` and a `#FF4D6A` underline.
  - Clicking a label filters the post list on the client (`state.filter`, default `'ALL'`).
- Posts come from the `all` array in `renderVals()`. Each post has a tag, title, description, and image placeholder.

### 6. Blog post
- The header has the title in Gelica, then meta, a hero image, and a long-form body column. The body text is Hanken Grotesk at 18–20px with line-height about 1.6–1.7.
- Case studies will use this template.

## Illustrations (hero graphics)
The hero graphics are pure CSS 3D built from divs, with no images or WebGL. Reproduce them as a small component library, using CSS 3D or a lightweight three.js scene if preferred. Match the geometry, colors, and timing below.

**Scene setup** (`frame()` and `scene()` in the logic class):
- 620×660 frame with `overflow: hidden`.
- Three dashed vertical guides at x = 116, 300, and 484. The outer two are `#C9BFB0`; the center one is `#FF4D6A`.
- Three mono labels at left 500 and y = 110, 205, 300, formatted as `/ 01` over the label. The middle label is `#D4203F`.
- A 300×300 plane centered at (300, 400) with `transform: rotateX(58deg) rotateZ(-45deg)` and `transform-style: preserve-3d`, over a faint grid.

**Box primitive** (`box()`): a top face plus four walls.
- The top is `translateZ(h)` with a `1px inset` stroke in the side-2 color.
- Walls use `rotateX(90deg)` and `rotateY(-90deg)`.

Each palette lists top, side 1, and side 2:
- Warm white `W`: `#FBF8F3`, `#D8CFC1`, `#C4B9A8`
- Pink `P`: `#FF4D6A`, `#D62A4A`, `#E63757`
- Neutral `N`: `#E9E2D7`, `#CFC5B6`, `#BFB3A1`

| Page | Name | Labels | Motion |
|---|---|---|---|
| Home | Puzzle cube (`rubik(motion, true)`) | MARKETERS / ORGANIZATIONS / TEAMS | See below |
| Creative production | Quick build (`p1`) | AGENCIES / CAMPAIGNS / REPORTING | See below |
| CMS & integrations | Migration, conveyor (`c3`) | CONTENT / INTEGRATIONS / PLATFORM | See below |
| Tools | Dashboard (`t1`) | VISIBILITY / AUTOMATION / MONITORING | Isometric bars scale in Z (`okBar`), ease-in-out, staggered |

### Puzzle cube (Home)
- 3×3×3 cubes, each 64px on a 90px pitch. The middle layer is pink and the top and bottom layers are warm white.
- It scrambles with four slice turns: x+1, y−1, z+1, x−1. Then it plays them in reverse until solved.
- Each turn takes 0.6s with easing `cubic-bezier(.65,0,.35,1)`.
- Once solved, each horizontal layer turns 180° about Z. The top layer starts at 0.5s, the middle at 0.8s, and the bottom at 1.1s, and each turn takes 1.3s. The cube then holds until 3.2s.
- One loop is 10.4s.
- As cubes move, face colors swap so the tops stay light and the sides stay shaded. The keyframes are generated per cube in code (`@keyframes okRs{ijk}`).

### Quick build (Creative production)
- Four 180×180×36 slabs (W, W, W, P) drop in with a bounce (`cubic-bezier(.35,1.4,.55,1)`), one after another.
- They hold, then slide off along +X.
- One loop is 5.5s (`okDrop0`–`okDrop3`).

### Migration, conveyor (CMS & integrations)
- A lower neutral platform (100×100×40) spawns pink tiles.
- A looping line of four warm-white platforms slides right to left along the iso diagonal (`okConvey`). Each platform has four 36×36×14 pink tile slots with one missing, and a different slot is missing on each platform.
- A tile appears on the lower platform, then hops 170px in an arc 150px high to fill the gap (`okHop2`, `okFill`).
- One loop is 6s, with platforms offset by 1.5s.

The global **Motion** toggle (`props.motion`) turns every animation on or off. Tie it to `prefers-reduced-motion`.

`reference/Okayplus Illustrations.dc.html` also contains the alternatives that were explored and not chosen (1a–1l). Use it only for reference.

## Interactions & behavior
- Navigation between pages uses plain links, with anchor links into sections on Home.
- The Notes filters run on the client with no page reload.
- `a:hover { opacity: .7 }` everywhere; the rest of the hover and focus states are still to design.
- The "Book a 20-min call" link is `#` for now, waiting on a scheduling URL.

## State
- Notes: `filter` is one of `'ALL' | 'CASE STUDY' | 'PROCESS' | 'VERMONT' | 'COMMUNITY'`.
- Global: `motion`, a boolean (default true). Derive it from `prefers-reduced-motion`.
- In production, Notes posts and case studies should come from a CMS or markdown.

## Design tokens

**Colors**
| Token | Hex | Use |
|---|---|---|
| paper | `#F3EFE8` | Page background |
| paper-raised | `#F8F5F0` | Cards |
| paper-light | `#FBF8F3` | Illustration tops |
| sand | `#EBE5DB` | Soft fills |
| rule | `#D9D1C4` | Hairlines and card borders |
| guide | `#C9BFB0` | Illustration guides |
| ink | `#1C1916` | Text and the dark footer |
| ink-2 | `#2E2A26` | Raised surfaces on dark |
| rule-dark | `#3A3631` | Hairlines on dark |
| body | `#4A443D` | Body copy |
| muted | `#6B645B` | Labels and secondary text |
| muted-2 | `#8A8278` | Tertiary text |
| muted-on-dark | `#A89F93` | Secondary text on dark |
| pink | `#FF4D6A` | Accent: highlights, underlines, illustration |
| pink-ink | `#D4203F` | Pink text on light (for contrast) and nav CTA |

**Typography**
- Display: **Gelica** 500 via Adobe Fonts (kit `https://use.typekit.net/duf7mcy.css`). Add the live domain to the kit.
- Body: **Hanken Grotesk** 400/500/600 (Google Fonts).
- Labels: **IBM Plex Mono** 400/500 (Google Fonts), 14px, letter-spacing .06em, uppercase.
- Size scale (px): 14, 18, 20, 24, 26, 30, 36, 48, 60, 96, 144, 168, 192.
- Display line-height is .85–.95 with letter-spacing -.035em to -.04em. Mid headings use -.015em to -.02em. Body line-height is 1.5–1.7.

**Other**
- Border radius is 0 almost everywhere, with 2px on the headshot and 999px on pill badges.
- There are no shadows on the site itself.

## Assets
- `assets/okayplus.svg` is the logo, displayed black via `filter: brightness(0)`.
- `assets/headshot.jpg` is Joe's headshot.
- `assets/festival.jpg` is a photo.
- Everything else is a labeled placeholder. Real reviewer photos and project images are still to come.
- Whether and how Simple Creature appears on the site is still undecided.

## Files
- `pages/Site Home.dc.html`
- `pages/Site Creative Production.dc.html`
- `pages/Site CMS Integrations.dc.html`
- `pages/Site Tools.dc.html`
- `pages/Site Notes.dc.html`
- `pages/Site Blog Post.dc.html`
- `pages/support.js` is the runtime that lets the `.dc.html` files open in a browser.
- `pages/assets/` holds the images above.
- `standalone/*.html` are self-contained builds of all six pages that open offline and link to each other.
- `reference/Okayplus Pages.dc.html` is the canvas with all six pages side by side.
- `reference/Okayplus Illustrations.dc.html` holds all the illustration explorations.
- `screenshots/01–06-*.png` are full-page captures of each page at 1440px. Each illustration is caught at one moment of its animation.
