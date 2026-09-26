import { createCn } from "cn/config";

// Teach the merger our theme tokens so it resolves conflicts correctly —
// without this, `text-fl-30` reads as a colour and loses to `text-paper`.
const fluid = (v: string) => /^fl-\d+$/.test(v);

export const cn = createCn({
  extend: {
    theme: {
      text: [fluid],
      spacing: [fluid, "gutter"],
      tracking: ["display", "heading", "label", "label-tight"],
    },
    classGroups: {
      px: ["px-page"],
    },
  },
});
