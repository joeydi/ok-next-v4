import type { Page } from "./crawl";
import { bytes, type Finding, plural, scored, skipped } from "./score";

// Lighthouse, run by Google's PageSpeed Insights API: mobile on up to three key
// pages and desktop on the home page, all at once. One report per page covers
// performance, image savings and accessibility, plus Chrome's real-visitor Core Web
// Vitals when the site has enough traffic. The slowest step of a run (15–45 s), so
// it starts first and is reported last, without waiting long on the slowest page.

type Audit = {
  id: string;
  title: string;
  score: number | null;
  scoreDisplayMode: string;
  details?: {
    overallSavingsBytes?: number;
    items?: { url?: string; wastedBytes?: number; node?: { selector?: string; snippet?: string } }[];
  };
};

type Metric = { percentile: number; category: "FAST" | "AVERAGE" | "SLOW" };

type Report = {
  lighthouseResult: {
    categories: {
      performance?: { score: number | null };
      accessibility?: { score: number | null; auditRefs: { id: string; weight: number }[] };
    };
    audits: Record<string, Audit>;
  };
  loadingExperience?: { metrics?: Record<string, Metric> };
  originLoadingExperience?: { metrics?: Record<string, Metric> };
};

export type Lighthouse = { mobile: { path: string; report: Report }[]; desktop: Report | null } | { error: string };

/** The pages worth a Lighthouse run besides home: donate, about and the like from the menu, else its first links. */
export function keyPages(home: Page) {
  const host = new URL(home.url).host;
  const internal = home.nav.filter((u) => new URL(u).host === host && new URL(u).pathname !== "/");
  const ranked = [
    ...internal.filter((u) => /donat|give|about|contact|program|service|support|volunteer/i.test(u)),
    ...internal,
  ];
  return [home.url, ...new Set(ranked)].slice(0, 3);
}

async function report(url: string, strategy: "mobile" | "desktop", signal: AbortSignal): Promise<Report> {
  const params = new URLSearchParams({ url, strategy });
  params.append("category", "performance");
  params.append("category", "accessibility");
  if (process.env.GOOGLE_PAGESPEED_API_KEY) params.set("key", process.env.GOOGLE_PAGESPEED_API_KEY);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal });
  if (!res.ok) throw new Error(`PageSpeed Insights answered ${res.status}`);
  return res.json();
}

/** How long the other pages get once the home page's mobile report is in. */
const GRACE_MS = 8000;

/**
 * Every report, or why there aren't any. The home page's mobile report is the one
 * that matters: once it's in, the other pages (and desktop) get GRACE_MS more and
 * are left out if they're still going, so one slow page can't hold up the run.
 * Gives up entirely after `timeoutMs`.
 */
export async function runLighthouse(urls: string[], timeoutMs = 55_000, abort?: AbortSignal): Promise<Lighthouse> {
  if (!process.env.GOOGLE_PAGESPEED_API_KEY) return { error: "not-configured" };
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(abort ? [abort] : [])]);
  const grace = new AbortController();
  const rest = AbortSignal.any([signal, grace.signal]);

  const home = report(urls[0], "mobile", signal);
  const others = Promise.allSettled([
    report(urls[0], "desktop", rest),
    ...urls.slice(1).map((u) => report(u, "mobile", rest)),
  ]);
  const [first] = await Promise.allSettled([home]);
  // With the home report in, stop waiting on the rest after the grace period.
  const timer = first.status === "fulfilled" ? setTimeout(() => grace.abort(), GRACE_MS) : undefined;
  const [desktop, ...mobile] = await others;
  clearTimeout(timer);

  const done = [first, ...mobile].flatMap((r, i) =>
    r.status === "fulfilled" ? [{ path: new URL(urls[i]).pathname, report: r.value }] : [],
  );
  if (!done.length) {
    const reason = first.status === "rejected" ? first.reason : null;
    return { error: (reason as Error)?.name === "TimeoutError" ? "timeout" : "failed" };
  }
  return { mobile: done, desktop: desktop.status === "fulfilled" ? desktop.value : null };
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const pct = (score: number | null | undefined) => Math.round((score ?? 0) * 100);

function unavailable<Id extends "performance" | "images" | "accessibility">(lh: { error: string }) {
  return skipped<Id>(
    lh.error === "not-configured"
      ? "Lighthouse isn’t set up here (no PageSpeed key)"
      : lh.error === "timeout"
        ? "Lighthouse didn’t finish in time"
        : "Lighthouse couldn’t load the site",
  );
}

/** Real visitors' Core Web Vitals for the home page, or the whole site if the page alone has too few. */
function field(r: Report) {
  const metrics = r.loadingExperience?.metrics ?? r.originLoadingExperience?.metrics;
  const lcp = metrics?.LARGEST_CONTENTFUL_PAINT_MS;
  const cls = metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE;
  const inp = metrics?.INTERACTION_TO_NEXT_PAINT;
  if (!lcp || !cls) return null;
  const pass = lcp.category === "FAST" && cls.category === "FAST" && (!inp || inp.category === "FAST");
  return { lcpMs: lcp.percentile, inpMs: inp?.percentile ?? null, cls: cls.percentile / 100, pass };
}

