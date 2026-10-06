// The sample monthly report in the website care diagram: three of its eight pages,
// for Columbia Capital in September 2026. The figures agree with each other: one
// uptime check a minute for 30 days is 43,200, and the summary's tiles repeat
// what the later pages report.

export const CLIENT = { name: "Columbia Capital", domain: "colcap.com", period: "September 2026" };
export const PAGES = 8;

/** Page 1: the summary. A status is how a line reads: done, nothing to do, or worth a look. */
export type Status = "ok" | "none" | "watch";

export const SUMMARY = {
  meta: ["Prepared by Joe di Stefano", "Oct 5, 2026", "17 checks"],
  tiles: [
    { k: "Uptime", v: "100.00%", d: "0 outages" },
    { k: "Response", v: "524 ms", d: "average" },
    { k: "Lighthouse", v: "93–97", d: "perf, 3 pages" },
    { k: "SSL", v: "A+", d: "88 days left" },
    { k: "WAVE", v: "0", d: "errors" },
  ],
  changes: [
    { s: "ok", t: "18 plugin updates across 8 plugins." },
    { s: "ok", t: "WordPress updated 7.1.1 » 7.1.2." },
    { s: "ok", t: "6 posts updated, 1 moved to trash." },
    { s: "none", t: "No user accounts added or removed." },
    { s: "watch", t: "3 Site Health items open, 0 critical." },
    { s: "watch", t: "2 certificates expire from Jan 2." },
  ] satisfies { s: Status; t: string }[],
  updates: {
    n: "02",
    title: "Plugin updates applied",
    count: "18 updates",
    cols: ["Plugin", "Kind", "From", "To", "Date"],
    rows: [
      ["Safe SVG", "plugin", "2.5.0", "2.5.1", "Sep 24"],
      ["Redirection", "plugin", "5.10.0", "5.10.1", "Sep 22"],
      ["Yoast SEO", "plugin", "28.4", "28.5", "Sep 16"],
      ["Twenty Twenty-Five", "theme", "1.4", "1.5", "Sep 16"],
      ["Advanced Custom Fields PRO", "plugin", "6.8.9", "6.8.10", "Sep 14"],
    ],
  },
};

/** Page 3: uptime, a day a bar, and the certificates. */
export const UPTIME = {
  n: "04",
  title: "Uptime monitoring",
  uptime: "100.00%",
  days: 30,
  stats: [
    { k: "Checks", v: "43,200" },
    { k: "Average", v: "524 ms" },
    { k: "P95 response", v: "812 ms" },
  ],
  ssl: {
    n: "05",
    title: "SSL certificates",
    count: "2 domains",
    cols: ["Domain", "Issuer", "Grade", "Expires"],
    rows: [
      ["colcap.com", "Let’s Encrypt", "A+", "Jan 2, 2027"],
      ["www.colcap.com", "Let’s Encrypt", "A+", "Jan 2, 2027"],
    ],
  },
};

/** Page 5: Lighthouse scores and Core Web Vitals, for each page tested. */
export const PERFORMANCE = {
  n: "11",
  title: "Performance tests",
  count: "69 audits",
  notes: ["69 Lighthouse audits ran across 3 pages this period.", "Averages held steady against the previous period."],
  scores: {
    cols: ["Page", "Perf", "A11y", "Best pr.", "SEO"],
    rows: [
      ["/", 93, 100, 100, 100],
      ["/about", 97, 100, 100, 100],
      ["/contact", 96, 100, 100, 100],
    ] as const,
  },
  vitals: {
    cols: ["Page", "LCP", "FCP", "TBT", "CLS"],
    rows: [
      ["/", "1.7s", "0.7s", "0 ms", "0"],
      ["/about", "2.1s", "0.8s", "36 ms", "0.003"],
      ["/contact", "1.4s", "0.8s", "29 ms", "0"],
    ],
  },
};
