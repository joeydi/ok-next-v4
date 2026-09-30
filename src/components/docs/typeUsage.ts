import fs from "node:fs";
import path from "node:path";
import { leadings } from "@/lib/tokens";

// The type styles the site actually sets, for the Typography doc: every className
// with a --text-fl-* size (or mono-label) in src/app and src/components, and every
// rule in globals.css that sets one, grouped by face, size, weight, leading and
// tracking. Read on every call, like src/lib/tokens.ts. The admin, the docs and
// dev-only files are left out, so it describes only what ships.

/** "code" is Plex Mono too, in the code blocks' own style. */
export type Face = "display" | "sans" | "mono" | "code";

export type TypeStyle = {
  face: Face;
  /** The --text-fl-* token, as in `text-fl-24`. */
  size: string;
  weight?: number;
  /** A line-height as a number, or "normal" (the font's own). Unset takes --leading-body. */
  leading?: string;
  /** A --tracking-* token name, or `em` for a value written inline. */
  tracking?: { token: string } | { em: number };
  uppercase: boolean;
  /** Literal text from one of its elements, when it has some. */
  sample?: string;
  uses: { file: string; line: number }[];
};

const ROOT = process.cwd();
const DIRS = ["src/app", "src/components"];
const SKIP = [/^src\/app\/admin\//, /^src\/components\/docs\//, /\.dev\.tsx?$/];
const CSS = "src/app/globals.css";

const WEIGHTS: Record<string, number> = { medium: 500, semibold: 600, bold: 700 };
const lineOf = (text: string, i: number) => text.slice(0, i).split("\n").length;
const num = (v: string) => String(Number(v));

// Tailwind's own --leading-* scale, for the names globals.css doesn't set. Note
// `leading-normal` is 1.5, not CSS's font-dependent "normal".
const TAILWIND_LEADING: Record<string, number> = { tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 };

/** A line-height class's value: `leading-none`, `leading-[1.6]` or a --leading-* token. */
function leadingOf(classes: string) {
  const m = classes.match(/(?<![\w:-])leading-(?:\[([\d.]+)\]|([a-z][a-z0-9-]*))/);
  if (!m) return undefined;
  if (m[1]) return num(m[1]);
  if (m[2] === "none") return "1";
  const token = leadings()[m[2]] ?? TAILWIND_LEADING[m[2]];
  return token === undefined ? undefined : num(String(token));
}

/** A className's classes as one style, or null when it sets no size. */
function fromClasses(classes: string): Omit<TypeStyle, "uses" | "sample"> | null {
  const has = (re: RegExp) => re.test(classes);
  // The mono utilities: caps labels, and text that isn't caps.
  const label = has(/(?<![\w:-])mono-label\b/);
  const text = has(/(?<![\w:-])mono-text\b/);
  const size = classes.match(/(?<![\w:-])text-fl-(\d+)\b/)?.[1] ?? (label || text ? "14" : null);
  if (!size) return null;
  const face: Face = has(/(?<![\w:-])(?:font-)?display\b/)
    ? "display"
    : label || text || has(/(?<![\w:-])font-mono\b/)
      ? "mono"
      : "sans";
  // Both mono utilities set --leading-mono themselves.
  const leading = leadingOf(classes) ?? (label || text ? num(String(leadings().mono)) : undefined);
  const token = classes.match(/(?<![\w:-])tracking-([a-z-]+)\b/)?.[1];
  const em = classes.match(/(?<![\w:-])tracking-\[(-?[\d.]+)em\]/)?.[1];
  const weight = classes.match(/(?<![\w:-])font-(medium|semibold|bold)\b/)?.[1];
  return {
    face,
    size,
    weight: weight ? WEIGHTS[weight] : undefined,
    leading,
    tracking: em
      ? { em: Number(em) }
      : token
        ? { token }
        : label
          ? { token: "label" }
          : text
            ? { token: "label-tight" }
            : undefined,
    uppercase: label || has(/(?<![\w:-])uppercase\b/),
  };
}

/** A className attribute's source (`"…"` or `{cn(…)}`), and where it ends. */
function attribute(src: string, start: number): { text: string; end: number } {
  const open = src[start];
  if (open === '"') {
    const end = src.indexOf('"', start + 1);
    return { text: src.slice(start, end + 1), end: end + 1 };
  }
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return { text: src.slice(start, i + 1), end: i + 1 };
  }
  return { text: "", end: start };
}

/** Plain text right inside the element, if it opens straight onto some. */
function textAfter(src: string, end: number) {
  const m = src.slice(end, end + 400).match(/^[^<>]*?(?<!\/)>\s*([^<>{}]+?)\s*</);
  const text = m?.[1];
  return text && text.length > 2 && !/[=;()]/.test(text) ? text : undefined;
}

