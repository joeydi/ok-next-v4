// The free site check's contract: what a run is, what each check reports, and the
// events the checker streams while it works. The page only reads these, so the
// sample player (sample.ts) and the real checker, when it exists, are
// interchangeable: each feeds `reduceRun` the same events.

export type CheckId =
  | "dns"
  | "https"
  | "domain"
  | "headers"
  | "cms"
  | "plugins"
  | "theme"
  | "uptime"
  | "performance"
  | "images"
  | "accessibility"
  | "links"
  | "seo"
  | "indexing";

export type CategoryId = "security" | "updates" | "speed" | "accessibility" | "links" | "seo";

/** How a check came out. `skipped` is for checks that don't apply, like plugins on a site that isn't WordPress. */
export type CheckStatus = "ok" | "warn" | "fail" | "skipped";

/** Every check, in the order the checker runs them. `category` is the score it counts towards (DNS counts towards none). */
export const CHECKS: readonly { id: CheckId; name: string; category: CategoryId | null; running: string }[] = [
  { id: "dns", name: "DNS", category: null, running: "Resolving DNS" },
  { id: "https", name: "HTTPS", category: "security", running: "Checking the SSL certificate" },
  { id: "domain", name: "Domain", category: "security", running: "Looking up the domain registration" },
  { id: "headers", name: "Headers", category: "security", running: "Reading security headers" },
  { id: "cms", name: "WordPress", category: "updates", running: "Detecting the WordPress version" },
  { id: "plugins", name: "Plugins", category: "updates", running: "Checking plugins" },
  { id: "theme", name: "Theme", category: "updates", running: "Checking the theme" },
  { id: "uptime", name: "Uptime", category: "speed", running: "Measuring response time" },
  { id: "performance", name: "Performance", category: "speed", running: "Running Lighthouse on mobile" },
  { id: "images", name: "Images", category: "speed", running: "Weighing images" },
  {
    id: "accessibility",
    name: "Accessibility",
    category: "accessibility",
    running: "Scanning for accessibility issues",
  },
  { id: "links", name: "Links", category: "links", running: "Crawling links" },
  { id: "seo", name: "SEO", category: "seo", running: "Reading titles and descriptions" },
  { id: "indexing", name: "Indexing", category: "seo", running: "Checking sitemap and robots.txt" },
];

/** The score's six parts. The overall score is their mean, weighted by `weight` (equal for now). */
export const CATEGORIES: readonly { id: CategoryId; name: string; weight: number }[] = [
  { id: "security", name: "Security", weight: 1 },
  { id: "updates", name: "Updates", weight: 1 },
  { id: "speed", name: "Speed", weight: 1 },
  { id: "accessibility", name: "Accessibility", weight: 1 },
  { id: "links", name: "Links", weight: 1 },
  { id: "seo", name: "SEO", weight: 1 },
];

export const checkMeta = (id: CheckId) => CHECKS.find((c) => c.id === id) ?? CHECKS[0];

/** What each check found, beyond its one-line summary: the evidence the personal review starts from. Dates are ISO. */
export interface CheckData {
  dns: { addresses: string[]; cdn: string | null };
  https: { issuer: string; expiresAt: string; daysLeft: number };
  domain: { registrar: string | null; expiresAt: string };
  /** Header names, lower case: "content-security-policy", "strict-transport-security". */
  headers: { missing: string[] };
  cms: { name: string | null; version: string | null; latest: string | null; behind: number };
  plugins: { total: number; stale: { slug: string; lastRelease: string }[] };
  theme: { name: string; child: boolean; parentUpdatedAt: string | null };
  uptime: { status: number; responseMs: number };
  /** Lighthouse performance scores, 0–100, across `pages`. */
  performance: { mobile: number; desktop: number; pages: string[] };
  images: { savingsBytes: number };
  accessibility: { errors: number; contrast: number; pages: string[] };
  links: { checked: number; broken: { url: string; status: number; from: string }[] };
  seo: { pages: number; withTitleAndDescription: number };
  indexing: { sitemap: boolean; robots: boolean; noindex: boolean };
}

export type CheckResult<K extends CheckId = CheckId> = {
  [Id in K]: {
    id: Id;
    status: CheckStatus;
    /** The log line: "3 of 21 plugins haven’t had a release in two years". */
    summary: string;
    /** A short figure for the line, if there's one worth showing: "3 of 21". */
    value: string | null;
    /** When it finished, in ms from the start of the run. */
    at: number;
    durationMs: number;
    data: CheckData[Id] | null;
  };
}[K];

/** 0–100. */
export type CategoryScore = { id: CategoryId; score: number };

export type RunStatus = "running" | "complete" | "failed";
export type FailReason = "invalid-url" | "unreachable" | "timeout";

export type SiteCheckRun = {
  id: string;
  /** Normalised: `https://` + host. */
  url: string;
  host: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  /** The check under way, while running. */
  current: CheckId | null;
  /** Finished checks, in the order they finished. */
  results: CheckResult[];
  /** Category scores, each added once its last check has finished. */
  categories: CategoryScore[];
  /** 0–100, once complete. */
  score: number | null;
  /** ms from the start when it completed or failed. */
  duration: number | null;
  failure: { reason: FailReason; message: string } | null;
};

/** What the checker streams while it works. `at` is ms from the start of the run. */
export type SiteCheckEvent =
  | { type: "run.started"; id: string; url: string; host: string; startedAt: string }
  | { type: "check.started"; id: CheckId; at: number }
  | { type: "check.finished"; result: CheckResult }
  | { type: "category.scored"; category: CategoryScore; at: number }
  | { type: "run.finished"; score: number; at: number }
  | { type: "run.failed"; reason: FailReason; message: string; at: number };

/** Sent when a visitor asks for the personal review after their check. */
export type ReviewRequest = { runId: string; host: string; email: string; score: number; requestedAt: string };

/** "https://www.Example.org/about" → `{ url: "https://www.example.org", host: "www.example.org" }`; null if it isn't a web address. */
export function normalizeUrl(input: string): { url: string; host: string } | null {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
  return { url: `https://${host}`, host };
}

/** Folds one streamed event into the run. Events before `run.started` are ignored. */
export function reduceRun(run: SiteCheckRun | null, event: SiteCheckEvent): SiteCheckRun | null {
  if (event.type === "run.started") {
    return {
      id: event.id,
      url: event.url,
      host: event.host,
      startedAt: event.startedAt,
      finishedAt: null,
      status: "running",
      current: null,
      results: [],
      categories: [],
      score: null,
      duration: null,
      failure: null,
    };
  }
  if (!run) return run;
  const finishedAt = (at: number) => new Date(Date.parse(run.startedAt) + at).toISOString();
  switch (event.type) {
    case "check.started":
      return { ...run, current: event.id };
    case "check.finished":
      return {
        ...run,
        current: run.current === event.result.id ? null : run.current,
        results: [...run.results, event.result],
      };
    case "category.scored":
      return { ...run, categories: [...run.categories, event.category] };
    case "run.finished":
      return {
        ...run,
        status: "complete",
        current: null,
        score: event.score,
        duration: event.at,
        finishedAt: finishedAt(event.at),
      };
    case "run.failed":
      return {
        ...run,
        status: "failed",
        current: null,
        duration: event.at,
        finishedAt: finishedAt(event.at),
        failure: { reason: event.reason, message: event.message },
      };
  }
}
