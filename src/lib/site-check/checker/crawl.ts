import { type HTMLElement, parse } from "node-html-parser";
import { errorCode, type FetchResult, safeFetch } from "./fetch";
import { type Finding, plural, scored, skipped } from "./score";

// A small, polite crawl: the home page, then up to 19 more pages from the menu, the
// home page's links and the sitemap, four at a time, for at most 10 seconds. Their
// links are then checked within a budget of their own. Only a 404, a 410 or a host that doesn't exist counts as
// broken; anything that turns the checker away is "unverified", since sites like
// LinkedIn refuse every bot.

export type Page = {
  url: string;
  path: string;
  status: number;
  title: string;
  description: string;
  html: string;
  /** Absolute, without the fragment. */
  links: string[];
  /** Links inside the page's nav or header. */
  nav: string[];
};

const FILES = /\.(pdf|jpe?g|png|gif|webp|avif|svg|zip|docx?|xlsx?|pptx?|mp[34]|mov|ics|xml|txt)$/i;
const NOT_PAGES = /\/(wp-admin|wp-login\.php|wp-json|xmlrpc\.php|feed|cart|checkout|my-account)(\/|$)/;

const bare = (host: string) => host.replace(/^www\./, "");

export function readPage(res: FetchResult, doc: HTMLElement = parse(res.body)): Page {
  const base = new URL(res.url);
  const links: string[] = [];
  const nav: string[] = [];
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href")?.trim() ?? "";
    // Cloudflare's /cdn-cgi/ links (email obfuscation and the like) only work with its script.
    if (!href || /^(#|mailto:|tel:|javascript:|data:|sms:)/i.test(href) || href.includes("/cdn-cgi/")) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    url.hash = "";
    links.push(url.href);
    if (a.closest("nav, header, [role=navigation]")) nav.push(url.href);
  }
  const description =
    doc
      .querySelectorAll("meta")
      .find((m) => (m.getAttribute("name") ?? "").toLowerCase() === "description")
      ?.getAttribute("content") ?? "";
  return {
    url: res.url,
    path: base.pathname,
    status: res.status,
    title: doc.querySelector("title")?.text.trim() ?? "",
    description: description.trim(),
    html: res.body,
    links: [...new Set(links)],
    nav: [...new Set(nav)],
  };
}

/** Runs `fn` over `items`, `concurrency` at a time; stops starting new ones after `deadline` (a performance.now() time). */
export async function pool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>, deadline = Infinity) {
  const out: (R | undefined)[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length && performance.now() < deadline) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

export type Crawl = {
  home: Page;
  /** Every page read, home first. */
  pages: Page[];
  /** Final status of each URL the crawl requested, so the link check doesn't ask twice. */
  statuses: Map<string, number>;
};

/** The home page plus up to `limit - 1` more pages of the same site, as many as `budgetMs` allows. */
export async function crawl(home: Page, sitemap: string[], { limit = 20, budgetMs = 10_000 } = {}): Promise<Crawl> {
  const deadline = performance.now() + budgetMs;
  const host = bare(new URL(home.url).host);
  const statuses = new Map<string, number>([[home.url, home.status]]);
  const queue = [...new Set([...home.nav, ...home.links, ...sitemap])].filter((u) => {
    const url = new URL(u);
    return bare(url.host) === host && !FILES.test(url.pathname) && !NOT_PAGES.test(url.pathname) && u !== home.url;
  });
  const pages = await pool(
    queue.slice(0, limit - 1),
    4,
    async (url) => {
      try {
        const res = await safeFetch(url, { timeoutMs: 6000, maxBytes: 1_000_000 });
        statuses.set(url, res.status);
        const html = String(res.headers["content-type"] ?? "").includes("html");
        return res.status === 200 && html ? readPage(res) : null;
      } catch {
        return null;
      }
    },
    deadline,
  );
  return { home, pages: [home, ...pages.filter((p): p is Page => !!p)], statuses };
}

type Link = { url: string; from: string; nav: boolean; internal: boolean };
type Outcome = "ok" | "broken" | "unverified";

async function probe(url: string): Promise<{ status: number; outcome: Outcome }> {
  try {
    let res = await safeFetch(url, { method: "HEAD", timeoutMs: 5000 });
    // Plenty of servers mishandle HEAD: ask again properly before judging.
    if (res.status >= 400) res = await safeFetch(url, { timeoutMs: 5000, maxBytes: 1 });
    if (res.status === 404 || res.status === 410) return { status: res.status, outcome: "broken" };
    return { status: res.status, outcome: res.status < 400 ? "ok" : "unverified" };
  } catch (error) {
    // A host that doesn't exist is broken; a timeout or refusal can't be judged.
    return { status: 0, outcome: errorCode(error) === "ENOTFOUND" ? "broken" : "unverified" };
  }
}

/** Every link on the crawled pages, menu links first, each checked once, within `budgetMs`. */
export async function checkLinks(site: Crawl, { budgetMs = 15_000, cap = 250 } = {}) {
  const host = bare(new URL(site.home.url).host);
  const navSet = new Set(site.home.nav);
  const links = new Map<string, Link>();
  for (const page of site.pages) {
    for (const url of page.links) {
      if (links.has(url)) continue;
      links.set(url, { url, from: page.path, nav: navSet.has(url), internal: bare(new URL(url).host) === host });
    }
  }
  const ordered = [...links.values()]
    .sort((a, b) => Number(b.nav) - Number(a.nav) || Number(b.internal) - Number(a.internal))
    .slice(0, cap);

  const deadline = performance.now() + budgetMs;
  const results = new Map<string, { status: number; outcome: Outcome }>();
  for (const link of ordered) {
    const known = site.statuses.get(link.url);
    if (known !== undefined && known > 0) {
      results.set(link.url, { status: known, outcome: known === 404 || known === 410 ? "broken" : "ok" });
    }
  }
  const check = async (link: Link) => {
    results.set(link.url, await probe(link.url));
  };
  const todo = ordered.filter((l) => !results.has(l.url));
  await Promise.all([
    pool(
      todo.filter((l) => l.internal),
      4,
      check,
      deadline,
    ),
    pool(
      todo.filter((l) => !l.internal),
      8,
      check,
      deadline,
    ),
  ]);

  const broken = ordered.flatMap((l) => {
    const r = results.get(l.url);
    if (r?.outcome !== "broken") return [];
    const url = l.internal ? new URL(l.url).pathname + new URL(l.url).search : l.url;
    return [{ url, status: r.status, from: l.from, nav: l.nav, internal: l.internal }];
  });
  return {
    pages: site.pages.length,
    checked: results.size,
    broken,
    unverified: [...results.values()].filter((r) => r.outcome === "unverified").length,
  };
}

/** Rubric: 100, less 10 per broken menu link, 5 per other broken link on the site and 2 per broken external link. */
export function linksFinding(result: Awaited<ReturnType<typeof checkLinks>>): Finding<"links"> {
  const { pages, checked, broken, unverified } = result;
  const nav = broken.filter((b) => b.nav).length;
  const internal = broken.filter((b) => b.internal && !b.nav).length;
  const external = broken.length - nav - internal;
  const score = 100 - nav * 10 - internal * 5 - external * 2;
  const data = { pages, checked, unverified, broken: broken.map(({ internal: _, ...b }) => b) };
  const across = `across ${plural(pages, "page")}`;
  if (!broken.length) return scored(100, `No broken links among ${checked} checked ${across}`, data);
  const menu = nav ? `, ${nav} of them in the menu` : "";
  return scored(score, `${plural(broken.length, "broken link")} ${across}${menu}`, data, String(broken.length));
}

/** Rubric: per page, 60 for a title and 40 for a description, averaged. */
export function checkSeo(pages: Page[]): Finding<"seo"> {
  if (!pages.length) return skipped("No pages could be read");
  const missing = pages.filter((p) => !p.title || !p.description).map((p) => p.path);
  const titled = pages.filter((p) => p.title).length;
  const described = pages.filter((p) => p.description).length;
  const titles = pages.map((p) => p.title).filter(Boolean);
  const duplicateTitles = titles.filter((t, _, all) => all.indexOf(t) !== all.lastIndexOf(t)).length;
  const withBoth = pages.length - missing.length;
  const data = { pages: pages.length, withTitleAndDescription: withBoth, missing, duplicateTitles };
  const n = pages.length;
  const score = (titled * 60 + described * 40) / n;
  const dupes = duplicateTitles ? `; ${duplicateTitles} share a title` : "";
  const summary =
    withBoth === n
      ? `Titles and descriptions on all ${plural(n, "page")}${dupes}`
      : titled === n
        ? `Titles on every page, but descriptions on ${described ? `only ${described} of ${n}` : `none of ${n}`}${dupes}`
        : `Titles and descriptions on ${withBoth} of ${plural(n, "page")}${dupes}`;
  return scored(score, summary, data, `${withBoth} / ${n}`);
}
