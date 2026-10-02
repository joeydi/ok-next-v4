"use client";

import { useEffect, useRef, useState } from "react";
import { Accent } from "@/components/Accent";
import { Logo } from "@/components/Logo";
import { SITE } from "@/data/site";
import type { OgCard } from "@/lib/og-cards";
import { defaultTitleWidth } from "@/lib/og-title";

export type OgCardAssets = {
  /** Data URIs from og.tsx's imageData / posterData, so both versions draw the same pictures. */
  imageSrc?: string;
  poster?: { src: string; width: number; height: number };
  /** The network still, an SVG document at the card's size. */
  backdrop?: string;
};

const TITLE = {
  48: "text-[48px] leading-heading-48 tracking-display-48",
  60: "text-[60px] leading-heading-60 tracking-display-60",
  96: "text-[96px] leading-heading-96 tracking-display-96",
};

/**
 * The card as renderOg lays it out, in HTML at 1200×630 so the browser can set the title
 * in Gelica. Fixed over the page (and the nav) at the top left, where the capture route
 * screenshots it once `data-ready` is set: fonts loaded and every image decoded.
 */
export function OgCardHtml({
  card,
  imageSrc,
  poster,
  backdrop,
  width,
}: {
  card: Pick<OgCard, "eyebrow" | "title">;
  /** The title column's width (the card's titleWidth, or a slider's in /admin/og); unset, the default. */
  width?: number;
} & OgCardAssets) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const images = [...(ref.current?.querySelectorAll("img") ?? [])];
    Promise.all([document.fonts.load("400 80px gelica"), ...images.map((img) => img.decode())])
      .then(() => document.fonts.ready)
      .then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  // Title sizes are stops on the type scale, each with its heading leading and tracking
  // (the card is a fixed 1200px image, so px rather than the fluid text-fl-* sizes).
  // Gelica runs wider than Hanken, so it steps down a little sooner than renderOg's sizes.
  const column = width ?? defaultTitleWidth(Boolean(imageSrc), Boolean(poster));
  const title = imageSrc
    ? card.title.length > 44
      ? TITLE[48]
      : TITLE[60]
    : card.title.length > 30
      ? TITLE[60]
      : TITLE[96];

  return (
    <div
      ref={ref}
      data-ready={ready || undefined}
      className="fixed top-0 left-0 z-[100] flex h-[630px] w-[1200px] flex-col justify-between overflow-hidden bg-paper p-16 text-ink"
    >
      {backdrop && (
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(backdrop)}`}
          width={1200}
          height={630}
          alt=""
          className="absolute inset-0"
        />
      )}

      <div className="relative flex items-center justify-between">
        <Logo width={150} height={35} className="h-[35px] w-[150px] text-pink lg:h-[35px]" />
        <div className="font-mono text-[20px] tracking-label text-muted uppercase">
          {SITE.author} / {SITE.tagline}
        </div>
      </div>

      <div className="relative flex items-end justify-between gap-12">
        <div
          className="flex flex-col"
          style={{
            gap: imageSrc ? 24 : 28,
            ...(imageSrc ? { width: column } : { maxWidth: column }),
          }}
        >
          <div className="flex gap-6 font-mono text-[22px] tracking-label text-muted uppercase">
            {card.eyebrow.split(/\s{2,}/).map((part, i) => (
              <span key={i}>{part}</span>
            ))}
          </div>
          <div className={`display ${title}`}>
            <Accent text={card.title} />
          </div>
        </div>
        {imageSrc && (
          <img
            src={imageSrc}
            width={520}
            height={293}
            alt=""
            className="h-[293px] w-[520px] rounded-[2px] border border-rule object-cover"
          />
        )}
      </div>

      {poster && !imageSrc && (
        <img
          src={poster.src}
          width={poster.width}
          height={poster.height}
          alt=""
          className="absolute right-12 bottom-10"
        />
      )}
    </div>
  );
}
