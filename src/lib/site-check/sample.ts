// Sample runs for the site check until the real checker exists. `playSample` streams
// the same events the checker will, on timers, so swapping it for the checker's
// stream (POST /api/site-check, as server-sent events) leaves the page as it is.
// One site's results, whatever URL is entered: a WordPress site in fair shape, with
// figures that agree with each other and with the category scores.

import {
  CATEGORIES,
  type CategoryScore,
  CHECKS,
  type CheckResult,
  type ReviewRequest,
  reduceRun,
  type SiteCheckEvent,
  type SiteCheckRun,
} from "./schema";

/** Each check's result, in run order. `at` is filled in from the durations below. */
const RESULTS: Omit<CheckResult, "at">[] = [
  {
    id: "dns",
    status: "ok",
    summary: "Resolves to 2 addresses, served through a CDN",
    value: null,
    durationMs: 300,
    data: { addresses: ["104.21.48.12", "172.67.161.30"], cdn: "Cloudflare" },
  },
  {
    id: "https",
    status: "ok",
    summary: "Certificate valid, renews in 61 days",
    value: "61 days",
    durationMs: 520,
    data: { issuer: "Let’s Encrypt", expiresAt: "2026-12-07T00:00:00Z", daysLeft: 61 },
  },
  {
    id: "domain",
    status: "ok",
    summary: "Registered through August 2028",
    value: "2028",
    durationMs: 680,
    data: { registrar: "Namecheap", expiresAt: "2028-08-14T00:00:00Z" },
  },
  {
    id: "headers",
    status: "warn",
    summary: "No Content-Security-Policy or HSTS header",
    value: "2 missing",
    durationMs: 340,
    data: { missing: ["content-security-policy", "strict-transport-security"] },
  },
  {
    id: "cms",
    status: "warn",
    summary: "Core is two releases behind",
    value: "2 behind",
    durationMs: 610,
    data: { name: "wordpress", version: "7.0.3", latest: "7.1.2", behind: 2 },
  },
  {
    id: "plugins",
    status: "fail",
    summary: "3 of 21 plugins haven’t had a release in two years",
    value: "3 of 21",
    durationMs: 1240,
    data: {
      total: 21,
      stale: [
        { slug: "simple-share-buttons-adder", lastRelease: "2024-03-02" },
        { slug: "wp-google-maps-lite", lastRelease: "2023-11-18" },
        { slug: "events-calendar-lite", lastRelease: "2024-06-27" },
      ],
    },
  },
  {
    id: "theme",
    status: "ok",
    summary: "Child theme; the parent was updated this year",
    value: null,
    durationMs: 420,
    data: { name: "Astra", child: true, parentUpdatedAt: "2026-05-12" },
  },
  {
    id: "uptime",
    status: "ok",
    summary: "Responding in 412 ms",
    value: "412 ms",
    durationMs: 410,
    data: { status: 200, responseMs: 412 },
  },
  {
    id: "performance",
    status: "warn",
    summary: "Lighthouse 54 on mobile, 81 on desktop",
    value: "54",
    durationMs: 1980,
    data: { mobile: 54, desktop: 81, pages: ["/", "/about", "/donate"] },
  },
  {
    id: "images",
    status: "warn",
    summary: "1.8 MB of images could be served smaller",
    value: "1.8 MB",
    durationMs: 560,
    data: { savingsBytes: 1_800_000 },
  },
  {
    id: "accessibility",
    status: "fail",
    summary: "14 errors and 9 contrast issues on key pages",
    value: "23",
    durationMs: 1350,
    data: { errors: 14, contrast: 9, pages: ["/", "/about", "/donate"] },
  },
  {
    id: "links",
    status: "warn",
    summary: "6 broken links; 2 pages in the menu return 404",
    value: "8",
    durationMs: 1620,
    data: {
      checked: 312,
      broken: [
        { url: "/programs/summer-2024", status: 404, from: "/" },
        { url: "/staff", status: 404, from: "/" },
        { url: "https://twitter.com/yourorg", status: 410, from: "/about" },
        { url: "/wp-content/uploads/2023/annual-report.pdf", status: 404, from: "/about" },
        { url: "/events/gala-2023", status: 404, from: "/events" },
        { url: "https://bit.ly/donate-2022", status: 404, from: "/donate" },
        { url: "/news/2021/spring-update", status: 404, from: "/news" },
        { url: "/volunteer/apply", status: 404, from: "/volunteer" },
      ],
    },
  },
  {
    id: "seo",
    status: "ok",
    summary: "Titles and descriptions on 18 of 20 pages",
    value: "18 / 20",
    durationMs: 480,
    data: { pages: 20, withTitleAndDescription: 18 },
  },
  {
    id: "indexing",
    status: "ok",
    summary: "sitemap.xml and robots.txt look right",
    value: null,
    durationMs: 290,
    data: { sitemap: true, robots: true, noindex: false },
  },
];

const SCORES: CategoryScore[] = [
  { id: "security", score: 84 },
  { id: "updates", score: 52 },
  { id: "speed", score: 61 },
  { id: "accessibility", score: 58 },
  { id: "links", score: 74 },
  { id: "seo", score: 92 },
];

/** The overall score: the categories' weighted mean. */
const weight = (id: CategoryScore["id"]) => CATEGORIES.find((c) => c.id === id)?.weight ?? 0;
const SCORE = Math.round(
  SCORES.reduce((sum, s) => sum + s.score * weight(s.id), 0) / SCORES.reduce((sum, s) => sum + weight(s.id), 0),
);

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
    const category = CHECKS.find((c) => c.id === r.id)?.category;
    const last = CHECKS.findLast((c) => c.category === category);
    const score = SCORES.find((s) => s.id === category);
    if (score && last?.id === r.id) out.push({ at, event: { type: "category.scored", category: score, at } });
  }
  out.push({ at, event: { type: "run.finished", score: SCORE, at } });
  return out;
}

/** Streams a sample run for `host` to `onEvent`, as the checker would. Returns a function that stops it. */
export function playSample(url: string, host: string, onEvent: (event: SiteCheckEvent) => void) {
  const events = timeline(`sc_${crypto.randomUUID()}`, url, host, new Date().toISOString());
  const timers = events.map(({ at, event }) => setTimeout(() => onEvent(event), at));
  return () => {
    for (const t of timers) clearTimeout(t);
  };
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

/** Stands in for posting the review request until there's somewhere to post it. */
export function sendReviewRequest(request: ReviewRequest) {
  console.info("[site check] review requested", request);
  return Promise.resolve();
}
