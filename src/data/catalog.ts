/**
 * What every service and audience page shares, listed once in the nav's order: the
 * home cards, sitemap, llms.txt, notes' service links and JSON-LD all read it. Each
 * page's own copy builds on its entry: the templated service pages in `services.ts`,
 * website care in `care.ts`, non-profits in `non-profits.ts`, agencies in `agencies.ts`. The nav (`site.ts`) keeps
 * its own labels, so the client bundle doesn't carry this.
 */

export type ServiceSlug = "website-care" | "design-development" | "cms-integrations" | "business-tools";

export type ServiceSummary = {
  slug: ServiceSlug;
  title: string;
  /** The `<title>`, before the layout's " — Okayplus", when what people search for reads better than the page's name. Defaults to `title`. */
  metaTitle?: string;
  metaDescription: string;
  /** The hero's label and the home card's eyebrow. */
  audience: string;
  /** Who the service is for, in the JSON-LD (defaults to `audience`). */
  audienceType?: string;
  /** What the service is, in the JSON-LD (defaults to `title`). */
  serviceType?: string;
  intro: string;
  tagline: string;
};

export const services: Record<ServiceSlug, ServiceSummary> = {
  "website-care": {
    slug: "website-care",
    title: "Website care",
    metaTitle: "WordPress maintenance & care plans for non-profits",
    metaDescription:
      "WordPress maintenance for non-profits and teams that rely on their website: updates, security, monitoring, a monthly report, and someone who knows your site.",
    audience: "WordPress sites",
    audienceType: "Non-profits, foundations and other organizations without a web team",
    intro:
      "Ongoing WordPress maintenance, monitoring, and hands-on support for non-profits, foundations, and other organizations that rely on their website but don’t need a full-time web team.",
    tagline: "For the website that’s nobody’s full-time job.",
  },

  "design-development": {
    slug: "design-development",
    title: "Design & development",
    metaTitle: "Website design, development & redesigns",
    metaDescription:
      "New websites, redesigns and campaign builds for non-profits, foundations and marketing teams, designed and built by one person from first call to launch.",
    audience: "New sites + redesigns",
    audienceType: "Non-profits, foundations and marketing teams",
    serviceType: "Website design and development",
    intro:
      "Marketing teams and non-profits bring me in to turn a plan, a brand or a campaign idea into a website that ships on time and stays easy to run. I design it, build it, and stick around after launch.",
    tagline: "For when the launch date is already on the calendar.",
  },

  "cms-integrations": {
    slug: "cms-integrations",
    title: "CMS & integrations",
    metaDescription:
      "Large CMS projects, content migrations, and backend integrations for non-profits and other large organizations.",
    audience: "Non-profits + large orgs",
    intro:
      "I manage large CMS projects, content migrations, and backend integrations for non-profits and other large organizations, connecting content and systems without disrupting the people who depend on them.",
    tagline: "For when nobody remembers why it works that way.",
  },

  "business-tools": {
    slug: "business-tools",
    title: "Business tools",
    metaDescription:
      "Internal tools that help teams work better: visibility into your data and knowledge, automation that clears bottlenecks, and monitoring for critical processes.",
    audience: "Internal teams",
    intro:
      "I build internal tools that give teams better access to their data and knowledge, automate repetitive work, and monitor the processes they depend on.",
    tagline: "For the spreadsheet everyone’s afraid to touch.",
  },
};

export type AudienceSlug = "non-profits" | "agencies";

export type AudienceSummary = {
  slug: AudienceSlug;
  title: string;
  /** The `<title>`, before the layout's " — Okayplus". */
  metaTitle: string;
  metaDescription: string;
  /** The hero's label. */
  audience: string;
  /** Who the page is for, in the JSON-LD. */
  audienceType: string;
  /** What's offered to them, in the JSON-LD. */
  serviceType: string;
};

/** The "Who I work with" pages. */
export const audiences: Record<AudienceSlug, AudienceSummary> = {
  "non-profits": {
    slug: "non-profits",
    title: "Non-profits",
    metaTitle: "Websites for non-profits & foundations",
    metaDescription:
      "For non-profits and foundations without a web team: WordPress care, Salesforce and CMS integrations, and redesigns. Start with a free site check.",
    audience: "Non-profits + foundations",
    audienceType: "Non-profits, foundations, museums and education organizations without a web team",
    serviceType: "Website care, integrations and redesigns for non-profits",
  },

  agencies: {
    slug: "agencies",
    title: "Agencies",
    metaTitle: "White-label web development for agencies",
    metaDescription:
      "Development help for agencies: overflow builds, special projects and white-label website care, from a designer-developer who has worked inside an agency.",
    audience: "Agencies",
    audienceType: "Creative, marketing and digital agencies",
    serviceType: "White-label web development",
  },
};
