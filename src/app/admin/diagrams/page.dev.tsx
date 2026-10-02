import type { Metadata } from "next";
import { AdminShell } from "../AdminShell";
import { DiagramLab } from "./DiagramLab";

// Dev-only (see pageExtensions in next.config.ts): every note's technique
// diagram, from registry.tsx, with a scrubber each.

export const metadata: Metadata = { title: "Diagram lab", robots: { index: false, follow: false } };

export default function DiagramLabPage() {
  return (
    <AdminShell>
      <DiagramLab />
    </AdminShell>
  );
}
