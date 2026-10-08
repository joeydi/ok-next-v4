import { audiences } from "./catalog";
import { type Testimonial, testimonials } from "./home";

/** Copy for the agencies page, `/agencies` (how agencies work with me), on top of its catalog entry. */

export type AgencyUse = {
  /** The service it leads to. */
  k: string;
  t: string;
  d: string;
  href: string;
};

export const agencies = {
  ...audiences.agencies,
  /** H1 lines; text wrapped in *asterisks* renders in pink. */
  h1: ["An extra", "*pair of hands.*"],
  intro:
    "Agencies call me when the team is booked, the deadline isn’t moving, or the idea needs something nobody in-house has built before. I spent years on the agency side at Park&Co, so I know how a project moves between strategy, design and the client, and I fit into yours without slowing it down.",
  uses: {
    eyebrow: "How agencies use me",
    heading: "Wherever you’re stretched.",
    items: [
      {
        k: "Design & development",
        t: "Overflow builds",
        d: "Marketing sites, microsites and campaign pages built to your designs and your deadline.",
        href: "/design-development",
      },
      {
        k: "Design & development",
        t: "The hard stuff",
        d: "3D, motion, interactive and data work your client is asking for and your team hasn’t built before.",
        href: "/design-development",
      },
      {
        k: "CMS & integrations",
        t: "Backend and integrations",
        d: "WordPress builds that connect to Salesforce, CRMs and APIs, and migrations nobody else wants to own.",
        href: "/cms-integrations",
      },
      {
        k: "Website care",
        t: "After launch",
        d: "White-label website care for the sites you ship: updates, monitoring and change hours under your name, so you don’t have to staff support.",
        href: "/website-care",
      },
    ] satisfies AgencyUse[],
  },
  situations: {
    eyebrow: "Sound familiar?",
    heading: "When to call.",
    items: [
      { n: "01", t: "Your developers are booked and a new project just signed." },
      { n: "02", t: "The pitch promised something the team hasn’t built before." },
      { n: "03", t: "You need someone who reads a brand guide as carefully as a codebase." },
      { n: "04", t: "A client wants support after launch, and nobody wants to be on call for it." },
    ],
  },
  together: {
    eyebrow: "How we work together",
    heading: "Your process, not mine.",
    items: [
      "Your process and your tools: Slack, Asana or Jira, your repo, your staging.",
      "White-label or credited, whichever the client relationship needs. Happy to sign an NDA.",
      "I can talk to your client directly or stay behind the scenes.",
      "Start with one project, estimated up front in hours or as a fixed price.",
    ],
  },
  quote: {
    ...testimonials.kathleen,
    q: "Joe is an extremely skilled web designer, developer and digital problem solver. For many of our online projects, he’s been an instrumental part of our process including planning, assessing and developing.",
  } satisfies Testimonial,
  contactNote: "Tell me about the project, the deadline, and how much of it you need covered.",
};
