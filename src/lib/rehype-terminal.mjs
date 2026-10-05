// Marks up ```text blocks as terminal output, after rehype-pretty-code has
// split them into lines (Shiki leaves plain text unhighlighted). A local
// plugin, passed by path in next.config.ts, since Turbopack can't take the
// function a Shiki transformer would need. Whole lines get a data attribute:
//
//   # a comment                  data-comment
//   STEP   LAYER   BY            data-heading  (only capitals and spaces)
//   --------------------         data-rule     (drawn as a dashed line)
//
// and within other lines, runs of plain text get a data-token:
//
//   generative    prompt         label   (a first word followed by a column gap)
//   → ↓                          arrow
//   [1/3]                        step
//   ········                     leader
//   ✓                            check
//
// Words that need an accent use rehype-pretty-code's own /word/#id meta, as in
// ```text /model/#yellow /code/2#pink; the ids are styled in globals.css.

const TOKENS = /([→←↑↓]|\[\d+\/\d+\]|·{2,}|✓)/;

const tokenFor = (value) => {
  if (value === "✓") return "check";
  if (value.startsWith("[")) return "step";
  if (value.startsWith("·")) return "leader";
  return "arrow";
};

const isElement = (node, tagName) => node?.type === "element" && (!tagName || node.tagName === tagName);

const textOf = (node) =>
  node.type === "text" ? node.value : (node.children ?? []).reduce((text, child) => text + textOf(child), "");

const span = (token, value) => ({
  type: "element",
  tagName: "span",
  properties: { "data-token": token },
  children: [{ type: "text", value }],
});

// Splits one text node into plain runs and token spans.
const splitText = (value) =>
  value
    .split(TOKENS)
    .filter(Boolean)
    .map((part) => (TOKENS.test(part) ? span(tokenFor(part), part) : { type: "text", value: part }));

// Rewrites the text under a line, leaving /word/ highlights (marks) as they are.
// The label is the line's opening word, found on the whole line since a /word/
// highlight can end the first text node, which is the only one that can hold it.
const markTokens = (node, state) => {
  node.children = node.children.flatMap((child) => {
    if (isElement(child, "mark")) {
      state.first = false;
      return [child];
    }
    if (isElement(child)) {
      markTokens(child, state);
      return [child];
    }
    if (child.type !== "text") return [child];
    const { label } = state;
    const opens = state.first && label && child.value.startsWith(label);
    state.first = false;
    if (!opens) return splitText(child.value);
    return [span("label", label), ...splitText(child.value.slice(label.length))];
  });
};

const markLine = (line) => {
  const text = textOf(line);
  if (/^\s*#/.test(text)) line.properties["data-comment"] = "";
  else if (/^\s*-{3,}\s*$/.test(text)) line.properties["data-rule"] = "";
  else if (/^[A-Z][A-Z ]*$/.test(text.trim())) line.properties["data-heading"] = "";
  else markTokens(line, { first: true, label: text.match(/^\S+(?= {2,}\S)/)?.[0] });
};

const visit = (node) => {
  if (isElement(node, "pre") && node.properties["data-language"] === "text") {
    const code = node.children.find((child) => isElement(child, "code"));
    for (const line of code?.children ?? []) {
      if (isElement(line) && "data-line" in line.properties) markLine(line);
    }
    return;
  }
  for (const child of node.children ?? []) visit(child);
};

export default function rehypeTerminal() {
  return (tree) => visit(tree);
}
