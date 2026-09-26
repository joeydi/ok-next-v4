export const SITE = {
  name: "Okayplus",
  url: "https://okaypl.us",
  author: "Joe di Stefano",
  tagline: "Designer + developer",
  location: "Burlington, Vermont",
  email: "joe@okaypl.us",
  description:
    "Joe di Stefano is a designer and developer in Burlington, Vermont, helping small teams, agencies, and non-profits figure out what's worth building, then build it well.",
  /** Scheduling link for "Book a 20-min call" — replace once it exists. */
  bookingUrl: "#",
} as const;

export const NAV = [
  { label: "Approach", href: "/#approach" },
  { label: "Services", href: "/#services" },
  { label: "About", href: "/#about" },
  { label: "Notes", href: "/notes" },
] as const;

export const CONTACT_HREF = "/#contact";
