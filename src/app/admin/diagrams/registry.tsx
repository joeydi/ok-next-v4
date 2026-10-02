import type { ReactNode } from "react";
import { RiverDiagram } from "@/components/diagrams/poetry-in-motion/RiverDiagram";

// Every note's technique diagram, for the dev-only lab, in note order. While a
// diagram is being explored its variants sit here too, one entry each; when one
// is chosen, its entry stays and the others are deleted, along with their code.
// See .claude/skills/diagram/SKILL.md.

export type DiagramEntry = {
  /** The note's slug, for the link to it. */
  note: string;
  title: string;
  /** Loop length (s). */
  loop: number;
  /** The diagram pinned at `time` seconds into its loop. */
  render: (time: number) => ReactNode;
};

export const DIAGRAMS: DiagramEntry[] = [
  {
    note: "poetry-in-motion",
    title: "The River, in motion",
    loop: 8,
    render: (time) => <RiverDiagram caption="01 / The River, in motion" time={time} />,
  },
];
