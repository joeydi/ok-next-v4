import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Figure, Lead, Profile, PullQuote, TocAnchor } from "@/components/mdx";

const components: MDXComponents = {
  Lead,
  Figure,
  Profile,
  PullQuote,
  TocAnchor,
  a: ({ href = "", ...props }) =>
    href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href} {...props} />
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
