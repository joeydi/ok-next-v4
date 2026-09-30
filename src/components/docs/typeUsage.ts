import fs from "node:fs";
import path from "node:path";

// The type styles the site actually sets, for the Typography doc: every className
// with a --text-fl-* size (or mono-label) in src/app and src/components, and every
// rule in globals.css that sets one, grouped by face, size, weight, leading and
// tracking. Read on every call, like src/lib/tokens.ts. The admin, the docs and
// dev-only files are left out, so it describes only what ships.

export type Face = "display" | "sans" | "mono";

export type TypeStyle = {
  face: Face;
  /** The --text-fl-* token, as in `text-fl-24`. */
  size: string;
  weight?: number;
  /** A line-height: a number as written, or "normal". Unset inherits the body's "normal". */
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

/** A className's classes as one style, or null when it sets no size. */
function fromClasses(classes: string): Omit<TypeStyle, "uses" | "sample"> | null {
  const has = (re: RegExp) => re.test(classes);
  const label = has(/(?<![\w:-])mono-label\b/);
  const size = classes.match(/(?<![\w:-])text-fl-(\d+)\b/)?.[1] ?? (label ? "14" : null);
  if (!size) return null;
  const face: Face = has(/(?<![\w:-])(?:font-)?display\b/)
    ? "display"
    : label || has(/(?<![\w:-])font-mono\b/)
      ? "mono"
      : "sans";
  const leadingClass = classes.match(/(?<![\w:-])leading-(none|normal|\[([\d.]+)\])/);
  const leading =
    leadingClass && (leadingClass[1] === "none" ? "1" : (leadingClass[2] && num(leadingClass[2])) || "normal");
  const token = classes.match(/(?<![\w:-])tracking-([a-z-]+)\b/)?.[1];
  const em = classes.match(/(?<![\w:-])tracking-\[(-?[\d.]+)em\]/)?.[1];
  const weight = classes.match(/(?<![\w:-])font-(medium|semibold|bold)\b/)?.[1];
  return {
    face,
    size,
    weight: weight ? WEIGHTS[weight] : undefined,
    leading: leading ?? undefined,
    tracking: em ? { em: Number(em) } : token ? { token } : label ? { token: "label" } : undefined,
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
    const sized = strings.filter((s) => /text-fl-\d+|mono-label/.test(s));
    const shared = strings.filter((s) => !sized.includes(s)).join(" ");
    const sample = textAfter(src, end);
    for (const s of sized) {
      const style = fromClasses(`${shared} ${s}`);
      if (style) add({ ...style, sample }, lineOf(src, at));
    }
  }
}

/** Rules in globals.css that set a --text-fl-* size, with their family, leading and tracking. */
function fromCss(src: string, add: (s: Omit<TypeStyle, "uses">, line: number) => void) {
  for (const m of src.matchAll(/font-size:\s*var\(--text-fl-(\d+)\)/g)) {
    const open = src.lastIndexOf("{", m.index);
    const body = src.slice(open, src.indexOf("}", m.index));
    const family = body.match(/font-family:\s*var\(--font-(\w+)\)/)?.[1];
    const leading = body.match(/line-height:\s*([\d.]+|normal)/)?.[1];
    const token = body.match(/letter-spacing:\s*var\(--tracking-([a-z-]+)\)/)?.[1];
    const weight = body.match(/font-weight:\s*(\d+)/)?.[1];
    add(
      {
        face: family === "display" ? "display" : family === "mono" ? "mono" : "sans",
        size: m[1],
        weight: weight && weight !== "400" && family !== "mono" ? Number(weight) : undefined,
        leading: leading && leading !== "normal" ? num(leading) : leading,
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
  const addFrom = (file: string) => (style: Omit<TypeStyle, "uses">, line: number) => {
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
