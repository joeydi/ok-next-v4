// A sample run, for reviewing the page's states (`?stage=`) without waiting on the
// checker. `timeline` lays out the same events the checker streams, so `sampleRunAt`
// can stop the clock anywhere. One site's results: a WordPress site in fair shape,
// with figures that agree with each other; the category scores and the overall score
// come from the checks' scores, as the checker's do.

import {
  CATEGORIES,
  type CheckResult,
  checkMeta,
  lastOfCategory,
  overallScore,
  reduceRun,
  type SiteCheckEvent,
  type SiteCheckRun,
  scoreCategory,
} from "./schema";

/** Each check's result, in log order. `at` is filled in from the durations below. */
const RESULTS: Omit<CheckResult, "at">[] = [
  {
    id: "dns",
    status: "ok",
    score: null,
    summary: "Resolves to 2 addresses, served through Cloudflare",
    value: null,
    durationMs: 300,
    data: { addresses: ["104.21.48.12", "172.67.161.30"], cdn: "Cloudflare" },
  },
  {
    id: "https",
    status: "ok",
    score: 100,
    summary: "Certificate valid, renews in 61 days",
    value: "61 days",
    durationMs: 520,
    data: {
      valid: true,
      issuer: "Let’s Encrypt",
      expiresAt: "2026-12-07T00:00:00Z",
      daysLeft: 61,
      redirects: true,
    },
  },
  {
    id: "domain",
    status: "ok",
    score: 100,
    summary: "Registered through August 2028",
    value: "2028",
    durationMs: 680,
    data: {
      domain: "yourorganization.org",
      registrar: "Namecheap",
      expiresAt: "2028-08-14T00:00:00Z",
      daysLeft: 676,
    },
  },
  {
    id: "headers",
    status: "warn",
    score: 55,
    summary: "No Content-Security-Policy or HSTS header",
    value: "2 missing",
    durationMs: 340,
    data: {
      present: ["x-content-type-options", "x-frame-options", "referrer-policy"],
      missing: ["strict-transport-security", "content-security-policy"],
    },
  },
  {
    id: "response",
    status: "ok",
    score: 100,
    summary: "Responding in 412 ms",
    value: "412 ms",
    durationMs: 410,
    data: { status: 200, responseMs: 412 },
  },
  {
    id: "cms",
    status: "warn",
    score: 60,
    summary: "WordPress 7.0.3; 7.1.3 is out",
    value: "7.0.3",
    durationMs: 610,
    data: { name: "wordpress", version: "7.0.3", latest: "7.1.3", status: "outdated", php: null },
  },
  {
    id: "plugins",
    status: "fail",
    score: 25,
    summary: "Of the 21 plugins I could see: 3 with no release in two years",
    value: "3 of 21",
    durationMs: 1240,
    data: {
      seen: 21,
      stale: [
        { slug: "simple-share-buttons-adder", lastRelease: "2024-03-02" },
        { slug: "wp-google-maps-lite", lastRelease: "2023-11-18" },
        { slug: "events-calendar-lite", lastRelease: "2024-06-27" },
      ],
      closed: [],
      outdated: [],
      unlisted: ["gravityforms"],
    },
  },
  {
    id: "theme",
    status: "ok",
    score: 100,
    summary: "Child theme of Astra, which was updated this year",
    value: null,
    durationMs: 420,
    data: { name: "Your Organization", slug: "yourorg", child: true, parent: "astra", updatedAt: "2026-05-12" },
  },
  {
    id: "indexing",
    status: "ok",
    score: 100,
    summary: "sitemap.xml and robots.txt look right",
    value: null,
    durationMs: 290,
    data: {
      sitemap: "https://yourorganization.org/wp-sitemap.xml",
      robots: true,
      blocked: false,
      noindex: false,
    },
  },
  {
    id: "links",
    status: "warn",
    score: 56,
    summary: "8 broken links across 20 pages, 2 of them in the menu",
    value: "8",
    durationMs: 1620,
    data: {
      pages: 20,
      checked: 312,
      broken: [
        { url: "/programs/summer-2024", status: 404, from: "/", nav: true },
        { url: "/staff", status: 404, from: "/", nav: true },
        { url: "https://twitter.com/yourorg", status: 410, from: "/about", nav: false },
        { url: "/wp-content/uploads/2023/annual-report.pdf", status: 404, from: "/about", nav: false },
        { url: "/events/gala-2023", status: 404, from: "/events", nav: false },
        { url: "https://bit.ly/donate-2022", status: 404, from: "/donate", nav: false },
        { url: "/news/2021/spring-update", status: 404, from: "/news", nav: false },
        { url: "/volunteer/apply", status: 404, from: "/volunteer", nav: false },
      ],
      unverified: 4,
    },
  },
  {
    id: "seo",
    status: "ok",
    score: 90,
    summary: "Titles and descriptions on 18 of 20 pages",
    value: "18 / 20",
    durationMs: 480,
    data: { pages: 20, withTitleAndDescription: 18, missing: ["/events", "/volunteer"], duplicateTitles: 0 },
  },
  {
    id: "performance",
    status: "warn",
    score: 54,
    summary: "Lighthouse 54 on mobile, 81 on desktop",
    value: "54",
    durationMs: 1980,
    data: { mobile: 54, desktop: 81, pages: ["/", "/about", "/donate"], field: null },
  },
  {
    id: "images",
    status: "fail",
    score: 40,
    summary: "1.8 MB of images could be served smaller",
    value: "1.8 MB",
    durationMs: 60,
    data: { savingsBytes: 1_800_000 },
  },
  {
    id: "accessibility",
    status: "warn",
    score: 58,
    summary: "14 errors and 9 contrast issues on key pages",
    value: "23",
    durationMs: 60,
    data: {
      score: 58,
      errors: 14,
      contrast: 9,
      pages: ["/", "/about", "/donate"],
      issues: [
        { id: "color-contrast", title: "Text without enough contrast", count: 9 },
        { id: "image-alt", title: "Images without alt text", count: 8 },
        { id: "link-name", title: "Links without a discernible name", count: 6 },
      ],
    },
  },
];

