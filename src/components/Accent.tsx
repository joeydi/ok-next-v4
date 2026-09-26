/** Renders text with *starred* words in pink: "Front and *Center*". */
export function Accent({ text }: { text: string }) {
  return text.split(/\*(.+?)\*/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="text-pink">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
