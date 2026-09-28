import type { Metadata } from "next";
import { Ring } from "@/components/illustrations";
import { IllustrationLab } from "./IllustrationLab";

// Dev-only (see pageExtensions in next.config.ts): the CSS illustrations next to
// their WebGL ports, with the renderer's lighting controls.

export const metadata: Metadata = { title: "Illustration lab", robots: { index: false, follow: false } };

export default function IllustrationLabPage() {
  return <IllustrationLab css={{ ring: <Ring className="w-full" /> }} />;
}
