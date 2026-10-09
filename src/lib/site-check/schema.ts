// The free site check's contract: what a run is, what each check reports, and the
// events the checker streams while it works. The page only reads these, so the
// sample player (sample.ts) and the checker (checker/, streamed by client.ts) are
// interchangeable: each feeds `reduceRun` the same events.

export type CheckId =
  | "dns"
  | "https"
  | "domain"
  | "headers"
  | "response"
  | "cms"
  | "plugins"
  | "theme"
  | "indexing"
  | "links"
  | "seo"
  | "performance"
  | "images"
  | "accessibility";

export type CategoryId = "security" | "updates" | "speed" | "accessibility" | "links" | "seo";

/** How a check came out. `skipped` is for checks that don't apply, like plugins on a site that isn't WordPress. */
export type CheckStatus = "ok" | "warn" | "fail" | "skipped";

/**
 * Every check, in the order the log shows them. The checker runs them all at once
 * but reports them in this order, so the Lighthouse checks, which wait on one slow
 * report, come last. `category` is the score it counts towards (DNS counts towards none).
 */
export const CHECKS: readonly { id: CheckId; name: string; category: CategoryId | null; running: string }[] = [
  { id: "dns", name: "DNS", category: null, running: "Resolving DNS" },
  { id: "https", name: "HTTPS", category: "security", running: "Checking the SSL certificate" },
  { id: "domain", name: "Domain", category: "security", running: "Looking up the domain registration" },
  { id: "headers", name: "Headers", category: "security", running: "Reading security headers" },
  { id: "response", name: "Response", category: "speed", running: "Measuring response time" },
  { id: "cms", name: "Platform", category: "updates", running: "Detecting the platform and its version" },
  { id: "plugins", name: "Plugins", category: "updates", running: "Checking plugins" },
  { id: "theme", name: "Theme", category: "updates", running: "Checking the theme" },
  { id: "indexing", name: "Indexing", category: "seo", running: "Checking sitemap and robots.txt" },
  { id: "links", name: "Links", category: "links", running: "Crawling links" },
  { id: "seo", name: "SEO", category: "seo", running: "Reading titles and descriptions" },
  { id: "performance", name: "Performance", category: "speed", running: "Running Lighthouse on mobile" },
  { id: "images", name: "Images", category: "speed", running: "Weighing images" },
  {
    id: "accessibility",
    name: "Accessibility",
    category: "accessibility",
    running: "Scanning for accessibility issues",
  },
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
  /** `redirects`: plain http:// sends visitors on to https://. */
  https: {
    valid: boolean;
    issuer: string | null;
    expiresAt: string | null;
    daysLeft: number | null;
    redirects: boolean;
  };
  /** `domain` is the registered one: www.example.org → example.org. */
  domain: { domain: string; registrar: string | null; expiresAt: string | null; daysLeft: number | null };
  /** Header names, lower case: "content-security-policy", "strict-transport-security". */
  headers: { present: string[]; missing: string[] };
  /** One request from the checker's region: status and time to first byte. */
  response: { status: number; responseMs: number };
  /** `name` is the platform ("wordpress", "squarespace"); `status` is WordPress's own verdict on the version. */
  cms: {
    name: string | null;
    version: string | null;
    latest: string | null;
    status: "latest" | "outdated" | "insecure" | null;
    php: string | null;
  };
  /** Only plugins that load something on the pages crawled are visible: `seen` of them. `unlisted` aren't in the WordPress.org directory (premium or custom). */
  plugins: {
    seen: number;
    stale: { slug: string; lastRelease: string }[];
    closed: { slug: string; closedAt: string | null }[];
    outdated: { slug: string; version: string; latest: string }[];
    unlisted: string[];
  };
  /** `updatedAt` is the directory's last release of the theme, or of its parent for a child theme. */
  theme: { name: string; slug: string; child: boolean; parent: string | null; updatedAt: string | null };
  /** `sitemap` is its URL, if one was found; `blocked` is robots.txt shutting out every crawler. */
  indexing: { sitemap: string | null; robots: boolean; blocked: boolean; noindex: boolean };
  links: {
    pages: number;
    checked: number;
    /** `nav`: linked from the site's menu. */
    broken: { url: string; status: number; from: string; nav: boolean }[];
    /** External links that refused the checker (LinkedIn and the like block bots), so couldn't be confirmed either way. */
    unverified: number;
  };
  seo: { pages: number; withTitleAndDescription: number; missing: string[]; duplicateTitles: number };
  /** Lighthouse performance scores, 0–100, across `pages`; `field` is real visitors' Core Web Vitals, when Chrome has enough of them. */
  performance: {
    mobile: number;
    desktop: number | null;
    pages: string[];
    field: { lcpMs: number; inpMs: number | null; cls: number; pass: boolean } | null;
  };
  images: { savingsBytes: number };
  /** `errors` and `contrast` count elements; `issues` are the failing audits, worst first. */
  accessibility: {
    score: number;
    errors: number;
    contrast: number;
    pages: string[];
    issues: { id: string; title: string; count: number }[];
  };
}

export type CheckResult<K extends CheckId = CheckId> = {
  [Id in K]: {
    id: Id;
    status: CheckStatus;
    /** 0–100, what it counts towards its category; null when skipped. */
    score: number | null;
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

/** 0–100; null when none of its checks applied, like Updates on a Squarespace site. */
export type CategoryScore = { id: CategoryId; score: number | null };

/** A category's score: the mean of its checks that ran. */
export function scoreCategory(id: CategoryId, results: readonly Pick<CheckResult, "id" | "score">[]): CategoryScore {
  const scores = results
    .filter((r) => checkMeta(r.id).category === id && r.score !== null)
    .map((r) => r.score as number);
  return { id, score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
}

/** The overall score: the scored categories' weighted mean. */
export function overallScore(categories: readonly CategoryScore[]) {
  let sum = 0;
  let weights = 0;
  for (const c of categories) {
    const weight = CATEGORIES.find((cat) => cat.id === c.id)?.weight ?? 0;
    if (c.score === null) continue;
    sum += c.score * weight;
    weights += weight;
  }
  return weights ? Math.round(sum / weights) : 0;
}

/** The last check, in log order, that counts towards each category: when it finishes, the category is scored. */
export const lastOfCategory = (id: CategoryId) => CHECKS.findLast((c) => c.category === id)?.id;

export type RunStatus = "running" | "complete" | "failed";
export type FailReason = "invalid-url" | "unreachable" | "timeout" | "blocked" | "rate-limited" | "busy";

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

/** Sent when a visitor asks for the personal review after their check. The run itself is looked up by id. */
export type ReviewRequest = { runId: string; email: string };

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
