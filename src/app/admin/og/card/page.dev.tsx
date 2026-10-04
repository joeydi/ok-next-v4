import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SCENES, type SceneName } from "@/components/illustrations/gl/scenes";
import { getMedia } from "@/lib/media";
import { backdropData, imageData, posterData } from "@/lib/og";
import { type OgCard, ogCard } from "@/lib/og-cards";
import { OgCardHtml } from "../OgCardHtml";

// Dev-only (see pageExtensions in next.config.ts): a card drawn in the browser, so its
// title is set in Gelica. /admin/og/capture screenshots it into the media store, and
// the playground shows it in a frame.
// ?path=/notes/rigorous — a route's card
// ?eyebrow=…&title=…&illustration=<scene>&image=<media key> — any card (the playground)
// &titleWidth=<px>|auto — overrides the card's title width, for /admin/og's sliders

export const metadata: Metadata = { title: "Open Graph card", robots: { index: false, follow: false } };

type Params = {
  path?: string;
  eyebrow?: string;
  title?: string;
  illustration?: string;
  image?: string;
  titleWidth?: string;
};

/** A card from the playground's fields. Unknown scenes and media keys are left out. */
function adHoc(q: Params): Omit<OgCard, "alt"> {
  let image: OgCard["image"];
  try {
    image = q.image ? getMedia(q.image) : undefined;
  } catch {}
  return {
    eyebrow: q.eyebrow ?? "",
    title: q.title ?? "",
    image,
    illustration: q.illustration && q.illustration in SCENES ? (q.illustration as SceneName) : undefined,
  };
}

export default async function OgCardPage({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await searchParams;
  const card = q.path ? ogCard(q.path) : adHoc(q);
  if (!card) notFound();

  const [imageSrc, backdropSrc] = await Promise.all([
    card.image && !card.backdrop ? imageData(card.image) : undefined,
    backdropData(card),
  ]);
  const poster = !imageSrc && card.illustration ? await posterData(card.illustration) : undefined;
  return (
    <>
      {/* The dev tools' badge would land in the screenshot and the playground's frame. */}
      <style>{"nextjs-portal { display: none; }"}</style>
      <OgCardHtml
        card={{ eyebrow: card.eyebrow, title: card.title }}
        imageSrc={imageSrc}
        poster={poster}
        backdropSrc={backdropSrc}
        width={q.titleWidth ? Number(q.titleWidth) || undefined : card.titleWidth}
      />
    </>
  );
}
