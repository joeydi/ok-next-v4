import { parse } from "node-html-parser";
import {
  CATEGORIES,
  CHECKS,
  type CheckId,
  type CheckResult,
  checkMeta,
  type FailReason,
  lastOfCategory,
  overallScore,
  type SiteCheckEvent,
  scoreCategory,
} from "../schema";
import { checkLinks, checkSeo, crawl, linksFinding, readPage } from "./crawl";
import { checkDomain } from "./domain";
import { errorCode, type FetchResult, safeFetch } from "./fetch";
import { checkHeaders } from "./headers";
import { checkIndexing, isNoindex, readIndexing } from "./indexing";
import { checkDns, checkHttps, checkResponse, resolveHost } from "./network";
import { checkAccessibility, checkImages, checkPerformance, keyPages, runLighthouse } from "./psi";
import { type Finding, skipped } from "./score";
import { checkCms, checkPlugins, checkTheme, detectPlatform } from "./wordpress";

// One run of the checker, as the events the page folds with `reduceRun`. A preflight
// (DNS, then the home page) decides whether there's a site to check; then every
// check starts at once and the results are reported in the log's order, each as soon
// as it and those before it are done.

/** The home page, over HTTPS if it answers there, else plain HTTP. */
async function fetchHome(host: string) {
  try {
    return await safeFetch(`https://${host}/`, { timeoutMs: 10_000 });
  } catch (error) {
    if (errorCode(error) === "ETIMEDOUT" || errorCode(error) === "EPRIVATE") throw error;
    return safeFetch(`http://${host}/`, { timeoutMs: 10_000 });
  }
}

/** A firewall or bot challenge answering instead of the site. */
const isBlocked = (home: FetchResult) =>
  home.headers["cf-mitigated"] === "challenge" ||
  home.status === 403 ||
  home.status === 429 ||
  (home.status === 503 && /Just a moment|Attention Required|challenge-platform|captcha/i.test(home.body));

export async function* runCheck(
  target: { url: string; host: string },
  { id = `sc_${crypto.randomUUID()}`, signal }: { id?: string; signal?: AbortSignal } = {},
): AsyncGenerator<SiteCheckEvent> {
  const { host } = target;
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);
  const fail = (reason: FailReason, message: string): SiteCheckEvent => ({
    type: "run.failed",
    reason,
    message,
    at: at(),
  });

  yield { type: "run.started", id, url: target.url, host, startedAt: new Date().toISOString() };
  yield { type: "check.started", id: "dns", at: 0 };

  const resolved = await resolveHost(host);
  if ("error" in resolved) {
    yield resolved.error === "private"
      ? fail("unreachable", `${host} isn’t a public website`)
      : fail("unreachable", `Couldn’t find ${host}: there’s no DNS record for it`);
    return;
  }

  let home: FetchResult;
  try {
    home = await fetchHome(host);
  } catch (error) {
    const code = errorCode(error);
    yield code === "ETIMEDOUT"
      ? fail("timeout", `${host} didn’t answer within 10 seconds`)
      : code === "EPRIVATE"
        ? fail("unreachable", `${host} redirects somewhere that isn’t a public website`)
        : fail("unreachable", `${host} has a DNS record, but no website answered`);
    return;
  }
  if (isBlocked(home)) {
    yield fail("blocked", `${host}’s firewall turned the check away (${home.status})`);
    return;
  }

  const results: CheckResult[] = [
    { id: "dns", ...checkDns(resolved.addresses, home, host), at: at(), durationMs: at() } as CheckResult,
  ];
  yield { type: "check.finished", result: results[0] };

  const doc = parse(home.body);
  const homePage = readPage(home, doc);
  const origin = new URL(home.url).origin;
  const finalHost = new URL(home.url).hostname;
  const platform = detectPlatform(home, doc);

  // Shared work, each started once: Lighthouse first, as it's the slowest.
  const lighthouse = runLighthouse(keyPages(homePage), 55_000, signal);
  const indexing = readIndexing(origin);
  const site = indexing
    .then((ix) => crawl(homePage, ix.urls))
    .catch(() => ({ home: homePage, pages: [homePage], statuses: new Map<string, number>() }));

  const tasks: { [Id in Exclude<CheckId, "dns">]: () => Promise<Finding<Id>> | Finding<Id> } = {
    https: () => checkHttps(finalHost),
    domain: () => checkDomain(finalHost),
    headers: () => checkHeaders(home.headers),
    response: () => checkResponse(home),
    cms: () => checkCms(platform, home, doc),
    plugins: async () => checkPlugins(platform, origin, (await site).pages),
    theme: async () => checkTheme(platform, origin, (await site).pages),
    indexing: async () => checkIndexing(await indexing, isNoindex(home, doc)),
    links: async () => linksFinding(await checkLinks(await site)),
    seo: async () => checkSeo((await site).pages),
    performance: async () => checkPerformance(await lighthouse),
    images: async () => checkImages(await lighthouse),
    accessibility: async () => checkAccessibility(await lighthouse),
  };

  // Start every check now; each settles to a finding and how long its own work took.
  const running = new Map(
    Object.entries(tasks).map(([checkId, task]) => {
      const start = performance.now();
      const done = Promise.resolve()
        .then(task as () => Promise<Finding> | Finding)
        .catch((error): Finding => {
          console.error(`[site check] ${checkId} failed on ${host}`, error);
          return skipped("Couldn’t run this check");
        })
        .then((finding) => ({ finding, ms: Math.round(performance.now() - start) }));
      return [checkId, done] as const;
    }),
  );

  for (const meta of CHECKS) {
    if (meta.id === "dns") continue;
    if (signal?.aborted) return;
    yield { type: "check.started", id: meta.id, at: at() };
    const outcome = await running.get(meta.id);
    if (!outcome) continue;
    const result = { id: meta.id, ...outcome.finding, at: at(), durationMs: outcome.ms } as CheckResult;
    results.push(result);
    yield { type: "check.finished", result };
    const category = checkMeta(meta.id).category;
    if (category && lastOfCategory(category) === meta.id) {
      yield { type: "category.scored", category: scoreCategory(category, results), at: at() };
    }
  }

  yield { type: "run.finished", score: overallScore(CATEGORIES.map((c) => scoreCategory(c.id, results))), at: at() };
}
