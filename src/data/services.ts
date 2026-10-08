import type { MediaKey } from "@/lib/media";
import { services as catalog, type ServiceSlug, type ServiceSummary } from "./catalog";
import { type Testimonial, testimonials } from "./home";

/** The service pages drawn by the `ServicePage` template; website care has its own page. */
export type ServicePageSlug = Exclude<ServiceSlug, "website-care">;

/** `imageLabel` labels the placeholder until there's media: `image` (an R2 key), or else the image of the note `href` links to. */
export type Work = { title: string; d: string; tags: string; image?: MediaKey; imageLabel: string; href?: string };

/** A service page: its entry in the catalog plus the template's copy. */
export type Service = ServiceSummary & {
  slug: ServicePageSlug;
  /** H1 lines; text wrapped in *asterisks* renders in pink. */
  h1: string[];
  illustration: "bounce-row" | "conveyor" | "ring";
  capabilities: {
    heading: string;
    eyebrow: string;
    items: { n: string; k: string; t: string; d: string; ex: string }[];
  };
  situations: { heading: string; items: { n: string; t: string }[] };
  process: { heading: string; items: { n: string; t: string; d: string; link?: { label: string; href: string } }[] };
  /** One item shows large; two or more show as a row of cards under `heading`. */
  work: { heading?: string; items: Work[] };
  quote: Testimonial;
  contactNote: string;
};

