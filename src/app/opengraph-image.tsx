import { OG_SIZE, renderOg } from "@/lib/og";

export const alt = "Okayplus — Joe di Stefano, designer + developer in Burlington, Vermont";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({ eyebrow: "/ 00  Burlington, Vermont", title: "Let’s think it through, *together.*" });
}
