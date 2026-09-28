import type { Metadata } from "next";
import { IllustrationLab } from "./IllustrationLab";

// Dev-only (see pageExtensions in next.config.ts): the WebGL illustrations with
// the renderer's lighting controls, a scrubber, and the poster exporter.

export const metadata: Metadata = { title: "Illustration lab", robots: { index: false, follow: false } };

export default function IllustrationLabPage() {
  return <IllustrationLab />;
}
