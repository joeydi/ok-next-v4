import type { HTMLElement } from "node-html-parser";
import type { Page } from "./crawl";
import { pool } from "./crawl";
import { type FetchResult, fetchOk } from "./fetch";
import { compareVersions, DAY, type Finding, plural, scored, skipped } from "./score";

// The platform, from what its pages give away. For WordPress: the core version
// (generator tag, then the feed, then core asset versions) judged by WordPress.org's
// own stable-check, and the plugins and theme whose files the pages load, looked up
// in the WordPress.org directory. Only the public pages and the files they link to
// are read.

const WPORG = "https://api.wordpress.org";

export type Platform = {
  name: string | null;
  label: string | null;
  /** Hosted builders that update themselves: Squarespace, Wix… */
  hosted: boolean;
  version: string | null;
};

/** How long a WordPress.org answer is kept, per function instance. */
const KEEP = 60 * 60 * 1000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();

function wporg<T>(path: string): Promise<T | null> {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < KEEP) return hit.value as Promise<T | null>;
  const value = fetch(`${WPORG}${path}`, { signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => {
      memo.delete(path);
      return null;
    });
  memo.set(path, { at: Date.now(), value });
  return value;
}

const generator = (doc: HTMLElement) =>
  doc
    .querySelectorAll("meta")
    .find((m) => (m.getAttribute("name") ?? "").toLowerCase() === "generator")
    ?.getAttribute("content") ?? "";

const HOSTED: [RegExp, string, string][] = [
  [/squarespace/i, "squarespace", "Squarespace"],
  [/wix\.com/i, "wix", "Wix"],
  [/webflow/i, "webflow", "Webflow"],
  [/shopify/i, "shopify", "Shopify"],
  [/framer/i, "framer", "Framer"],
  [/hubspot/i, "hubspot", "HubSpot"],
  [/weebly/i, "weebly", "Weebly"],
  [/godaddy|website builder/i, "godaddy", "GoDaddy"],
];

export function detectPlatform(home: FetchResult, doc: HTMLElement): Platform {
  const gen = generator(doc);
  const html = home.body;
  const link = String(home.headers.link ?? "");
  const server = String(home.headers.server ?? "");
  if (/api\.w\.org/.test(link) || /\/wp-(content|includes)\//.test(html) || /^WordPress/i.test(gen)) {
    return {
      name: "wordpress",
      label: "WordPress",
      hosted: false,
      version: gen.match(/WordPress\s+([\d.]+(?:-[\w-]+)?)/i)?.[1] ?? null,
    };
  }
  for (const [pattern, name, label] of HOSTED) {
    if (pattern.test(gen) || pattern.test(server) || (name === "squarespace" && /This is Squarespace/.test(html))) {
      return { name, label, hosted: true, version: null };
    }
  }
  if (home.headers["x-shopid"] || /cdn\.shopify\.com/.test(html)) {
    return { name: "shopify", label: "Shopify", hosted: true, version: null };
  }
  if (
    /^Drupal/i.test(gen) ||
    home.headers["x-drupal-cache"] ||
    home.headers["x-generator"]?.toString().startsWith("Drupal")
  ) {
    const version = (gen || String(home.headers["x-generator"])).match(/Drupal\s+(\d+)/i)?.[1] ?? null;
    return { name: "drupal", label: "Drupal", hosted: false, version };
  }
  if (/^Joomla/i.test(gen)) return { name: "joomla", label: "Joomla", hosted: false, version: null };
  if (/^Ghost/i.test(gen))
    return { name: "ghost", label: "Ghost", hosted: false, version: gen.match(/([\d.]+)/)?.[1] ?? null };
  return { name: null, label: null, hosted: false, version: null };
}

/** The WordPress version when the generator tag is hidden: the feed's generator, then core's own asset versions. */
async function wordpressVersion(origin: string, doc: HTMLElement): Promise<string | null> {
  const feed =
    doc.querySelector('link[rel=alternate][type="application/rss+xml"]')?.getAttribute("href") ?? `${origin}/feed/`;
  const res = await fetchOk(new URL(feed, origin).href, { timeoutMs: 5000, maxBytes: 50_000 });
  const fromFeed = res?.body.match(/<generator>https?:\/\/wordpress\.org\/\?v=([\d.]+)<\/generator>/)?.[1];
  if (fromFeed) return fromFeed;
  const html = doc.toString();
  return (
    html.match(/wp-includes\/css\/dist\/block-library\/style(?:\.min)?\.css\?ver=([\d.]+)/)?.[1] ??
    html.match(/wp-includes\/js\/wp-emoji-release\.min\.js\?ver=([\d.]+)/)?.[1] ??
    null
  );
}

/** When each PHP branch's security support ends. Older ones are already past it. */
const PHP_EOL: Record<string, string> = {
  "8.1": "2025-12-31",
  "8.2": "2026-12-31",
  "8.3": "2027-12-31",
  "8.4": "2028-12-31",
  "8.5": "2029-12-31",
};

