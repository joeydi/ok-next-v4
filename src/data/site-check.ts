import { validateSiteCheckCopy } from "@/lib/site-check/copy-schema";
import { care } from "./care";
import rawCopy from "./site-check-copy.json";

export const siteCheckCopy = validateSiteCheckCopy(rawCopy);

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

  scoreLabel: siteCheckCopy.score.label,
  scoreNote: siteCheckCopy.score.note,
  pending: siteCheckCopy.score.pending,
  /** The verdict under the score: the first band the score reaches. */
  verdicts: siteCheckCopy.score.verdicts.map(({ min, message }) => ({ min, t: message })),

  review: siteCheckCopy.review,
  sent: siteCheckCopy.sent,
} as const;

export const verdictFor = (score: number) =>
  siteCheck.verdicts.find((v) => score >= v.min)?.t ?? siteCheck.verdicts[siteCheck.verdicts.length - 1].t;
