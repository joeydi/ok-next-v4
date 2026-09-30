---
name: design-doc
description: Write or update a design doc for okaypl.us — a reference page in the dev-only admin (/admin/docs/<slug>) that explains part of the design system (tokens, motion, layout, components). Use when asked for a new doc, explainer, reference or visual guide to how the site looks or moves, or to change an existing one.
---

# Design docs

Design docs are MDX files in `src/content/docs/`, shown in the dev-only admin at `/admin/docs/<slug>` and listed in its sidebar automatically. They never ship. Every doc shares one look: the site's own type, tokens and components, with no custom styles, colours or dark mode. That consistency is the point, so follow the structure below rather than inventing a layout.

Read an existing doc before writing one: `palette.mdx` (charts and tables), `easing-curves.mdx` (a card per item), `view-transitions.mdx` (a live demo, a timeline, exported data).

## File and frontmatter

`src/content/docs/<slug>.mdx`. The filename is the slug; keep it short and kebab-case.

```yaml
---
title: Easing curves        # heading and sidebar label; the page adds a pink full stop
description: One or two sentences, shown as the lede in Gelica. Plain text, no Markdown.
order: 2                    # sidebar position; omit to list after the ordered docs, A–Z
size: large                 # optional: a larger heading, for a doc that's mostly visual
---
```

`src/lib/docs.ts` validates it, and the build fails on a bad field.

## Structure

The page renders the header (`/ Docs · dev only`, the title, the lede, a rule) from the frontmatter. The body then follows this order:

1. **An intro paragraph** saying where the values live (which file, which variables) and how to use them in code.
2. **`## Sections`**, each numbered automatically (`/ 01`). Start each with a sentence or two of prose, then its visual.
3. **Visuals** from the components below, which run the full width. Prose stays in the narrower column.

Write the prose like the rest of the site: plain, specific and short. Say what something is for, not just what it is.

## Values come from the CSS, never copies

Every colour, curve and timing is read from `src/app/globals.css` by `src/lib/tokens.ts`:
- `colors()`: `--color-*` with hex, HSL and contrast
- `eases()` / `ease(name)`: `--ease-*` control points (`"ease"` is CSS's default)
- `viewTransitions()` / `viewTransition(name)`: `--view-transition-*` timings and amounts
- `fonts()`, `trackings()`: `--font-*` stacks and `--tracking-*` in em
- `typeScale()` / `sizeAt(token, vw)`: the `--text-fl-*` sizes from `src/app/fluid.css`, with the viewport widths `scripts/fluid.mjs` wrote there

Refer to a token by name: `duration="reveal"`, `ease="out-expo"`. If a doc needs a value that isn't a token yet, add the token to `globals.css`, use it in the site's CSS, then read it here. Plain numbers are fine for things that aren't tokens, like a sample duration or a browser default.

`npm run check` fails on a hex colour, a literal `rgb()`/`hsl()`, a literal `cubic-bezier()` or a `<style>` block in `src/content/docs` or `src/components/docs`.

## Components

They're available in every doc without importing, registered in `src/components/docs/index.ts`. Links, `code`, lists and tables in Markdown are styled already.

**Layout**
- `<DocFigure title="Hue wheel" caption="What to notice.">…</DocFigure>`: a paper panel for any visual.
- `<DocGrid cols={2|3}>…</DocGrid>`: figures or cards side by side.
- `<DocTable columns={[{ label: "Token" }, { label: "L", align: "end" }]} rows={[[…], […]]} />`: a ruled reference table.
- `<DocCards><DocCard label="Click" title="Pointer position">…</DocCard></DocCards>`: parallel cases.

**Colour**
- `<Swatches groups={{ Paper: ["paper", "sand"] }} />`
- `<SaturationPlot />`, `<HueWheel />`
- `<PaletteTable />`

**Type**
- `<Typeface font="display" name="Gelica" source="Adobe Fonts" weights={[400]} use="…">…</Typeface>`
- `<TypeScale />`, `<FluidScalePlot />`, `<Trackings />`
- `<TypeStyles />`: every type style the site sets, scanned from its source (`typeUsage.ts`)

**Motion**
- `<Curve ease="out-expo" title="Expo out" duration={500} used="…">…</Curve>` and `<PlayAll />`.
- `<TransitionCurve curves={[{ ease: "in", tone: "muted", duration: "blur" }]} used="…">…</TransitionCurve>`
- `<Timeline rows={ROWS} step={100} live />` and `<KeyframeTable rows={ROWS} />`. Export `ROWS` once from the MDX (`export const ROWS = […]`), so the chart and the table share it.
- `<RevealPreview />` and `<MaskDiagram />`, specific to the page transition.

Chart colours are the tones in `src/components/docs/tone.ts`: `pink` (the subject), `muted` (what it's compared against), `ink` (supporting) and `guide` (background).

## New visuals

When no component fits, add one to `src/components/docs/` rather than writing markup in the MDX:
- a server component reading `src/lib/tokens.ts`, with a `"use client"` child only for interaction
- `doc-wide` on its root, so it spans the full width
- utilities and tokens only: `mono-label`, `mono-text`, `display`, `text-fl-*`, `border-rule`, `bg-paper-light`, the tones
- register it in `index.ts` and list it above

For any chart or plot, load the **dataviz** skill first. Draw in the site's palette through the tones (pink for the subject, neutrals for the rest), label directly rather than with legends where you can, and keep grid lines in `rule`.

## Check

1. `npm run check` (Biome and the docs guardrail).
2. `npm run build` (type-checks the components).
3. With `npm run dev` running, open `/admin/docs/<slug>` at 1440 and 390: the header, numbered sections and full-width visuals should match the other docs, and the doc should appear in the sidebar in order.
