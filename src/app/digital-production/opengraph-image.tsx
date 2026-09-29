import { OG_SIZE, ogImage } from "@/lib/og";
import { ogCard } from "@/lib/og-cards";

export const alt = ogCard("/digital-production")!.alt;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage("/digital-production");
}
