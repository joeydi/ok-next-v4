import { care } from "./care";
import { audiences } from "./catalog";
import { type Testimonial, testimonials } from "./home";
import type { Work } from "./services";

/** Copy for the non-profits page, `/non-profits` (the path a relationship usually takes), on top of its catalog entry. */

export type PathStep = {
  n: string;
  t: string;
  d: string;
  href: string;
  /** The link's label: the page it leads to. */
  label: string;
};

export type FaqItem = { q: string; a: string };

export const nonProfits = {
  ...audiences["non-profits"],
  /** H1 lines; text wrapped in *asterisks* renders in pink. */
  h1: ["A web team,", "*without*", "*hiring one.*"],
  intro:
    "Most non-profits I work with have one or two people running communications, a website someone else built, and systems that should talk to each other but don’t. I look after the site, connect it to the tools you already use, and help you plan the next version when it’s time.",
  cta: { label: "Start with a free site check", href: "/site-check" },
  booking: "or book a 20-min call",
  path: {
    eyebrow: "Where I usually come in",
    heading: "One step at a time.",
    items: [
      {
        n: "01",
        t: "Free site check",
        d: "A quick, outside-in look at what’s healthy and what’s at risk. No logins, no cost.",
        href: "/site-check",
        label: "Free site check",
      },
      {
        n: "02",
        t: "Website care",
        d: "Updates, monitoring and a monthly report, plus hours for the changes that keep piling up.",
        href: "/website-care",
        label: "Website care",
      },
      {
        n: "03",
        t: "Connect your systems",
        d: "Member logins checked against Salesforce, forms that land in your CRM, content migrated off a platform you’ve outgrown.",
        href: "/cms-integrations",
        label: "CMS & integrations",
      },
      {
        n: "04",
        t: "Redesign when it’s time",
        d: "Because I already know the site, the next version starts from what works.",
        href: "/design-development",
        label: "Design & development",
      },
    ] satisfies PathStep[],
    note: "Some organizations start at step 1 and stay at step 2 for a decade. That’s fine too.",
  },
  situations: {
    eyebrow: "Sound familiar?",
    heading: "When to call.",
    items: [
      { n: "01", t: "The agency that built your site has moved on." },
      { n: "02", t: "Updating the homepage means emailing someone and waiting." },
      { n: "03", t: "Your website and Salesforce don’t know about each other." },
      { n: "04", t: "The board asked whether the site is accessible, and nobody’s sure." },
      { n: "05", t: "The big campaign or event is coming and the site is the last thing ready." },
    ],
  },
  fit: {
    eyebrow: "How I work",
    heading: "Built for how non-profits work.",
    items: [
      {
        t: "Budgets",
        d: "Month-to-month care and estimates approved before work starts, so there are no surprises at the board meeting.",
      },
      { t: "Accessibility", d: "Sites built and tested to WCAG 2.2 AA, and checked again after updates." },
      {
        t: "Staff turnover",
        d: "Documentation and training, so the site doesn’t leave with the person who knew how it worked.",
      },
      { t: "Reporting", d: "A monthly report you can forward to your ED or board as is." },
    ],
  },
  clients: {
    eyebrow: "Long-term clients",
    heading: "Organizations that have stayed for years.",
    intro:
      "I work from Burlington, Vermont, with organizations across the country. Two of the longest relationships are with Arizona non-profits.",
    /** The website care page's client list, less Columbia Capital, which isn't a non-profit. */
    items: care.clients.items.filter((c) => c.name !== "Columbia Capital"),
    workHeading: "Case studies",
    work: [
      {
        title: "Frank Lloyd Wright Foundation",
        d: "A custom WordPress portal with passwordless, Salesforce-verified sign-in, giving Foundation members access to Quarterly back issues, members-only events and partner benefits.",
        tags: "WordPress · Salesforce · GSAP",
        image: "notes/frank-lloyd-wright-foundation/flw-members-quarterly-archive-v2.png",
        imageLabel: "image — FLW members portal",
        href: "/notes/frank-lloyd-wright-foundation",
      },
      {
        title: "Arizona Education Progress Meter",
        d: "A headless WordPress CMS, React front end and Mapbox maps for a statewide dashboard tracking Arizona’s progress toward its Achieve60 AZ goal.",
        tags: "Headless CMS · React · Mapbox GL",
        imageLabel: "image — progress map",
        href: "/notes/arizona-education-progress-meter",
      },
    ] satisfies Work[],
  },
  faq: {
    eyebrow: "Questions",
    heading: "Good to know.",
    items: [
      {
        q: "Do you work with organizations outside Vermont?",
        a: "Yes. Two of my longest relationships are with organizations in Arizona.",
      },
      {
        q: "Can you take over a site someone else built?",
        a: "Yes. That’s how most care relationships start.",
      },
      {
        q: "Do you need to move our hosting?",
        a: "No. I work with your current host unless there’s a reason to change.",
      },
    ] satisfies FaqItem[],
  },
  // Placeholder, as on website care, until a non-profit client's quote about years of care comes in.
  quote: testimonials.tom satisfies Testimonial,
  contactNote: "Start with a free site check, or tell me what’s going on with your site.",
};