function phpPastEol(php: string | null) {
  if (!php) return false;
  const branch = php.split(".").slice(0, 2).join(".");
  const eol = PHP_EOL[branch];
  return eol ? Date.parse(eol) < Date.now() : compareVersions(branch, "8.1") < 0;
}

/**
 * Rubric: insecure core 0 · outdated 60 · current 100 · version hidden doesn't count.
 * PHP past its end of life caps it at 50. Hosted builders don't count: they update themselves.
 */
export async function checkCms(platform: Platform, home: FetchResult, doc: HTMLElement): Promise<Finding<"cms">> {
  const php = String(home.headers["x-powered-by"] ?? "").match(/PHP\/([\d.]+)/)?.[1] ?? null;
  const base = { name: platform.name, version: platform.version, latest: null, status: null, php };
  if (!platform.name)
    return skipped("No CMS found: a custom or static site, so nothing to update from outside", base, "ok");
  if (platform.hosted) {
    return skipped(`Built on ${platform.label}, which keeps itself up to date`, base, "ok");
  }
  if (platform.name === "drupal" && platform.version && Number(platform.version) <= 7) {
    return scored(
      0,
      `Drupal ${platform.version}, which no longer gets security updates`,
      base,
      `Drupal ${platform.version}`,
    );
  }
  if (platform.name !== "wordpress") {
    const v = platform.version ? ` ${platform.version}` : "";
    return skipped(`Built on ${platform.label}${v}; I’ll check its version by hand`, base, "ok");
  }

  const origin = new URL(home.url).origin;
  const [version, stable, offers] = await Promise.all([
    platform.version ?? wordpressVersion(origin, doc),
    wporg<Record<string, "latest" | "outdated" | "insecure">>("/core/stable-check/1.0/"),
    wporg<{ offers: { current: string }[] }>("/core/version-check/1.7/"),
  ]);
  const latest = offers?.offers[0]?.current ?? null;
  const status = version ? (stable?.[version] ?? null) : null;
  const data = { ...base, version, latest, status };
  const eol = phpPastEol(php) ? `; PHP ${php} is past its end of life` : "";
  const cap = (score: number) => (eol ? Math.min(score, 50) : score);

  if (!version) {
    if (eol) return scored(50, `WordPress, version hidden${eol}`, data);
    return skipped("WordPress; the version is hidden, which is good practice", data, "ok");
  }
  if (status === "insecure") {
    return scored(
      0,
      `WordPress ${version} has known security holes; ${latest ?? "a fix"} is out`,
      data,
      version,
      "fail",
    );
  }
  if (/-/.test(version) || (latest && compareVersions(version, latest) > 0)) {
    return scored(cap(100), `WordPress ${version}, a pre-release${eol}`, { ...data, status: "latest" }, version);
  }
  if (status === "outdated" || (latest && compareVersions(version, latest) < 0)) {
    return scored(cap(60), `WordPress ${version}; ${latest} is out${eol}`, { ...data, status: "outdated" }, version);
  }
  return scored(cap(100), `WordPress ${version}, the latest${eol}`, data, version);
}

