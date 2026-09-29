import { SCENES, type SceneName } from "@/components/illustrations/gl/scenes";
import { getMedia } from "@/lib/media";
import { renderOg } from "@/lib/og";

// Dev-only (route.dev.ts): renders an OG card from query params for the /admin/og playground.
// ?eyebrow=…&title=…&illustration=<scene>&image=<media key>

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const q = new URL(request.url).searchParams;
  const illustration = q.get("illustration") || undefined;
  if (illustration && !(illustration in SCENES))
    return new Response(`Unknown scene "${illustration}"`, { status: 400 });
  let image: ReturnType<typeof getMedia> | undefined;
  try {
    image = q.get("image") ? getMedia(q.get("image")!) : undefined;
  } catch (e) {
    return new Response((e as Error).message, { status: 400 });
  }
  return renderOg({
    eyebrow: q.get("eyebrow") ?? "",
    title: q.get("title") ?? "",
    image,
    illustration: illustration as SceneName | undefined,
  });
}
