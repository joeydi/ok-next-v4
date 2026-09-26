import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

type ContainerProps<T extends ElementType> = { as?: T } & ComponentPropsWithoutRef<T>;

/**
 * Page-width block: gutter padding, capped at `--container-page` and centred.
 * Full-bleed backgrounds (the footer, the About photo) go on a parent; put this inside.
 */
export function Container<T extends ElementType = "div">({ as, className, ...props }: ContainerProps<T>) {
  const Tag: ElementType = as ?? "div";
  return <Tag className={cn("mx-auto w-full max-w-page px-page", className)} {...props} />;
}
