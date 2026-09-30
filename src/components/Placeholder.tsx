import { cn } from "@/lib/cn";
import type { Media } from "@/lib/media";
import { mediaUrl } from "@/lib/media-url";
import { MediaImage } from "./MediaImage";
import { Video } from "./Video";

/**
 * Image/video slot, filled to the size set by `className`. Renders the design's
 * striped, labelled placeholder until `media` (from `getMedia`) is supplied.
 * `alt` defaults to the manifest's; placeholders are hidden from assistive tech unless given one.
 * `natural` sizes the slot to the media's own aspect ratio instead of the one in `className`.
 */
export function Placeholder({
  label,
  media,
  alt,
  sizes = "100vw",
  dark = false,
  small = false,
  priority = false,
  natural = false,
  className,
}: {
  label: string;
  media?: Media;
  alt?: string;
  sizes?: string;
  dark?: boolean;
  small?: boolean;
  priority?: boolean;
  natural?: boolean;
  className?: string;
}) {
  if (media) {
    return (
      <div
        className={cn("frame relative overflow-hidden bg-sand", className)}
        style={{ backgroundColor: media.color, aspectRatio: natural ? `${media.width} / ${media.height}` : undefined }}
      >
        {media.type === "video" ? (
          <Video media={media} alt={alt} className="absolute inset-0" />
        ) : (
          <MediaImage
            src={media.type === "svg" ? mediaUrl(media.key) : media.key}
            unoptimized={media.type === "svg"}
            alt={alt ?? media.alt}
            fill
            sizes={sizes}
            priority={priority}
            placeholder={media.blurDataURL ? "blur" : "empty"}
            blurDataURL={media.blurDataURL}
            className="object-cover"
          />
        )}
      </div>
    );
  }
  return (
    <div
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      className={cn(
        "frame flex items-end text-muted",
        dark ? "stripes-dark" : "stripes",
        small ? "p-fl-12 font-mono text-fl-12" : "mono-text p-fl-20",
        className,
      )}
    >
      {label}
    </div>
  );
}
