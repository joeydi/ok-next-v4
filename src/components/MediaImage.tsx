"use client";

import Image, { type ImageProps } from "next/image";
import { mediaLoader } from "@/lib/media-url";

/** next/image for R2 keys. The loader is a function, so it has to be attached on the client. */
export function MediaImage({ alt, ...props }: ImageProps) {
  return <Image loader={mediaLoader} alt={alt} {...props} />;
}
