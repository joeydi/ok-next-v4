import type { Testimonial as T } from "@/data/home";
import { Avatar } from "./Avatar";

export function Cite({ t }: { t: T }) {
  return (
    <figcaption className="flex items-center gap-fl-16">
      <Avatar initials={t.initials} />
      <span className="flex flex-col gap-1">
        <span className="mono-label">{t.name}</span>
        <span className="text-fl-14 text-muted-on-dark">{t.role}</span>
      </span>
    </figcaption>
  );
}
