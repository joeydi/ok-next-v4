import type { ReactNode } from "react";
import { NUDGE as RIVER_NUDGE, RiverDiagram } from "@/components/diagrams/poetry-in-motion/RiverDiagram";
import { RerenderDiagram } from "@/components/diagrams/programmable-video/RerenderDiagram";
import {
  LOOP as STRIP_LOOP,
  NUDGE as STRIP_NUDGE,
  StripDiagram,
} from "@/components/diagrams/programmable-video/StripDiagram";

// Every note's technique diagram, for the dev-only lab, in note order. While a
// diagram is being explored its variants sit here too, one entry each; when one
// is chosen, its entry stays and the others are deleted, along with their code.
// See .claude/skills/diagram/SKILL.md.

export type Nudge = [x: number, y: number];

export type DiagramEntry = {
  /** The note's slug, for the link to it. */
  note: string;
  title: string;
  /** Loop length (s). */
  loop: number;
  /** For a diagram that fine-tunes a register() by eye: its nudge on screen (px), which the lab can change. */
  nudge?: Nudge;
  /** The diagram pinned at `time` seconds into its loop, with the lab's nudge if it takes one. */
  render: (time: number, nudge?: Nudge) => ReactNode;
};

export const DIAGRAMS: DiagramEntry[] = [
  {
    note: "poetry-in-motion",
    title: "The River, in motion",
    loop: 8,
    nudge: RIVER_NUDGE,
    render: (time, nudge) => <RiverDiagram caption="01 / The River, in motion" time={time} nudge={nudge} />,
  },
  {
    note: "programmable-video",
    title: "Every frame, a function of time",
    loop: STRIP_LOOP,
    nudge: STRIP_NUDGE,
    render: (time, nudge) => <StripDiagram caption="01 / Every frame, a function of time" time={time} nudge={nudge} />,
  },
  {
    note: "programmable-video",
    title: "Fixing one shot",
    loop: 12,
    render: (time) => <RerenderDiagram caption="02 / Fixing one shot" time={time} />,
  },
];
