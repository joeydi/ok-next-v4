import type { MDXComponents } from "mdx/types";
import { Curve } from "./Curve";
import { DocCard, DocCards } from "./DocCards";
import { DocFigure, DocGrid } from "./DocFigure";
import { DocTable } from "./DocTable";
import { MaskDiagram } from "./MaskDiagram";
import { HueWheel, PaletteTable, SaturationPlot, Swatches } from "./Palette";
import { PlayAll } from "./PlayTrack";
import { RevealPreview } from "./RevealPreview";
import { KeyframeTable, Timeline } from "./Timeline";
import { TransitionCurve } from "./TransitionCurve";

// Components available in every design doc (src/content/docs/*.mdx) without importing.
// Passed to the doc's MDX by /admin/docs/[doc], so they never reach the notes; links
// and the rest come from src/mdx-components.tsx, as in notes.
// .claude/skills/design-doc/SKILL.md lists what each one is for.

export const docComponents: MDXComponents = {
  // Layout
  DocFigure,
  DocGrid,
  DocTable,
  DocCards,
  DocCard,
  // Palette
  Swatches,
  SaturationPlot,
  HueWheel,
  PaletteTable,
  // Easing
  Curve,
  PlayAll,
  // View transitions
  RevealPreview,
  Timeline,
  KeyframeTable,
  TransitionCurve,
  MaskDiagram,
};
