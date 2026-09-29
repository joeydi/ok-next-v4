import type { BlogPosting, BreadcrumbList, Graph, Thing } from "schema-dts";
import type { Service } from "@/data/services";
import { SITE } from "@/data/site";
import { getMedia, type Media } from "./media";
import { mediaImageUrl } from "./media-url";
import type { NoteMeta } from "./notes";

// schema.org structured data. The layout emits the site graph (Person,
// ProfessionalService, WebSite) and pages add their own nodes, pointing back at
// those by @id. IDs use SITE.url, not the preview deployment, so they stay stable.

const abs = (path: string) => `${SITE.url}${path}`;

export const ids = {
  person: abs("/#person"),
  org: abs("/#organization"),
  website: abs("/#website"),
};

const ref = (id: string) => ({ "@id": id });

const address = {
  "@type": "PostalAddress",
  addressLocality: "Burlington",
  addressRegion: "VT",
  addressCountry: "US",
} as const;

/** A JPEG URL for an image, or a video's poster frame; SVGs are skipped. */
function imageUrl(media: Media) {
  const key = media.type === "video" ? media.poster : media.type === "image" ? media.key : undefined;
  return key && mediaImageUrl(key, { width: 1200, format: "jpeg" });
}

function breadcrumbs(trail: [name: string, path: string][]): BreadcrumbList {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["Home", "/"] as const, ...trail].map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: abs(path),
    })),
  };
}

export function siteGraph(): Graph {
  const headshot = getMedia("home/headshot.jpg");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": ids.person,
        name: SITE.author,
        jobTitle: SITE.tagline,
        url: SITE.url,
        email: SITE.email,
        image: imageUrl(headshot),
        address,
        sameAs: [...SITE.sameAs],
        worksFor: ref(ids.org),
      },
      {
        "@type": "ProfessionalService",
        "@id": ids.org,
        name: SITE.name,
        url: SITE.url,
        logo: abs("/apple-icon.png"),
        image: abs("/opengraph-image"),
        description: SITE.description,
        email: SITE.email,
        telephone: SITE.phone,
        founder: ref(ids.person),
        address,
        areaServed: "US",
      },
      {
        "@type": "WebSite",
        "@id": ids.website,
        name: SITE.name,
        url: SITE.url,
        inLanguage: "en-US",
        publisher: ref(ids.org),
      },
    ],
  };
}

export function serviceGraph(s: Service): Graph {
  const url = abs(`/${s.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: s.title,
        serviceType: s.title,
        description: s.metaDescription,
        url,
        audience: { "@type": "Audience", audienceType: s.audience },
        provider: ref(ids.org),
        areaServed: "US",
      },
      breadcrumbs([[s.title, `/${s.slug}`]]),
    ],
  };
}

const postId = (slug: string) => abs(`/notes/${slug}#article`);

export function noteGraph(meta: NoteMeta): Graph {
  const url = abs(`/notes/${meta.slug}`);
  const post: BlogPosting = {
    "@type": "BlogPosting",
    "@id": postId(meta.slug),
    headline: meta.plainTitle,
    description: meta.description || undefined,
    url,
    mainEntityOfPage: url,
    datePublished: meta.date,
    image: meta.image && imageUrl(meta.image),
    author: ref(ids.person),
    publisher: ref(ids.org),
    isPartOf: ref(abs("/notes#blog")),
    articleSection: meta.topic ?? meta.tag,
    keywords: meta.tools,
    inLanguage: "en-US",
  };
  // Case studies are about the client's project.
  if (meta.client) {
    post.about = { "@type": "Organization", name: meta.client, url: meta.link } satisfies Thing;
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      post,
      breadcrumbs([
        ["Notes", "/notes"],
        [meta.plainTitle, `/notes/${meta.slug}`],
      ]),
    ],
  };
}

export function notesIndexGraph(notes: NoteMeta[]): Graph {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": abs("/notes#blog"),
        name: `${SITE.name} Notes`,
        url: abs("/notes"),
        author: ref(ids.person),
        publisher: ref(ids.org),
        blogPost: notes.map((n) => ({
          "@type": "BlogPosting",
          "@id": postId(n.slug),
          headline: n.plainTitle,
          url: abs(`/notes/${n.slug}`),
          datePublished: n.date,
        })),
      },
      breadcrumbs([["Notes", "/notes"]]),
    ],
  };
}

/** Renders a graph as an ld+json script, escaping `<` so strings can't close the tag. */
export function JsonLd({ data }: { data: Graph }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON with `<` escaped
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
