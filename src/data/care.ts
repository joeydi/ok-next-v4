import { type Testimonial, testimonials } from "./home";

/**
 * Copy for the website care page, `/website-care` (dev-only until it launches).
 * Its sections don't fit the `Service` shape, so it isn't in `services` yet, which
 * also keeps it off the home page's service cards and llms.txt.
 */

export type CareTier = {
  name: string;
  hours: number;
  /** `hours` is a floor: the plan is sized to the work. */
  more?: boolean;
  /** Monthly price; `null` for a plan that's quoted. */
  price: string | null;
  d: string;
  featured?: boolean;
};

export type CareClient = {
  name: string;
  place: string;
  /** First year of the relationship. */
  since: number;
  href?: string;
};

export const care = {
  title: "Website care",
  /** The `<title>`, before the layout's " — Okayplus": what people search for, not the page's name. */
  metaTitle: "WordPress maintenance & care plans for non-profits",
  metaDescription:
    "WordPress maintenance for non-profits and teams that rely on their website: updates, security, monitoring, a monthly report, and someone who knows your site.",
  audience: "WordPress sites",
  /** Who it's for, in the JSON-LD; `audience` above is the hero's label. */
  audienceType: "Non-profits, foundations and other organizations without a web team",
  /** H1 lines; text wrapped in *asterisks* renders in pink. */
  h1: ["Keep it running.", "*Keep it moving.*"],
  intro:
    "Ongoing WordPress maintenance, monitoring, and hands-on support for non-profits, foundations, and other organizations that rely on their website but don’t need a full-time web team.",
  tagline: "For the website that’s nobody’s full-time job.",

  overview: {
    eyebrow: "Website care",
    heading: "Your website isn’t finished when it launches.",
    body: [
      "WordPress changes. Plugins need updates. Certificates expire. Links break. Content gets stale. And inevitably, someone needs a page changed by Thursday.",
      "Website care covers both sides: keeping the site healthy behind the scenes, and having someone who already knows it on hand when something needs to change.",
    ],
    halves: [
      {
        k: "Maintenance + monitoring",
        t: "Keep it running",
        d: "Updates, uptime, security, performance, backups, domains and certificates, watched all month and dealt with as they come up.",
        href: "#maintenance",
      },
      {
        k: "Included hours",
        t: "Keep it moving",
        d: "Hours every month for the changes that keep piling up, handled by someone who already knows the site.",
        href: "#hours",
      },
    ],
  },

  maintenance: {
    eyebrow: "Maintenance + monitoring",
    heading: "WordPress maintenance that keeps the lights on.",
    intro:
      "Most website problems don’t announce themselves until something breaks, often to a visitor before anyone inside notices.",
    body: "Uptime is watched continuously, performance and validation daily, and everything else on its own schedule. When something needs attention, I deal with it when it appears, not when the monthly report goes out.",
    groups: [
      {
        k: "Updates & upkeep",
        items: [
          "WordPress core updates, applied and verified",
          "Plugin and theme updates, applied and verified",
          "A review of every installed plugin and theme, flagging anything abandoned or without a release in two years",
          "Server checks: PHP version, memory limits, and warning well before a PHP release reaches end of life",
          "Database review: table sizes, growth, and cleanup where it’s warranted",
        ],
      },
      {
        k: "Security & integrity",
        items: [
          "SSL certificate monitoring, grading and expiry warnings",
          "Domain and DNS monitoring, with renewal warnings well ahead of expiry",
          "User account review: who has access, and at what level",
          "Error and access log review, including scanning and intrusion attempts",
          "WordPress Site Health checks, with critical items resolved",
          "Offsite backups verified, with each month’s snapshot on record",
        ],
      },
      {
        k: "Performance & quality",
        items: [
          "Lighthouse audits for performance, accessibility, best practices and SEO",
          "Third-party speed checks: GTmetrix, Pingdom and PageSpeed Insights",
          "Accessibility scanning, with errors and contrast issues itemized",
          "HTML validation against the W3C validator",
          "Broken link and 404 review, with redirects added as needed",
        ],
      },
      {
        k: "Availability",
        items: ["Continuous uptime monitoring with alerts", "Uptime percentage and any incidents reported each month"],
      },
      {
        k: "Content & activity",
        items: [
          "Comment and spam review",
          "A log of what was published, edited or removed",
          "Form submissions and analytics, month over month",
        ],
      },
    ],
  },

  hours: {
    eyebrow: "Included hours",
    heading: "Someone who already knows your site.",
    intro: "The other half of website care is having someone on hand when things change.",
    situations: [
      "A new page needs to go live.",
      "A campaign launches next week.",
      "Someone needs a form changed.",
      "Something looks wrong on mobile.",
      "A plugin stops behaving.",
    ],
    body: "You don’t have to find a developer, explain how the site works, hand over credentials, and wait for them to get oriented.",
    kicker: "I’m already there.",
    usesLabel: "Use your hours for",
    uses: [
      "Content and image updates",
      "New pages and landing pages",
      "Layout and design changes",
      "Form updates",
      "Bug fixes",
      "Analytics and tracking",
      "Plugin configuration",
      "Small features and improvements",
    ],
    note: "Send requests as they come up. I’ll handle them within the included time and give you a heads up when something is likely to go beyond it.",
  },

  ready: {
    eyebrow: "Already in place",
    heading: "Ready when something comes up.",
    items: [
      {
        t: "A dev environment, already set up",
        d: "Your site keeps a development copy that syncs from production in one click, so changes are tested against what’s live today.",
      },
      {
        t: "Working knowledge of your site",
        d: "I know the theme, plugins, customizations, integrations and history. That context doesn’t have to be rebuilt for every request.",
      },
      {
        t: "A person you know how to reach",
        d: "When something is wrong, you’re not opening a ticket with someone who’s never seen the site before.",
      },
      {
        t: "Bigger work starts at full speed",
        d: "When a request goes beyond the included hours, the setup and orientation are already done, so the time goes into the work itself.",
      },
    ],
  },

  report: {
    eyebrow: "Monthly report",
    heading: "A monthly checkup, in writing.",
    body: "Each month you get a straightforward report on the health of your site and the work that’s been done.",
    items: [
      "Updates applied",
      "Issues found and resolved",
      "Uptime and performance",
      "Security and accessibility checks",
      "Work completed this month",
      "What deserves attention next",
    ],
    closing: "No dashboard to remember to check. Just a clear record of how your site is doing.",
  },

  plans: {
    eyebrow: "Plans",
    heading: "Same care, *more hours.*",
    intro:
      "Every plan includes all of the maintenance and monitoring above, plus the monthly report. The difference is how many hours you get for changes.",
    includes: "Maintenance · Monitoring · Monthly report",
    // Draft tiers: Essentials matches the SCRS proposal (Sep 2026), Care the last plan sold.
    tiers: [
      {
        name: "Essentials",
        hours: 1,
        price: "$250",
        d: "For a steady site that mostly needs looking after, with time for small fixes and edits.",
      },
      {
        name: "Care",
        hours: 8,
        price: "$1,000",
        d: "For a site that changes every month: new pages, campaigns, forms and fixes.",
        featured: true,
      },
      {
        name: "Partner",
        hours: 16,
        more: true,
        price: null,
        d: "For organizations whose website is central to the work, with room for ongoing improvements.",
      },
    ] satisfies CareTier[],
    terms: [
      "Month to month. No long-term contract; either of us can end it with 30 days’ notice.",
      "Included hours reset each month and don’t roll over.",
      "More than one site? Additional sites join the same plan at a reduced rate.",
      "Work beyond the included hours is billed hourly, quoted and approved before it starts.",
      "Hosting, domains and premium plugin licenses are billed to you directly.",
    ],
    notIncluded:
      "New site builds and redesigns, large new features, content writing, SEO campaigns, advertising and email marketing aren’t part of the plan, but any of them can be quoted separately.",
  },

  /** The free, no-commitment first step for visitors not ready to pick a plan. Linked as `/website-care#site-check`. */
  siteCheck: {
    eyebrow: "Free site check",
    heading: "Not sure where your site stands?",
    intro:
      "Send me your URL and I’ll review your site the same way I would for a new care client, from the outside, with no logins needed. You’ll get a one-page report: what’s healthy, what’s at risk, and what I’d fix first. No cost and no obligation.",
    hero: "Not sure yet? Start with a free site check",
    listLabel: "What I look at",
    // Only what can be checked from outside, without admin access.
    items: [
      "WordPress, plugin and theme versions, and anything outdated or abandoned",
      "SSL certificate and domain expiry",
      "Speed and Lighthouse scores on key pages",
      "Accessibility errors and contrast issues",
      "Broken links and 404s",
      "Basic SEO: titles, descriptions, indexing",
    ],
    closing: "If it turns out your site is in good shape, I’ll tell you that too.",
    cta: "Request a free site check",
    href: "/site-check",
    booking: "or book a 20-min call",
  },

  start: {
    eyebrow: "Getting started",
    heading: "Up and running in a week.",
    steps: [
      { n: "01", t: "Pick a plan", d: "A short call to talk through your site and choose the hours that fit." },
      { n: "02", t: "Hand over access", d: "Hosting, WordPress admin and domain registrar access, shared securely." },
      {
        n: "03",
        t: "Baseline audit",
        d: "In the first week I audit the site and send a starting-point report with anything urgent called out.",
      },
      {
        n: "04",
        t: "Ongoing care",
        d: "Maintenance starts right away, and the first monthly report arrives the following month.",
      },
    ],
  },

  clients: {
    eyebrow: "Long-term clients",
    heading: "Organizations that have stayed for years.",
    intro:
      "I work from Burlington, Vermont, with organizations across the country. Some of them have been with me for more than a decade.",
    items: [
      { name: "Education Forward Arizona", place: "Phoenix, Arizona", since: 2012 },
      {
        name: "Frank Lloyd Wright Foundation",
        place: "Scottsdale, Arizona",
        since: 2017,
        href: "/notes/frank-lloyd-wright-foundation",
      },
      { name: "Columbia Capital", place: "Alexandria, Virginia", since: 2018, href: "/notes/columbia-capital" },
    ] satisfies CareClient[],
  },

  // Placeholder until the FLW, EFA and Columbia Capital testimonials come in.
  quote: testimonials.tom satisfies Testimonial,
  contactNote:
    "If your website matters to the organization but looking after it isn’t anyone’s full-time job, website care gives it an owner. Tell me about your site.",
};
