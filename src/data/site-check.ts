import { care } from "./care";

/**
 * Copy for the free site check, `/site-check`.
 * What it looks at is the website care page's list, so the two can't drift.
 * `*word*` in a heading renders pink.
 */
export const siteCheck = {
  metaTitle: "Free website health check: security, speed & SEO",
  metaDescription:
    "Paste your URL and watch an outside-in check of your website’s security, updates, speed, accessibility, links and SEO. Free, with no logins.",

  eyebrow: "Free site check",
  details: ["No logins", "About a minute"],
  h1: "How’s your site *holding up?*",
  intro:
    "Paste your URL and watch the checks run. It’s the same outside-in look I take at every new care client’s site: no logins, no cost, about a minute.",

  field: "Your website address",
  prompt: "$ check",
  placeholder: "yourorganization.org",
  invalid: "That doesn’t look like a web address. Try something like yourorganization.org.",
  run: { idle: "Run the check", running: "Running", again: "Run it again", retry: "Try again" },

  lookLabel: "What I look at",
  items: care.siteCheck.items,
  closing: care.siteCheck.closing,

  logLabel: "Check log",
  done: "These checks are automated. For a personal review, leave your email below.",
  /** Under a failed run, by why it failed. */
  failed: {
    "invalid-url": "Check the address and try again.",
    unreachable: "Check the address and try again, or email me and I’ll take a look.",
    timeout: "Try again in a minute, or email me and I’ll take a look.",
    blocked: "Its firewall turns automated checks away. Email me and I’ll take a look myself.",
    "rate-limited": "Try again a little later, or email me and I’ll take a look.",
    busy: "Lots of people are checking sites right now. Try again in a few minutes, or email me and I’ll take a look.",
  },

  scoreLabel: "Your score",
  scoreNote: "Each bar fills in as its checks finish. Your score lands when the last one does.",
  pending: "Working it out…",
  /** The verdict under the score: the first band the score reaches. */
  verdicts: [
    { min: 90, t: "In good shape." },
    { min: 70, t: "Mostly healthy, with a few things I’d fix soon." },
    { min: 50, t: "Holding up, but a few things need attention." },
    { min: 0, t: "Worth a closer look soon." },
  ],

  review: {
    heading: "Now let me take a look.",
    body: "The score covers what a script can see. Leave your email and I’ll go through the site myself, then send a one-page report: what’s healthy, what’s at risk, and what I’d fix first.",
    label: "Email",
    placeholder: "you@yourorganization.org",
    cta: "Send me the review",
    note: "No cost and no obligation. If your site is in good shape, I’ll tell you that too.",
    error: "That didn’t send. Try again, or email me at",
    errors: {
      "bad-email": "That doesn’t look like an email address. Check it for typos and try again.",
      "disposable-email": "That looks like a temporary inbox. Use an address you read, so I can send the report.",
      "no-mail-server": "That domain doesn’t seem to receive email. Check the address for typos.",
      "email-limit": "That address already has requests in today. Check your inbox, or try again tomorrow.",
      "already-requested": "A review is already on its way for this check. Look for the confirmation email.",
      "rate-limited": "That’s a lot of requests. Give it a little while and try again.",
    },
  },
  sent: {
    label: "Check your inbox",
    heading: "*Almost there.* Confirm your email.",
    booking: "Rather talk it through? Book a 20-min call",
  },
} as const;

export const verdictFor = (score: number) =>
  siteCheck.verdicts.find((v) => score >= v.min)?.t ?? siteCheck.verdicts[siteCheck.verdicts.length - 1].t;
