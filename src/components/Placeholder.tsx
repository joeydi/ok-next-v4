import Image from "next/image";

/**
 * Image slot. Renders the design's striped, labelled placeholder until a real
 * `src` is supplied. Placeholders are hidden from assistive tech unless given `alt`.
 */
export function Placeholder({
  label,
  src,
  alt = "",
  sizes = "100vw",
  dark = false,
  small = false,
  priority = false,
  className = "",
}: {
  label: string;
  src?: string;
  alt?: string;
  sizes?: string;
  dark?: boolean;
  small?: boolean;
  priority?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-sand ${className}`}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  return (
    <div
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      className={`flex items-end font-mono text-muted ${dark ? "stripes-dark" : "stripes"} ${
        small ? "p-fl-12 text-fl-12" : "p-fl-20 text-fl-14"
      } ${className}`}
    >
      {label}
    </div>
  );
}