function fromTsx(src: string, add: (s: Omit<TypeStyle, "uses">, line: number) => void) {
  for (const m of src.matchAll(/className=(?=["{])/g)) {
    const at = m.index + m[0].length;
    const { text, end } = attribute(src, at);
    const strings = [...text.matchAll(/"([^"]*)"|`([^`]*)`/g)].map((s) => s[1] ?? s[2]);
    // Strings that set a size are alternatives (`small ? "text-fl-12" : "text-fl-14"`);
    // the rest (the face, the leading) apply to each.
    const sized = strings.filter((s) => /text-fl-\d+|mono-(?:label|text)\b/.test(s));
    const shared = strings.filter((s) => !sized.includes(s)).join(" ");
    const sample = textAfter(src, end);
    for (const s of sized) {
      const style = fromClasses(`${shared} ${s}`);
      if (style) add({ ...style, sample }, lineOf(src, at));
    }
  }
}

/** A rule's line-height: a number, "normal", or a --leading-* token's value. */
function ruleLeading(body: string) {
  const m = body.match(/line-height:\s*(?:var\(--leading-([a-z][a-z0-9-]*)\)|([\d.]+|normal))/);
  if (!m) return undefined;
  const v = m[1] ? leadings()[m[1]] : m[2];
  return v === undefined || v === "normal" ? v : num(String(v));
}

/**
 * Rules in globals.css that set a --text-fl-* size, with their family, leading and
 * tracking, and rules that `@apply` a mono utility, with their own leading.
 */
function fromCss(src: string, add: (s: Omit<TypeStyle, "uses">, line: number) => void) {
  for (const m of src.matchAll(/@apply ([^;]*\bmono-(?:label|text)\b[^;]*);/g)) {
    const open = src.lastIndexOf("{", m.index);
    const style = fromClasses(m[1]);
    const leading = ruleLeading(src.slice(open, src.indexOf("}", m.index)));
    if (style) add({ ...style, leading: leading ?? style.leading }, lineOf(src, open));
  }
  for (const m of src.matchAll(/font-size:\s*var\(--text-fl-(\d+)\)/g)) {
    const open = src.lastIndexOf("{", m.index);
    const body = src.slice(open, src.indexOf("}", m.index));
    const selector = src.slice(src.lastIndexOf("}", open) + 1, open);
    const family = /\b(?:pre|code)\b/.test(selector) ? "code" : body.match(/font-family:\s*var\(--font-(\w+)\)/)?.[1];
    const leading = ruleLeading(body);
    const token = body.match(/letter-spacing:\s*var\(--tracking-([a-z-]+)\)/)?.[1];
    const weight = body.match(/font-weight:\s*(\d+)/)?.[1];
    add(
      {
        face: family === "display" || family === "mono" || family === "code" ? family : "sans",
        size: m[1],
        weight: weight && weight !== "400" && family !== "mono" ? Number(weight) : undefined,
        leading,
        tracking: token ? { token } : undefined,
        uppercase: /text-transform:\s*uppercase/.test(body),
      },
      lineOf(src, open),
    );
  }
}

const keyOf = (s: Omit<TypeStyle, "uses" | "sample">) =>
  [s.face, s.size, s.weight, s.leading, JSON.stringify(s.tracking), s.uppercase].join("|");

/** Every type style the site sets, largest first, then most used. */
export function typeStyles(): TypeStyle[] {
  const styles = new Map<string, TypeStyle>();
  // Unset leading inherits the body's.
  const body = num(String(leadings().body));
  const addFrom = (file: string) => (set: Omit<TypeStyle, "uses">, line: number) => {
    const style = { ...set, leading: set.leading ?? body };
    const key = keyOf(style);
    const found = styles.get(key);
    if (found) {
      found.uses.push({ file, line });
      found.sample ??= style.sample;
    } else styles.set(key, { ...style, uses: [{ file, line }] });
  };

  for (const dir of DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir), { recursive: true })) {
      const file = path.join(dir, String(f));
      if (!file.endsWith(".tsx") || SKIP.some((re) => re.test(file))) continue;
      fromTsx(fs.readFileSync(path.join(ROOT, file), "utf8"), addFrom(file));
    }
  }
  fromCss(fs.readFileSync(path.join(ROOT, CSS), "utf8"), addFrom(CSS));

  return [...styles.values()].sort((a, b) => Number(b.size) - Number(a.size) || b.uses.length - a.uses.length);
}
