import { networkSvg } from "@/components/network/frame";
import type { Rect } from "@/components/network/simulation";
import { OG_SIZE, renderOg } from "@/lib/og";

export const alt = "Network — Okayplus";
export const size = OG_SIZE;
export const contentType = "image/png";

// renderOg's text blocks on the card, padded so nodes clear them: the logo, the
// tagline, and the eyebrow + title.
const TEXT: Rect[] = [
  [24, 24, 254, 139],
  [608, 24, 1176, 139],
  [24, 384, 660, 606],
];

export default function Image() {
  return renderOg({
    eyebrow: "/ Network",
    title: "Stay eager*.*",
    backdrop: networkSvg({ ...OG_SIZE, avoid: TEXT, color: "#FF4D6A" }),
  });
}