export const servicePages: Record<ServicePageSlug, Service> = {
  "design-development": {
    ...catalog["design-development"],
    slug: "design-development",
    h1: ["Build the", "*big idea.*"],
    illustration: "bounce-row",
    capabilities: {
      eyebrow: "What I build",
      heading: "Everything the launch needs.",
      items: [
        {
          n: "01",
          k: "Websites",
          t: "New sites and redesigns",
          d: "A site designed around what your visitors need to do, built in WordPress or headless, and set up so your team can edit it without calling me.",
          ex: "WordPress · Headless · Redesigns",
        },
        {
          n: "02",
          k: "Campaigns",
          t: "From campaign to launch",
          d: "Landing pages, microsites and emails that carry a campaign from the strategy deck to the live link, on brand and on deadline.",
          ex: "Landing pages · Microsites · Email",
        },
        {
          n: "03",
          k: "Special builds",
          t: "The hard stuff",
          d: "3D, motion and interactive work that templates can’t do: product tours, data maps, scroll-driven stories.",
          ex: "3D · Motion · Data visualization",
        },
        {
          n: "04",
          k: "Measurement",
          t: "Measured from day one",
          d: "Tracking and reporting set up before launch, so you can see what the work is doing instead of guessing.",
          ex: "Analytics · Dashboards · Reporting",
        },
      ],
    },
    situations: {
      heading: "Sound familiar?",
      items: [
        { n: "01", t: "The launch date is set and the site isn’t built." },
        { n: "02", t: "Your current site was built for how you worked five years ago." },
        { n: "03", t: "The concept needs 3D, motion or a map, and the template can’t do it." },
        { n: "04", t: "The last campaign ran and nobody knows how it did." },
        { n: "05", t: "Every edit means emailing a developer." },
      ],
    },
    process: {
      heading: "Quick, not careless.",
      items: [
        {
          n: "01",
          t: "Get the brief",
          d: "A call with your team to understand the strategy, the brand, and the deadline.",
        },
        { n: "02", t: "Scope it", d: "A clear plan for what gets built, by when, and what I need from you." },
        {
          n: "03",
          t: "Build in the open",
          d: "Frequent previews so your team sees progress and gives feedback early.",
        },
        {
          n: "04",
          t: "Launch and measure",
          d: "Tracking in place at launch, and a clear read on how it’s performing.",
        },
        {
          n: "05",
          t: "Keep it running",
          d: "After launch, Website care keeps the site updated and gives you hours for changes.",
          link: { label: "Website care", href: "/website-care" },
        },
      ],
    },
    work: {
      heading: "Recently shipped.",
      items: [
        {
          title: "Queen City Development Group",
          d: "A new logo, brand guidelines and website for a Burlington, Vermont firm that works across construction, design & development, investment and property management.",
          tags: "Branding · WordPress · Front + back end",
          imageLabel: "image — QCDG brand guidelines",
          href: "/notes/queen-city-development-group",
        },
        {
          title: "Rigorous",
          d: "A headless WordPress and Next.js site for a robotics company, with more than 40 custom components, an animated safety path and a customer control panel.",
          tags: "Headless WordPress · Next.js · Design system",
          imageLabel: "image — Rigorous homepage",
          href: "/notes/rigorous",
        },
        {
          title: "ThinkMD",
          d: "A new interface and a library of 3D clinical illustrations for an app that helps health workers of every skill level assess and treat patients, even offline.",
          tags: "UX/UI design · 3D illustration · Animation",
          imageLabel: "image — ThinkMD app",
          href: "/notes/thinkmd",
        },
      ],
    },
    quote: testimonials.tom,
    contactNote: "Tell me about the launch date.",
  },

  "cms-integrations": {
    ...catalog["cms-integrations"],
    slug: "cms-integrations",
    h1: ["Content,", "*connected.*"],
    illustration: "conveyor",
    capabilities: {
      eyebrow: "What I do",
      heading: "Four ways in.",
      items: [
        {
          n: "01",
          k: "WordPress",
          t: "Custom WordPress, built to be edited",
          d: "Custom themes and blocks built around how your team actually publishes, so updating the site doesn’t require a developer.",
          ex: "Custom themes · Custom blocks · Multisite",
        },
        {
          n: "02",
          k: "Integrations",
          t: "Connect the systems you already use",
          d: "I connect your website to your CRM, mailing list, Salesforce, and other systems, so information moves where it needs to without copy and paste.",
          ex: "Salesforce · CRMs · Mailing lists · APIs",
        },
        {
          n: "03",
          k: "Migrations",
          t: "Move years of content safely",
          d: "Large content migrations, planned and scripted so content, media, metadata, and redirects make the move without anything quietly getting lost along the way.",
          ex: "Content audits · Scripted imports · Redirects",
        },
        {
          n: "04",
          k: "Headless",
          t: "Content without the constraints",
          d: "Headless CMS architecture with a modern front end when you need more flexibility, better performance, or the same content delivered in more than one place.",
          ex: "Headless CMS · React · Custom APIs",
        },
      ],
    },
    situations: {
      heading: "Signs it’s time.",
      items: [
        { n: "01", t: "Updating the homepage means emailing a developer." },
        { n: "02", t: "Your CRM and your website don’t know about each other." },
        { n: "03", t: "There are ten years of content on a platform you’re ready to leave." },
        { n: "04", t: "Someone exports a CSV every week to keep two systems in sync." },
        { n: "05", t: "The site is slow, and nobody is quite sure why." },
      ],
    },
    process: {
      heading: "Measure twice, migrate once.",
      items: [
        {
          n: "01",
          t: "Audit what’s there",
          d: "We inventory the content, integrations, and editors involved, and decide what moves, what changes, and what retires.",
        },
        {
          n: "02",
          t: "Model the content",
          d: "I design content types and fields around how your team publishes, not around the old system’s limits.",
        },
        {
          n: "03",
          t: "Rehearse the move",
          d: "Scripted, repeatable imports we can run, check, and rerun until everything lands where it should.",
        },
        {
          n: "04",
          t: "Launch and hand off",
          d: "Redirects, training, and documentation so your team owns the new site from day one.",
        },
      ],
    },
    work: {
      items: [
        {
          title: "Frank Lloyd Wright Foundation",
          d: "A custom WordPress portal with passwordless, Salesforce-verified sign-in, giving Foundation members access to Quarterly back issues, members-only events and partner benefits.",
          tags: "WordPress · Salesforce · GSAP",
          image: "notes/frank-lloyd-wright-foundation/flw-members-quarterly-archive-v2.png",
          imageLabel: "image — FLW members portal",
          href: "/notes/frank-lloyd-wright-foundation",
        },
      ],
    },
    quote: testimonials.tom,
    contactNote: "Tell me about the system. Let’s Marie Kondo that Rube Goldberg machine.",
  },

  "business-tools": {
    ...catalog["business-tools"],
    slug: "business-tools",
    h1: ["Tools for", "*better work.*"],
    illustration: "ring",
    capabilities: {
      eyebrow: "What I build",
      heading: "Three kinds of tools.",
      items: [
        {
          n: "01",
          k: "Visibility",
          t: "See what your org knows",
          d: "Dashboards and internal search that pull data and knowledge out of scattered spreadsheets, inboxes, and people’s heads, and put it somewhere everyone can use.",
          ex: "Reporting dashboards · Knowledge bases · Data pipelines",
        },
        {
          n: "02",
          k: "Automation",
          t: "Clear the bottlenecks",
          d: "Automation for the repetitive, error-prone steps that slow your team down, so people can spend their time on work that actually needs a person.",
          ex: "Workflow automation · Integrations · Internal apps",
        },
        {
          n: "03",
          k: "Monitoring",
          t: "Know when something changes",
          d: "Quiet, reliable checks on the processes you depend on, with alerts that reach the right person before a small problem becomes a big one.",
          ex: "Alerts · Change tracking · Health checks",
        },
      ],
    },
    situations: {
      heading: "Signs a tool could help.",
      items: [
        { n: "01", t: "The monthly report takes someone a full day to put together." },
        { n: "02", t: "The answer to “where is that?” is usually a person’s name." },
        { n: "03", t: "Two systems hold the same data, and they don’t agree." },
        { n: "04", t: "You find out something broke when a customer tells you." },
        { n: "05", t: "There’s a spreadsheet everyone’s afraid to touch." },
        { n: "06", t: "You vibe-coded a new sales dashboard last weekend, now you want to make it real." },
      ],
    },
    process: {
      heading: "Small, useful, then better.",
      items: [
        {
          n: "01",
          t: "Talk it through",
          d: "We start with a conversation about how the work happens today and where it hurts.",
        },
        {
          n: "02",
          t: "Map the work",
          d: "I sit with the people doing the job and map the data, tools, and handoffs involved.",
        },
        {
          n: "03",
          t: "Build something small",
          d: "We ship the smallest useful version first, so your team can use it and tell me what’s missing.",
        },
        {
          n: "04",
          t: "Make it last",
          d: "Documentation, training, and ongoing support so the tool keeps working after launch.",
        },
      ],
    },
    work: {
      items: [
        {
          title: "Arizona Education Progress Meter",
          d: "A data tool measuring the state’s progress toward its Achieve60 AZ goal, used by policy makers, educators, civic leaders, and business leaders across Arizona.",
          tags: "Headless CMS · React · Custom API · Mapbox GL",
          imageLabel: "screenshot — Education Progress Meter map + indicator chart",
          href: "/notes/arizona-education-progress-meter",
        },
      ],
    },
    quote: {
      ...testimonials.jeremy,
      q: "Joe has a rare combination of being great at both design and development. He designed and developed, in a short amount of time, a geolocation search application that could be customized by third parties in a framework he had little previous experience in.",
    },
    contactNote: "Tell me about the spreadsheet. I’m happy to talk it through.",
  },
};
