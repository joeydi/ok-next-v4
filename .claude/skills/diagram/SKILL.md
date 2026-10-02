---
name: diagram
description: Build or change a technique diagram for an okaypl.us note — an animated, exploded-view figure that shows how a technique works (layers, the property doing the work, the motion), in the house style. Use when asked for a diagram, illustration or explainer for a note's technique, or to change one, and when exploring variants of one in the dev-only diagram lab (/admin/diagrams).
---

# Technique diagrams

A technique diagram shows how something in a note works: the page pulled apart into layers, with the one doing the work in pink, moving the way the real thing moves. Each note's diagram is its own code, built on a small shared kit, so every diagram looks like part of one set. The first is the poetry-in-motion note's (`src/components/diagrams/poetry-in-motion/`). Read it before writing a new one.

## Where things live

- **The kit**, `src/components/diagrams/`: generic, shared by every diagram. Change it only for something every diagram should get.
  - `stack.tsx`: `Stack` (the 16:9 surface, iso camera and floor grid), `Plate` (`level`, `look`), `Window` (`overflow`), `register()`, and the sizes (`SIZE`, `PLATE`, `GAP`, `WINDOW`, `FADE`).
  - `parts.tsx`: `Surface`, `FloorGrid`, `PlateHeader`, `Chip`, `HatchDef`.
  - `DiagramFigure.tsx`: the figure in a note, laid out and captioned like `<Figure>`, in the media frame.
  - `useLoop.ts`: the clock.
- **The note's diagram**, `src/components/diagrams/<note-slug>/`: everything specific to it: the model (shapes, data, maths), any content components, and one `"use client"` component that composes the kit, `<Name>Diagram({ caption, time })`. Only that component is exported to the note.
- **The note** imports it locally, under the frontmatter, and places it like a figure:

  ```mdx
  import { RiverDiagram } from "@/components/diagrams/poetry-in-motion/RiverDiagram";

  <RiverDiagram caption="01 / The River, in motion" />
  ```

  Never register a diagram in `src/mdx-components.tsx`. They're one per note, and a local import keeps each out of every other note's build.
- **The lab**, `src/app/admin/diagrams/` (dev only): one entry per diagram in `registry.tsx`, each with play/pause, a scrubber and speeds.

## House style

Settled on the first diagram. Keep to it unless the user asks otherwise, and then change the kit, not one diagram.

- **Frame**: 1120×630 (16:9), `DiagramFigure`'s media frame on `paper-raised`. Wide layout by default.
- **Camera**: iso (`rotateX(52deg) rotateZ(-38deg)`), close to the GL illustrations, with the floor grid under the stack in the same view. Plates sit one `GAP` apart.
- **Plates**, back to front, by `look`:
  - `base`: the page's ground, white (`paper-light`).
  - `subject`: the thing the technique is about, pink border, faint pink. Draw its shape with `HatchDef`, a `fill-pink/15` fill and a 2px `stroke-pink` outline.
  - `content`: what the subject acts on, as the reader sees it: a faint paper page (`paper/60`).
- **Labels**: each plate's header names it as code (`.line`, `img.river`), in bold mono. Chips after it name its properties. Make a chip `pink` only for the property doing the work. Usually there's one per plate.
- **Overflow**: content runs past the plates and fades out above and below (`<Window overflow>`), rather than being clipped. Keep a plain clipped `Window` for content that's just a backdrop.
- **Registration**: content lifted over the shape it reacts to moves by `register()`, so on screen it reads against that shape as if the plates lay flat.
- **Light only**: the dark tone was tried and dropped. Tokens and the site's utilities only, with no raw hex or curves (`#000` in a mask is fine).

## Motion

- `useLoop(duration, { time })` runs the clock only near the viewport. Under reduced motion it holds the server-rendered frame (`still`, 0 by default), so make sure that frame explains the diagram. The lab passes `time` to pin it.
- **Loops are seamless.** Make the geometry periodic (`bank()` in `poetry-in-motion/river.ts` is a sum of whole-period sines), and move things by whole periods, or whole blocks of repeated content, per loop.
- **Run the real thing** where the technique is CSS: the poetry-in-motion diagram wraps its lines with a live `shape-outside` float, so the browser does the layout, as in the demo.
- With overflow, **pad the content past the fade** (`FADE` plus any `register()` move), so the loop wraps where nothing is drawn. Fix the padding: if it changes with a control, the loop jumps.
- Keep the motion to what the technique does. Effects the diagram doesn't need to explain (the demo's blur and scale, say) obscure the part it's about.

## Workflow

1. Read the note and, if there is one, the demo's source. Say in a few lines what the technique is and which layers and which motion would show it.
2. Build in `src/components/diagrams/<note-slug>/` on the kit, and add an entry to `registry.tsx`.
3. **Explore** with the user. Each alternative is a temporary registry entry (`title: "B / Flat schematic"`), as a prop on the diagram or a sibling component in the note's folder. Compare them in `/admin/diagrams`.
4. **Collapse** to the chosen one: delete the other entries, the components and props only they used, and any option the chosen one doesn't take. Nothing in the folder should be unused.
5. Place it in the note with a numbered caption (`01 / …`) and a `description` (which is what a screen reader gets), and set the loop's still frame.
6. If a choice changes the house style, update the kit and this skill in the same change.

## Check

1. `npm run check` (Biome) and `npm run build` (types, and that the note's import resolves).
2. `rg` for the names of variants you deleted: nothing should remain.
3. With `npm run dev`, open the note at 1440 and 390, and its entry in `/admin/diagrams`: the loop has no seam, and nothing pops in at the fade's edges. Then turn on reduced motion and check the still frame.
