import fs from "node:fs";
import path from "node:path";

// The spacing the site actually sets, for the Spacing & layout doc: every padding,
// margin, gap and offset class in src/app and src/components, and every such
// declaration in globals.css, grouped by value. Read on every call, like
// src/lib/tokens.ts. The admin, the docs and dev-only files are left out, so it
// describes only what ships.

/**
 * - `token`: a --spacing-* token (`fl-24`, `gutter`)
 * - `fixed`: a px value that doesn't scale: a Tailwind step (`gap-2`), `[18px]` or `18px` in CSS
 * - `relative`: em or %, sized off the text or the box
 * - `derived`: a calc() and the like, worked out from other values
 */
export type SpaceKind = "token" | "fixed" | "relative" | "derived";

export type SpaceValue = {
  kind: SpaceKind;
  /** The token's name after `--spacing-`, px for a fixed value (`8px`), or the value as written. */
  value: string;
  /** Its px, for a fixed value. */
  px?: number;
  /** What it spaces: padding, margin, gap, offset or scroll. */
  props: string[];
  /** Each place, with the class or declaration as written. */
  uses: { file: string; line: number; text: string }[];
};

const ROOT = process.cwd();
const DIRS = ["src/app", "src/components"];
const SKIP = [/^src\/app\/admin\//, /^src\/components\/docs\//, /\.dev\.tsx?$/];
const CSS = "src/app/globals.css";
// Tailwind's spacing step: `gap-2` is 2 × 0.25rem.
const STEP = 4;

const lineOf = (text: string, i: number) => text.slice(0, i).split("\n").length;

/** A padding/margin/gap/offset class's property group and value, as in `lg:-mt-fl-24`. */
const CLASS =
  /^-?(p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end|scroll-[mp][xytrblse]?)-(.+)$/;

function groupOf(prop: string) {
  if (prop.startsWith("scroll")) return "scroll";
  if (/^p/.test(prop)) return "padding";
  if (/^m/.test(prop)) return "margin";
  if (/^(gap|space|row-gap|column-gap)/.test(prop)) return "gap";
  return "offset";
}

type Found = { kind: SpaceKind; value: string; px?: number };

/** A class's value: `fl-24`, `2`, `px`, `[18px]`, `[calc(…)]`. Null for 0, auto and fractions. */
function classValue(v: string): Found | null {
  if (/^fl-\d+$/.test(v)) return { kind: "token", value: v };
  if (v === "px") return { kind: "fixed", value: "1px", px: 1 };
  if (/^[\d.]+$/.test(v)) return Number(v) ? fixed(Number(v) * STEP) : null;
  const arbitrary = v.match(/^\[(.+)\]$/)?.[1];
  return arbitrary ? cssValue(arbitrary.replaceAll("_", " ")) : null;
}

/** One CSS length: a --spacing-* token, px/rem, em/%, or anything worked out. Null for 0, auto and anchor(). */
function cssValue(v: string): Found | null {
  const token = v.match(/^var\(--spacing-([a-z0-9-]+)\)$/)?.[1];
  if (token) return { kind: "token", value: token };
  const len = v.match(/^(-?[\d.]+)(px|rem)$/);
  if (len) return Number(len[1]) ? fixed(Math.abs(Number(len[1])) * (len[2] === "rem" ? 16 : 1)) : null;
  if (/^-?[\d.]+(em|%)$/.test(v)) return { kind: "relative", value: v };
  // Anchor positioning places a box against another; it isn't a space.
  if (v === "0" || v === "auto" || /^anchor\(/.test(v)) return null;
  return { kind: "derived", value: v };
}

function fixed(px: number): Found {
  const r = Math.round(px * 100) / 100;
  return { kind: "fixed", value: `${r}px`, px: r };
}

/** A class without its variants: `lg:hover:-mt-4` → `-mt-4`, leaving colons inside brackets alone. */
function base(cls: string) {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] === "[") depth++;
    else if (cls[i] === "]") depth--;
    else if (cls[i] === ":" && !depth) cut = i + 1;
  }
  return cls.slice(cut);
}

type Add = (found: Found, prop: string, line: number, text: string) => void;

// Every string in the file, so classes built up in cn() or kept in a variable count too.
function fromTsx(src: string, add: Add) {
  for (const m of src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
    const text = m[1] ?? m[2];
    let at = 0;
    for (const cls of text.split(/\s+/)) {
      const offset = text.indexOf(cls, at);
      at = offset + cls.length;
      const c = base(cls).match(CLASS);
      const found = c && classValue(c[2]);
      if (found) add(found, groupOf(c[1]), lineOf(src, m.index + 1 + offset), cls);
    }
  }
}

/** A CSS value's parts, split on spaces outside brackets: `var(--a) calc(1px + 2px)` → 2 parts. */
function parts(value: string) {
  const out = [""];
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (/\s/.test(ch) && !depth) {
      if (out[out.length - 1]) out.push("");
    } else out[out.length - 1] += ch;
  }
  return out.filter(Boolean);
}

/** The selector a declaration sits in, as written. */
function selectorOf(src: string, i: number) {
  const open = src.lastIndexOf("{", i);
  const before = Math.max(src.lastIndexOf("}", open - 1), src.lastIndexOf("{", open - 1), src.lastIndexOf(";", open));
  return src
    .slice(before + 1, open)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
}

function fromCss(src: string, add: Add) {
  const re =
    /(?<![\w-])(padding|margin|gap|row-gap|column-gap|top|right|bottom|left|inset|scroll-margin|scroll-padding)(?:-(?:top|right|bottom|left|block|inline|start|end|block-start|block-end|inline-start|inline-end))?:\s*([^;{}]+);/g;
  for (const m of src.matchAll(re)) {
    // The admin's doc layout isn't the site's.
    if (/\.doc-body/.test(selectorOf(src, m.index))) continue;
    const value = m[2].trim();
    const line = lineOf(src, m.index);
    const text = m[0];
    // A shorthand counts once per part, and a worked-out part once, as written.
    for (const p of parts(value)) {
      const found = cssValue(p);
      if (found) add(found, groupOf(m[1]), line, text);
    }
  }
}

/** Every spacing value the site sets: tokens by step, then the rest largest first. */
export function spaceUsage(): SpaceValue[] {
  const values = new Map<string, SpaceValue>();
  const addFrom =
    (file: string): Add =>
    (found, prop, line, text) => {
      const key = `${found.kind}|${found.value}`;
      const v = values.get(key) ?? { ...found, props: [], uses: [] };
      if (!v.props.includes(prop)) v.props.push(prop);
      if (!v.uses.some((u) => u.line === line && u.file === file && u.text === text)) v.uses.push({ file, line, text });
      values.set(key, v);
    };

  for (const dir of DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir), { recursive: true })) {
      const file = path.join(dir, String(f));
      if (!file.endsWith(".tsx") || SKIP.some((re) => re.test(file))) continue;
      fromTsx(fs.readFileSync(path.join(ROOT, file), "utf8"), addFrom(file));
    }
  }
  fromCss(fs.readFileSync(path.join(ROOT, CSS), "utf8"), addFrom(CSS));

  const order = (v: SpaceValue) => ["token", "fixed", "relative", "derived"].indexOf(v.kind);
  return [...values.values()].sort(
    (a, b) => order(a) - order(b) || (b.px ?? 0) - (a.px ?? 0) || b.uses.length - a.uses.length,
  );
}