/** How long the sample's DNS lookup takes to give up on a `.invalid` host. */
const FAIL_AFTER = 1800;

/** A host on the reserved `.invalid` TLD plays the failed run instead. */
const fails = (host: string) => host.endsWith(".invalid");

/** The whole run as timed events, `at` ms from its start. */
function timeline(id: string, url: string, host: string, startedAt: string): { at: number; event: SiteCheckEvent }[] {
  const out: { at: number; event: SiteCheckEvent }[] = [
    { at: 0, event: { type: "run.started", id, url, host, startedAt } },
  ];
  if (fails(host)) {
    out.push({ at: 0, event: { type: "check.started", id: "dns", at: 0 } });
    out.push({
      at: FAIL_AFTER,
      event: {
        type: "run.failed",
        reason: "unreachable",
        message: `Couldn’t find ${host}: there’s no DNS record for it`,
        at: FAIL_AFTER,
      },
    });
    return out;
  }
  let at = 0;
  for (const r of RESULTS) {
    out.push({ at, event: { type: "check.started", id: r.id, at } });
    at += r.durationMs;
    out.push({ at, event: { type: "check.finished", result: { ...r, at } as CheckResult } });
    // A category is scored when the last check that counts towards it finishes.
    const category = checkMeta(r.id).category;
    if (category && lastOfCategory(category) === r.id) {
      out.push({ at, event: { type: "category.scored", category: scoreCategory(category, RESULTS), at } });
    }
  }
  const score = overallScore(CATEGORIES.map((c) => scoreCategory(c.id, RESULTS)));
  out.push({ at, event: { type: "run.finished", score, at } });
  return out;
}

export type SampleStage = "running" | "result" | "failed";

/** Where a pinned stage stops the clock, in ms from the start. */
export const STAGE_AT: Record<SampleStage, number> = { running: 5640, result: Infinity, failed: Infinity };

/** A sample run as it stands at `stage`, with a fixed start so the server and client render the same times. */
export function sampleRunAt(stage: SampleStage): SiteCheckRun | null {
  const host = stage === "failed" ? "yourorganization.invalid" : "yourorganization.org";
  return timeline("sc_sample", `https://${host}`, host, "2026-10-07T18:02:07.000Z")
    .filter(({ at }) => at <= STAGE_AT[stage])
    .reduce<SiteCheckRun | null>((run, { event }) => reduceRun(run, event), null);
}
