import { ImageResponse } from "next/og";
import { cubeMarkSvg } from "@/lib/cube-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const src = `data:image/svg+xml;base64,${Buffer.from(cubeMarkSvg({ size: 180 })).toString("base64")}`;

export default function AppleIcon() {
  return new ImageResponse(<img src={src} width={180} height={180} alt="" />, size);
}
