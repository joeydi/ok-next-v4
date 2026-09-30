import { createCn } from "cn/config";

// Teach the merger our theme tokens so it resolves conflicts correctly —
// without this, `text-fl-30` reads as a colour and loses to `text-paper`.
const fluid = (v: string) => /^fl-\d+$/.test(v);

export const cn = createCn({
  extend: {
    theme: {
      text: [fluid],
      spacing: [fluid, "gutter"],
      container: ["page"],
      tracking: ["display", "label", "label-tight", (v: string) => /^display-\d+$/.test(v)],
      leading: ["body", "intro", "copy", "mono", "code", (v: string) => /^(heading|display-text)-\d+$/.test(v)],
    },
    classGroups: {
      px: ["px-page"],
    },
  },
});
