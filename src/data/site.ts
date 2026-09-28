export const SITE = {
  name: "Okayplus",
  url: "https://okaypl.us",
  author: "Joe di Stefano",
  tagline: "Designer + developer",
  location: "Burlington, Vermont",
  email: "joeydi@okaypl.us",
  description:
    "Joe di Stefano is a designer and developer in Burlington, Vermont, helping small teams, agencies, and non-profits figure out what's worth building, then build it well.",
  bookingUrl: "https://calendly.com/joe-simplecreature/20-minute-discovery-call",
} as const;

export type NavLink = { label: string; href: string; children?: readonly NavLink[] };

/** `children` show in a dropdown under their parent on desktop. Service titles match `src/data/services.ts`, kept apart so the client nav doesn't bundle the page copy. */
export const NAV: readonly NavLink[] = [
  { label: "Approach", href: "/#approach" },
  {
    label: "Services",
    href: "/#services",
    children: [
      { label: "Digital production", href: "/digital-production" },
      { label: "CMS & integrations", href: "/cms-integrations" },
      { label: "Business tools", href: "/business-tools" },
    ],
  },
  { label: "About", href: "/#about" },
  { label: "Notes", href: "/notes" },
];

export const CONTACT_HREF = "/#contact";
