import { OG_SIZE, renderOg } from "@/lib/og";

export const alt = "Notes — Okayplus";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({ eyebrow: "/ Notes", title: "Notes*.*" });
}
