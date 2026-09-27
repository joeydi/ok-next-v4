"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Media } from "@/lib/media";
import { mediaLoader, mediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/cn";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Silent clips loop like animated images: muted, no controls, and only playing
 * while on screen. Clips with sound, or any clip under prefers-reduced-motion,
 * show the poster with controls instead.
 */
export function Video({ media, alt, className }: { media: Media; alt?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useSyncExternalStore(subscribe, () => matchMedia(REDUCED).matches, () => false);
  const loop = !media.hasAudio && !reduced;
  const label = alt ?? media.alt;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!loop) {
      video.pause();
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [loop]);

  return (
    <video
      ref={ref}
      src={mediaUrl(media.key)}
      poster={media.poster ? mediaLoader({ src: media.poster, width: 1920 }) : undefined}
      width={media.width}
      height={media.height}
      muted={!media.hasAudio}
      loop={loop}
      controls={!loop}
      playsInline
      preload="none"
      aria-label={label || undefined}
      aria-hidden={loop && !label ? true : undefined}
      className={cn("size-full object-cover", className)}
    />
  );
}
