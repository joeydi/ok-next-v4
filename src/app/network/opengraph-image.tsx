import { OG_SIZE, renderOg } from "@/lib/og";

export const alt = "Network — Okayplus";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({ eyebrow: "/ Network", title: "Stay eager*.*" });
}
