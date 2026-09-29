// Part of `npm run check`: keeps the design docs on the site's tokens. The docs
// (src/content/docs) and their components (src/components/docs) read colours and
// curves from globals.css through src/lib/tokens.ts, so a literal colour, curve or
// stylesheet there is a copy that will drift.

import fs from "node:fs";
import path from "node:path";

const DIRS = ["src/content/docs", "src/components/docs"];
const RULES = [
  [/#[0-9a-f]{3,8}\b/i, "a hex colour: use a --color-* token (a Tailwind class, or var(--color-…))"],
  [/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.]/i, "a literal colour: use a --color-* token"],
  [/cubic-bezier\(\s*-?[\d.]/i, "a literal curve: use an --ease-* token (ease() in src/lib/tokens.ts)"],
  [/<style[\s>]/i, "a <style> block: use utilities, or add a rule to globals.css"],
];

const files = DIRS.flatMap((dir) =>
  fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, String(f))),
).filter((f) => /\.(mdx?|tsx?|css)$/.test(f));

const problems = [];
for (const file of files) {
  fs.readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const [re, why] of RULES) if (re.test(line)) problems.push(`${file}:${i + 1}  ${why}\n    ${line.trim()}`);
    });
}

if (problems.length) {
  console.error(`Design docs: ${problems.length} value(s) copied instead of read from the tokens\n`);
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Design docs: ${files.length} files use tokens only.`);
