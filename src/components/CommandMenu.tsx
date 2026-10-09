"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { CommandGroup, CommandItem } from "@/lib/routes";
import { MediaImage } from "./MediaImage";

const optionId = (i: number) => `command-option-${i}`;

/** Whether every word of the query appears in the text. */
const matches = (terms: string[], text: string) => terms.every((t) => text.toLowerCase().includes(t));

/**
 * The group's items that match the query anywhere (label, path, group, description or
 * details), those matching on their label, path or group first.
 */
function filter(terms: string[], group: CommandGroup) {
  const title = (item: CommandItem) => matches(terms, `${group.label} ${item.label} ${item.href}`);
  const anywhere = (item: CommandItem) =>
    title(item) ||
    matches(terms, `${group.label} ${item.label} ${item.description ?? ""} ${item.info.flat().join(" ")}`);
  const hits = group.items.filter(anywhere);
  return [...hits.filter(title), ...hits.filter((item) => !title(item))];
}

/**
 * A hidden page switcher: ⌘K (Ctrl+K) opens a modal <dialog> listing every page (see
 * `commandGroups` in src/lib/routes.ts), filtered as you type (see `filter`), beside a
 * panel showing the highlighted page's social card, description and details. The input
 * is a combobox whose options are links, so arrow keys move through them and Enter
 * follows one, and a click (or ⌘-click) works like any link. Escape or a click outside closes it.
 */
export function CommandMenu({ groups }: { groups: readonly CommandGroup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = groups.map((g) => ({ ...g, items: filter(terms, g) })).filter((g) => g.items.length > 0);
  const flat = results.flatMap((g) => g.items);
  // Where each group's options start in `flat`.
  const starts = results.map((_, gi) => results.slice(0, gi).reduce((sum, g) => sum + g.items.length, 0));
  const index = Math.min(active, flat.length - 1);
  const selected = flat[index];

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.open) {
        dialog.close();
      } else {
        setQuery("");
        setActive(0);
        dialog.showModal();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Keep the highlighted option in view as the arrow keys move past the list's edge.
  useEffect(() => {
    document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });
  }, [index]);

  function close() {
    dialogRef.current?.close();
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!flat.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((index + step + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      close();
      router.push(flat[index].href);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Go to a page"
      closedby="any"
      className="command-menu mx-auto mt-[10vh] flex h-[min(40rem,80vh)] max-h-none w-[min(56rem,calc(100vw-2*var(--spacing-gutter)))] max-w-none flex-col overflow-hidden rounded-lg border border-ink-2/10 bg-paper-light/80 p-0 text-ink backdrop-blur-md not-open:hidden"
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls="command-list"
        aria-autocomplete="list"
        aria-activedescendant={flat.length ? optionId(index) : undefined}
        aria-label="Search pages"
        placeholder="Go to…"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onInputKeyDown}
        className="w-full shrink-0 border-ink-2/10 border-b bg-transparent px-6 py-fl-16 text-fl-20 outline-none placeholder:text-muted"
      />

      <div className="grid min-h-0 flex-1 md:grid-cols-2">
        <div
          id="command-list"
          role="listbox"
          aria-label="Pages"
          className="min-h-0 overflow-y-auto overscroll-contain py-2"
        >
          {results.map((g, gi) => (
            // biome-ignore lint/a11y/useSemanticElements: an ARIA group of listbox options, not a form fieldset
            <div key={g.label} role="group" aria-labelledby={`command-group-${g.label}`} className="px-3 py-1">
              <div id={`command-group-${g.label}`} className="mono-label px-3 py-1.5 text-muted">
                {g.label}
              </div>
              {g.items.map((item, ii) => {
                const n = starts[gi] + ii;
                return (
                  <Link
                    key={item.href}
                    id={optionId(n)}
                    href={item.href}
                    role="option"
                    tabIndex={-1}
                    aria-selected={n === index}
                    aria-current={item.href === pathname ? "page" : undefined}
                    onClick={close}
                    onPointerMove={() => n !== index && setActive(n)}
                    className={cn(
                      "block truncate rounded-md px-3 py-2.5 text-fl-18",
                      n === index && "bg-ink/5",
                      item.href === pathname && "text-pink-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          {!flat.length && <p className="px-6 py-4 text-muted">No pages match “{query}”.</p>}
        </div>

        {selected && <Detail item={selected} />}
      </div>

      <div className="mono-label flex shrink-0 justify-end gap-fl-24 border-ink-2/10 border-t px-6 py-3 text-muted">
        <span>↑↓ Move</span>
        <span>↵ Open</span>
        <span>Esc Close</span>
      </div>
    </dialog>
  );
}

/** The highlighted page: its social card (when one is saved), description and details. */
function Detail({ item }: { item: CommandItem }) {
  return (
    <div className="hidden min-h-0 flex-col border-ink-2/10 border-l md:flex">
      <div className="flex min-h-0 flex-1 flex-col gap-fl-16 overflow-y-auto overscroll-contain p-6">
        {item.card ? (
          <MediaImage
            key={item.card}
            src={item.card}
            alt=""
            width={1200}
            height={630}
            sizes="34rem"
            className="aspect-[1200/630] w-full rounded-md border border-ink-2/10 bg-sand object-cover"
          />
        ) : (
          <div className="stripes aspect-[1200/630] w-full rounded-md" />
        )}
        {item.description && <p className="text-body leading-copy">{item.description}</p>}
      </div>
      <div className="shrink-0 border-ink-2/10 border-t px-6 py-3">
        <h3 className="mono-label py-1.5 text-muted">Information</h3>
        <dl>
          {item.info.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-fl-24 border-ink-2/10 border-t py-1.5 first:border-t-0"
            >
              <dt className="text-muted">{label}</dt>
              <dd className="mono-text min-w-0 truncate text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