/** Slugs of the plugins or themes whose files appear in the pages' HTML, most-loaded first. */
function assetSlugs(pages: Page[], kind: "plugins" | "themes") {
  const counts = new Map<string, number>();
  const pattern = new RegExp(`wp-content\\\\?/${kind}\\\\?/([a-z0-9_.-]+)\\\\?/`, "gi");
  // Folders keep their case (Divi, not divi) so their files can be fetched; counted case-insensitively.
  const spelled = new Map<string, string>();
  for (const page of pages) {
    for (const [, slug] of page.html.matchAll(pattern)) {
      const key = slug.toLowerCase();
      if (!spelled.has(key)) spelled.set(key, slug);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => spelled.get(key) ?? key);
}

/** The version a plugin's own assets are tagged with (`?ver=`), which is usually its release. */
function assetVersion(pages: Page[], slug: string) {
  const pattern = new RegExp(`wp-content/plugins/${slug.replace(/[.]/g, "\\.")}/[^"'?\\s]+\\?ver=([\\d.]+)`, "gi");
  const seen = new Map<string, number>();
  for (const page of pages) {
    for (const [, v] of page.html.matchAll(pattern)) seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

type PluginInfo = {
  version?: string;
  last_updated?: string;
  /** "Plugin not found." or "closed". */
  error?: string;
  closed?: boolean;
  closed_date?: string;
};

const TWO_YEARS = 730 * DAY;

/**
 * Rubric: 100, less 25 for each closed or abandoned plugin (no release in two years)
 * and 10 for each out of date. Any closed plugin is a fail.
 */
export async function checkPlugins(platform: Platform, origin: string, pages: Page[]): Promise<Finding<"plugins">> {
  if (platform.name !== "wordpress") return skipped(`Not WordPress, so no plugins to check`);
  const slugs = assetSlugs(pages, "plugins").slice(0, 40);
  const empty = { seen: 0, stale: [], closed: [], outdated: [], unlisted: [] };
  if (!slugs.length) return skipped("No plugins visible from outside", empty, "ok");

  const results = await pool(slugs, 6, async (slug) => {
    const fields = "&request[fields][sections]=0&request[fields][description]=0&request[fields][versions]=0";
    const [info, readme] = await Promise.all([
      wporg<PluginInfo>(`/plugins/info/1.2/?action=plugin_information&request[slug]=${slug.toLowerCase()}${fields}`),
      fetchOk(`${origin}/wp-content/plugins/${slug}/readme.txt`, { timeoutMs: 4000, maxBytes: 20_000 }),
    ]);
    const stableTag = readme?.body.match(/^\s*Stable tag:\s*([\d.]+)\s*$/im)?.[1] ?? null;
    return { slug, info, version: stableTag ?? assetVersion(pages, slug) };
  });

  const data = { ...empty, seen: slugs.length } as {
    seen: number;
    stale: { slug: string; lastRelease: string }[];
    closed: { slug: string; closedAt: string | null }[];
    outdated: { slug: string; version: string; latest: string }[];
    unlisted: string[];
  };
  for (const r of results) {
    if (!r) continue;
    const { slug, info, version } = r;
    if (!info) continue;
    if (info.error || !info.version || !info.last_updated) {
      if (info.closed) data.closed.push({ slug, closedAt: info.closed_date ?? null });
      else data.unlisted.push(slug);
      continue;
    }
    const updated = Date.parse(info.last_updated.replace(/(\d+:\d+)(am|pm)/i, " $1 $2"));
    if (Number.isFinite(updated) && Date.now() - updated > TWO_YEARS) {
      data.stale.push({ slug, lastRelease: new Date(updated).toISOString().slice(0, 10) });
    } else if (version && compareVersions(version, info.version) < 0) {
      data.outdated.push({ slug, version, latest: info.version });
    }
  }

  const { closed, stale, outdated, seen } = data;
  const issues = closed.length + stale.length + outdated.length;
  const score = 100 - (closed.length + stale.length) * 25 - outdated.length * 10;
  if (!issues) {
    const all = seen === 1 ? "The one plugin I could see is" : `All ${seen} plugins I could see are`;
    return scored(100, `${all} maintained and current`, data);
  }
  const of = `the ${plural(seen, "plugin")} I could see`;
  const parts = [
    closed.length && `${closed.length} pulled from WordPress.org`,
    stale.length && `${stale.length} with no release in two years`,
    outdated.length && `${outdated.length} out of date`,
  ].filter(Boolean);
  return scored(
    score,
    `Of ${of}: ${parts.join(", ")}`,
    data,
    `${issues} of ${seen}`,
    closed.length ? "fail" : undefined,
  );
}

/** The `Theme Name:` and `Template:` (a child theme's parent) from a theme's style.css header. */
async function themeHeader(origin: string, slug: string) {
  const res = await fetchOk(`${origin}/wp-content/themes/${slug}/style.css`, { timeoutMs: 4000, maxBytes: 8_000 });
  const field = (name: string) => res?.body.match(new RegExp(`^[\\s*]*${name}:\\s*(.+)$`, "im"))?.[1].trim() ?? null;
  return { name: field("Theme Name"), template: field("Template") };
}

/** Rubric: the theme (or a child theme's parent) not updated in two years 50 · else 100. Custom and premium themes don't count. */
export async function checkTheme(platform: Platform, origin: string, pages: Page[]): Promise<Finding<"theme">> {
  if (platform.name !== "wordpress") return skipped("Not WordPress, so no theme to check");
  const slugs = assetSlugs(pages, "themes").slice(0, 3);
  if (!slugs.length) return skipped("The theme isn’t visible from outside");
  const headers = await Promise.all(slugs.map(async (slug) => ({ slug, ...(await themeHeader(origin, slug)) })));
  const active = headers.find((h) => h.template) ?? headers[0];
  const parent = active.template;
  const lookup = parent ?? active.slug;
  const info = await wporg<{ name?: string; last_updated?: string; error?: string }>(
    `/themes/info/1.2/?action=theme_information&request[slug]=${lookup.toLowerCase()}`,
  );
  const name = active.name ?? active.slug;
  const data = { name, slug: active.slug, child: !!parent, parent, updatedAt: info?.last_updated ?? null };
  const parentHeader = headers.find((h) => h.slug.toLowerCase() === parent?.toLowerCase());
  const parentName = info?.name ?? parentHeader?.name ?? parent;
  const label = parent ? `Child theme of ${parentName}` : name;
  if (!info?.last_updated) {
    return skipped(`${label}; a custom or premium theme, so I’ll check it by hand`, data, "ok");
  }
  const age = Date.now() - Date.parse(info.last_updated);
  const year = new Date(info.last_updated).getUTCFullYear();
  if (age > TWO_YEARS) return scored(50, `${label}, which hasn’t been updated since ${year}`, data, String(year));
  const when = year === new Date().getUTCFullYear() ? "this year" : `in ${year}`;
  return scored(100, `${label}, which was updated ${when}`, data);
}
