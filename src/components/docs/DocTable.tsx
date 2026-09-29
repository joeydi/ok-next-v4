import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DocColumn = { label: string; align?: "end" };

/**
 * A ruled reference table in mono, like the Open Graph admin's tags: a mono-label
 * header and subtle rules between rows. Scrolls sideways on its own when narrow.
 */
export function DocTable({ columns, rows }: { columns: DocColumn[]; rows: ReactNode[][] }) {
  const align = (i: number) => columns[i]?.align === "end" && "text-right";
  return (
    <div className="doc-wide overflow-x-auto">
      <table className="w-full border-collapse font-mono text-fl-14 leading-[1.5] text-ink-2">
        <thead>
          <tr className="border-b border-rule">
            {columns.map((c, i) => (
              <th
                key={c.label}
                scope="col"
                className={cn("mono-label pr-fl-24 pb-3 text-left whitespace-nowrap text-muted last:pr-0", align(i))}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-rule/60">
              {row.map((cell, i) => (
                <td key={i} className={cn("py-3 pr-fl-24 align-top last:pr-0", align(i))}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Label and value pairs, ruled like <DocTable>: a curve's halfway point, where it's used. */
export function DocFacts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] font-mono text-fl-14 leading-[1.5] text-ink-2">
      {items.map(([k, v]) => (
        <div key={k} className="col-span-2 grid grid-cols-subgrid gap-x-fl-16 border-t border-rule/60 py-2.5">
          <dt className="mono-label text-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
