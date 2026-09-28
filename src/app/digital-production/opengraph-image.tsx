import { services } from "@/data/services";
import { OG_SIZE, renderOg } from "@/lib/og";

const s = services["digital-production"];

export const alt = `${s.title} — Okayplus`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({ eyebrow: `/ Services  ${s.n}  ${s.audience}`, title: s.h1.join(" ") });
}
