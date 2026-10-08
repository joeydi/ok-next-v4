import type { HTMLElement } from "node-html-parser";
import { type FetchResult, fetchOk } from "./fetch";
import { type Finding, scored } from "./score";

export type Indexing = {
  robots: boolean;
  /** robots.txt shuts every crawler out of the whole site. */
  blocked: boolean;
  sitemap: string | null;
  /** Page URLs listed in the sitemap, for the crawl. */
  urls: string[];
};

/** Lines of the robots.txt group for `User-agent: *`. */
function starGroup(robots: string) {
  const lines: string[] = [];
  let inStar = false;
  let agents = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [key, ...rest] = line.split(":");
    const field = key.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (field === "user-agent") {
      inStar = (agents ? inStar : false) || value === "*";
      agents = true;
    } else if (line) {
      agents = false;
      if (inStar) lines.push(`${field}:${value}`);
    }
  }
  return lines;
}

const locs = (xml: string) =>
  [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/g)].map((m) => m[1].replace(/&amp;/g, "&"));

/** robots.txt, then the first sitemap that answers: robots' own, or one of the usual paths. */
export async function readIndexing(origin: string): Promise<Indexing> {
  const robotsRes = await fetchOk(`${origin}/robots.txt`, { timeoutMs: 5000, maxBytes: 200_000 });
  const robots = robotsRes && /user-agent|sitemap|disallow/i.test(robotsRes.body) ? robotsRes.body : null;
  const blocked = !!robots && starGroup(robots).includes("disallow:/");
  const listed = robots ? [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
  const candidates = [
    ...new Set([...listed, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`]),
  ];

  for (const url of candidates) {
    const res = await fetchOk(url, { timeoutMs: 5000 });
    if (!res || !/<(urlset|sitemapindex)[\s>]/.test(res.body)) continue;
    let urls = locs(res.body);
    // An index lists sitemaps: read the one for pages if there is one, else the first.
    if (/<sitemapindex[\s>]/.test(res.body)) {
      const child = urls.find((u) => /page/i.test(u)) ?? urls[0];
      const childRes = child ? await fetchOk(child, { timeoutMs: 5000 }) : null;
      urls = childRes ? locs(childRes.body) : [];
    }
    return { robots: !!robots, blocked, sitemap: res.url, urls };
  }
  return { robots: !!robots, blocked, sitemap: null, urls: [] };
}

/** `noindex` from the home page's robots meta or X-Robots-Tag header. */
export function isNoindex(home: FetchResult, doc: HTMLElement) {
  const meta = doc
    .querySelectorAll("meta")
    .filter((m) => /^(robots|googlebot)$/i.test(m.getAttribute("name") ?? ""))
    .map((m) => m.getAttribute("content") ?? "");
  return [...meta, String(home.headers["x-robots-tag"] ?? "")].some((v) => /noindex/i.test(v));
}

/** Rubric: home page noindexed, or every crawler blocked 0 · no sitemap 70 · else 100. */
export function checkIndexing(indexing: Indexing, noindex: boolean): Finding<"indexing"> {
  const { robots, blocked, sitemap } = indexing;
  const data = { sitemap, robots, blocked, noindex };
  if (noindex) return scored(0, "The home page tells search engines not to index it", data, "noindex");
  if (blocked) return scored(0, "robots.txt blocks every search engine from the whole site", data, "blocked");
  if (!sitemap)
    return scored(70, robots ? "robots.txt is fine, but there’s no sitemap" : "No sitemap or robots.txt", data);
  const name = new URL(sitemap).pathname.slice(1);
  return scored(100, robots ? `${name} and robots.txt look right` : `${name} found; no robots.txt`, data);
}
