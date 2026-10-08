export const SITE = {
  name: "Okayplus",
  /** How people may spell the name when they search for it; in the JSON-LD only. */
  alternateName: "Okay Plus",
  url: "https://okaypl.us",
  author: "Joe di Stefano",
  tagline: "Designer + developer",
  location: "Burlington, Vermont",
  email: "joeydi@okaypl.us",
  phone: "+1-480-459-6720",
  description:
    "Okayplus helps Vermont non-profits, foundations and small teams plan, build and care for their websites. I’m Joe di Stefano, a web designer in Burlington.",
  /** Joe's own profiles, listed on the Person in the JSON-LD. */
  sameAs: ["https://www.linkedin.com/in/joeydi/", "https://x.com/joeydi", "https://github.com/joeydi"],
  /** Okayplus's own profiles, listed on the ProfessionalService in the JSON-LD. */
  orgSameAs: ["https://www.facebook.com/okayplusdesign/"],
  bookingUrl: "https://calendly.com/joe-simplecreature/20-minute-discovery-call",
} as const;

export type NavLink = { label: string; href: string; children?: readonly NavLink[] };

/** `children` show in a dropdown under their parent on desktop. Labels match the titles in `src/data/catalog.ts`, kept apart so the client nav doesn't bundle the catalog. */
export const NAV: readonly NavLink[] = [
  {
    label: "Services",
    href: "/#services",
    children: [
      { label: "Website care", href: "/website-care" },
      { label: "Design & development", href: "/design-development" },
      { label: "CMS & integrations", href: "/cms-integrations" },
      { label: "Business tools", href: "/business-tools" },
    ],
  },
  {
    label: "Who I work with",
    href: "/agencies",
    children: [{ label: "Agencies", href: "/agencies" }],
  },
  { label: "Notes", href: "/notes" },
  { label: "About", href: "/#about" },
];

export const CONTACT_HREF = "/#contact";

/** The dev-only admin tools, listed in the nav and the admin sidebar under `next dev`. */
export const ADMIN_NAV: readonly NavLink[] = [
  { label: "Media", href: "/admin/media" },
  { label: "Open Graph", href: "/admin/og" },
  { label: "Illustrations", href: "/admin/illustrations" },
  { label: "Diagrams", href: "/admin/diagrams" },
  { label: "Logo", href: "/admin/logo" },
];