/** Rubric: the mean mobile Lighthouse score, less 10 when real visitors fail Core Web Vitals. */
export function checkPerformance(lh: Lighthouse): Finding<"performance"> {
  if ("error" in lh) return unavailable(lh);
  const mobile = mean(lh.mobile.map((m) => pct(m.report.lighthouseResult.categories.performance?.score)));
  const desktop = lh.desktop ? pct(lh.desktop.lighthouseResult.categories.performance?.score) : null;
  const vitals = field(lh.mobile[0].report);
  const data = { mobile, desktop, pages: lh.mobile.map((m) => m.path), field: vitals };
  const on = desktop === null ? "on mobile" : `on mobile, ${desktop} on desktop`;
  const real = vitals ? (vitals.pass ? "; real visitors get a fast site" : "; real visitors find it slow") : "";
  return scored(mobile - (vitals && !vitals.pass ? 10 : 0), `Lighthouse ${mobile} ${on}${real}`, data, String(mobile));
}

/** The image audits, old and new: Lighthouse 13 folds the first four into image-delivery-insight. */
const IMAGE_AUDITS = [
  "image-delivery-insight",
  "modern-image-formats",
  "uses-optimized-images",
  "uses-responsive-images",
  "offscreen-images",
];

/** Rubric: under 250 KB to save 100 · under 1 MB 70 · under 3 MB 40 · else 15. */
export function checkImages(lh: Lighthouse): Finding<"images"> {
  if ("error" in lh) return unavailable(lh);
  // The same image on every page (or in two audits) counts once, at its biggest saving.
  const byUrl = new Map<string, number>();
  let loose = 0;
  for (const { report: r } of lh.mobile) {
    for (const id of IMAGE_AUDITS) {
      const details = r.lighthouseResult.audits[id]?.details;
      if (!details) continue;
      const items = details.items?.filter((i) => i.url && i.wastedBytes) ?? [];
      if (items.length) {
        for (const i of items)
          byUrl.set(i.url as string, Math.max(byUrl.get(i.url as string) ?? 0, i.wastedBytes ?? 0));
      } else {
        loose += details.overallSavingsBytes ?? 0;
      }
    }
  }
  const savingsBytes = [...byUrl.values()].reduce((a, b) => a + b, loose);
  const score = savingsBytes < 250_000 ? 100 : savingsBytes < 1_000_000 ? 70 : savingsBytes < 3_000_000 ? 40 : 15;
  if (savingsBytes < 50_000) return scored(score, "Images are already well sized", { savingsBytes });
  return scored(
    score,
    `${bytes(savingsBytes)} of images could be served smaller`,
    { savingsBytes },
    bytes(savingsBytes),
  );
}

/** Rubric: the mean Lighthouse accessibility score. */
export function checkAccessibility(lh: Lighthouse): Finding<"accessibility"> {
  if ("error" in lh) return unavailable(lh);
  // Each failing element counts once: a header or footer shared by every page isn't three problems.
  const issues = new Map<string, { id: string; title: string; elements: Set<string> }>();
  for (const { path, report: r } of lh.mobile) {
    const { categories, audits } = r.lighthouseResult;
    for (const ref of categories.accessibility?.auditRefs ?? []) {
      const audit = audits[ref.id];
      if (!ref.weight || audit?.score !== 0) continue;
      const issue = issues.get(ref.id) ?? { id: ref.id, title: audit.title, elements: new Set<string>() };
      const items = audit.details?.items ?? [];
      if (!items.length) issue.elements.add(path);
      for (const [i, item] of items.entries()) {
        issue.elements.add(item.node?.snippet ?? item.node?.selector ?? `${path}#${i}`);
      }
      issues.set(ref.id, issue);
    }
  }
  const score = mean(lh.mobile.map((m) => pct(m.report.lighthouseResult.categories.accessibility?.score)));
  const list = [...issues.values()]
    .map(({ id, title, elements }) => ({ id, title, count: elements.size }))
    .sort((a, b) => b.count - a.count);
  const contrast = list.find((i) => i.id === "color-contrast")?.count ?? 0;
  const errors = list.reduce((sum, i) => sum + i.count, 0) - contrast;
  const data = { score, errors, contrast, pages: lh.mobile.map((m) => m.path), issues: list.slice(0, 5) };
  const where = lh.mobile.length > 1 ? "on key pages" : "on the home page";
  if (!errors && !contrast) return scored(score, `No automated accessibility errors ${where}`, data);
  const parts = [errors && plural(errors, "error"), contrast && plural(contrast, "contrast issue")].filter(Boolean);
  return scored(score, `${parts.join(" and ")} ${where}`, data, String(errors + contrast));
}
