"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Container } from "@/components/Container";
import { MediaImage } from "@/components/MediaImage";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media-url";
import { generateAlt, moveEntry, presignUploads, saveEntry, setVideoAudio, syncBucket } from "./actions";
import type { BrokenRef, Usage } from "./usage";

export type AdminItem = {
  key: string;
  type: "image" | "svg" | "video";
  width: number;
  height: number;
  bytes: number;
  duration?: number;
  hasAudio?: boolean;
  poster?: string;
  encode?: string;
  original?: string;
  audio?: "keep" | "remove" | null;
  color?: string;
  alt: string;
  caption: string;
  context: string;
  altSource: "ai" | "human" | null;
  reviewed: boolean;
  usedIn: Usage[];
};

// Empty alt only counts as done once a person has saved it (i.e. marked it decorative).
const needsAlt = (i: AdminItem) => !i.alt && !i.reviewed;
const isDraft = (i: AdminItem) => i.altSource === "ai" && !i.reviewed;
const isUnused = (i: AdminItem) => i.usedIn.length === 0;
// Videos with sound play with controls instead of looping, so someone should decide.
const needsSound = (i: AdminItem) => i.type === "video" && Boolean(i.hasAudio) && !i.audio;

const FILTERS = {
  all: { label: "All", test: () => true },
  "needs-alt": { label: "Needs alt", test: needsAlt },
  draft: { label: "AI drafts", test: isDraft },
  unused: { label: "Unused", test: isUnused },
  sound: { label: "Sound?", test: needsSound },
  image: { label: "Images", test: (i: AdminItem) => i.type !== "video" },
  video: { label: "Videos", test: (i: AdminItem) => i.type === "video" },
} satisfies Record<string, { label: string; test: (i: AdminItem) => boolean }>;
type Filter = keyof typeof FILTERS;

const VIEWS = { grid: "Grid", table: "Table", tree: "Tree" };
type View = keyof typeof VIEWS;
const VIEW_STORAGE = "media-admin-view";

// Remembered per browser. The server snapshot is the grid; the stored view takes
// over after hydration. `chosenView` keeps the switcher working if storage is blocked.
let chosenView: View | null = null;
const viewListeners = new Set<() => void>();
const subscribeView = (fn: () => void) => {
  viewListeners.add(fn);
  return () => viewListeners.delete(fn);
};
function readView(): View {
  if (chosenView) return chosenView;
  try {
    const stored = localStorage.getItem(VIEW_STORAGE);
    if (stored && stored in VIEWS) return stored as View;
  } catch {}
  return "grid";
}
function changeView(v: View) {
  chosenView = v;
  try {
    localStorage.setItem(VIEW_STORAGE, v);
  } catch {}
  viewListeners.forEach((fn) => fn());
}

const pixels = (i: AdminItem) => i.width * i.height;
const COLUMNS = {
  key: { label: "Key", value: (i: AdminItem) => i.key },
  type: { label: "Type", value: (i: AdminItem) => i.type },
  size: { label: "Dimensions", value: pixels },
  bytes: { label: "File size", value: (i: AdminItem) => i.bytes },
  used: { label: "Used in", value: (i: AdminItem) => i.usedIn.length },
} satisfies Record<string, { label: string; value: (i: AdminItem) => string | number }>;
type Column = keyof typeof COLUMNS;
type Sort = { col: Column; dir: 1 | -1 };

const btn =
  "mono-label border border-ink px-3 py-2 text-fl-12 transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-40";
const field = "w-full border border-rule bg-paper-light px-3 py-2 text-fl-14 focus:border-ink focus:outline-none";

const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }));
}

export function MediaAdmin({
  items,
  broken,
  folders,
  initialKey,
  host,
}: {
  items: AdminItem[];
  broken: BrokenRef[];
  folders: string[];
  initialKey: string | null;
  host?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const view = useSyncExternalStore(subscribeView, readView, () => "grid");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(initialKey);
  // Shown in the sheet after a move, which remounts the details under the new key.
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");
  const [busy, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => FILTERS[filter].test(i) && i.key.toLowerCase().includes(q));
  const current = items.find((i) => i.key === selected);
  const missing = items.filter(needsAlt);

  const open = (key: string) => {
    setNotice("");
    setSelected(key);
  };

  function run(fn: () => Promise<string | void>) {
    startTransition(async () => {
      try {
        setStatus((await fn()) ?? "");
      } catch (err) {
        setStatus(`Error: ${message(err)}`);
      }
      router.refresh();
    });
  }

  const sync = () =>
    run(async () => {
      setStatus("Syncing with the bucket…");
      const r = await syncBucket();
      const failed = r.errors.length ? ` · ${r.errors.length} failed (${r.errors[0].key}: ${r.errors[0].error})` : "";
      return `Synced: ${r.added} added, ${r.updated} updated, ${r.removed} removed${failed}`;
    });

  const fillMissing = () =>
    run(async () => {
      let done = 0;
      const failed: string[] = [];
      await pool(missing, 3, async (item) => {
        try {
          await generateAlt(item.key, item.context);
        } catch (err) {
          failed.push(`${item.key}: ${message(err)}`);
        }
        setStatus(`Drafting alt text ${++done}/${missing.length}…`);
      });
      return `Drafted ${done - failed.length} of ${missing.length}${failed.length ? ` · failed: ${failed.join("; ")}` : ""}`;
    });

  const upload = (folder: string, files: File[]) =>
    run(async () => {
      if (!files.length) return;
      setStatus("Preparing upload…");
      const targets = await presignUploads(
        folder,
        files.map((f) => ({ name: f.name, type: f.type })),
      );
      // Videos end up as .mp4 whatever they were uploaded as.
      const finalKey = (key: string) => (/\.(mov|webm|m4v)$/i.test(key) ? key.replace(/\.[^.]+$/, ".mp4") : key);
      const replacing = targets.filter((t) => items.some((i) => i.key === finalKey(t.key)));
      if (
        replacing.length &&
        !confirm(`Replace ${replacing.map((t) => t.key).join(", ")}? The CDN may keep serving the old file for a while.`)
      ) {
        return "Upload cancelled";
      }
      let done = 0;
      await pool(targets, 3, async (t, i) => {
        const res = await fetch(t.url, { method: "PUT", headers: t.headers, body: files[i] });
        if (!res.ok) throw new Error(`${t.key}: upload failed (${res.status})`);
        setStatus(`Uploading ${++done}/${targets.length}…`);
      });
      setStatus(
        targets.some((t) => t.key.match(/\.(mp4|mov|webm|m4v)$/i))
          ? "Encoding video and reading metadata (can take a minute)…"
          : "Reading metadata…",
      );
      const r = await syncBucket(targets.map((t) => t.key));
      setSelected(r.renamed.find((x) => x.from === targets[0].key)?.to ?? targets[0].key);
      setFilter("all");
      return `Uploaded ${targets.length}${r.errors.length ? ` · ${r.errors.length} failed metadata: ${r.errors[0].error}` : ""}`;
    });

  return (
    <main id="main">
      <Container className="flex flex-col gap-fl-32 pt-fl-56 pb-fl-96">
        <header className="flex flex-wrap items-end justify-between gap-fl-24 border-b border-rule pb-fl-24">
          <div className="flex flex-col gap-fl-8">
            <span className="mono-label text-muted">/ Admin · dev only</span>
            <h1 className="display text-fl-48 leading-none tracking-heading">Media</h1>
            <p className="font-mono text-fl-14 text-muted">
              {items.length} assets · {missing.length} need alt · {items.filter(isDraft).length} AI drafts ·{" "}
              {items.filter(isUnused).length} unused
              {items.some(needsSound) && ` · ${items.filter(needsSound).length} with sound to review`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={busy} onClick={sync}>
              Sync bucket
            </button>
            <button type="button" className={btn} disabled={busy || !missing.length} onClick={fillMissing}>
              Draft missing alt ({missing.length})
            </button>
          </div>
        </header>

        {!host && (
          <Notice>
            Set <code>NEXT_PUBLIC_MEDIA_HOST</code> in <code>.env.local</code> (e.g. media.okaypl.us) to see previews.
          </Notice>
        )}
        {broken.length > 0 && (
          <Notice>
            <p className="mb-2 font-semibold">Referenced in source but not in the manifest (the build will fail):</p>
            <ul className="font-mono text-fl-12">
              {broken.map((b) => (
                <li key={b.file + b.key}>
                  {b.key} <span className="text-muted">— {b.file}</span>
                </li>
              ))}
            </ul>
          </Notice>
        )}

        <Uploader disabled={busy} folders={folders} onUpload={upload} />

        {status && <p className="font-mono text-fl-14 text-body" role="status">{status}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(btn, "border-rule", filter === f && "border-ink bg-ink text-paper")}
            >
              {FILTERS[f].label}
            </button>
          ))}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by key or folder"
            aria-label="Filter by key or folder"
            className={cn(field, "ml-auto w-full sm:w-64")}
          />
          <div role="group" aria-label="View" className="flex">
            {(Object.keys(VIEWS) as View[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className={cn(btn, "-ml-px border-rule first:ml-0", view === v && "relative border-ink bg-ink text-paper")}
              >
                {VIEWS[v]}
              </button>
            ))}
          </div>
        </div>

        {current && (
          <Sheet title="Media details" onClose={() => setSelected(null)}>
            <Detail
              key={current.key}
              item={current}
              host={host}
              folders={folders}
              notice={notice}
              onChange={() => router.refresh()}
              onMoved={(key, message) => {
                setNotice(message);
                setSelected(key);
              }}
            />
          </Sheet>
        )}

        {!shown.length ? (
          <p className="py-fl-40 font-mono text-fl-14 text-muted">
            {items.length ? "Nothing matches." : "No media yet. Upload files above, or add them to the bucket and Sync."}
          </p>
        ) : view === "table" ? (
          <MediaTable items={shown} host={host} selected={selected} onOpen={open} />
        ) : view === "tree" ? (
          <MediaTree items={shown} host={host} selected={selected} onOpen={open} expandAll={Boolean(q)} />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {shown.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => open(item.key)}
                  aria-pressed={item.key === selected}
                  className={cn(
                    "flex w-full flex-col gap-1.5 border border-transparent p-1.5 text-left hover:border-rule",
                    item.key === selected && "border-ink hover:border-ink",
                  )}
                >
                  <Thumb item={item} host={host} />
                  <span className="truncate font-mono text-fl-12" title={item.key}>
                    {item.key}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <Flags item={item} />
                    {item.type === "video" && <Badge>{item.duration}s</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="border border-pink-ink/40 bg-pink/5 p-fl-16 text-fl-14 text-body">{children}</div>;
}

function Badge({ children, tone }: { children: ReactNode; tone?: "pink" | "done" }) {
  return (
    <span
      className={cn(
        "mono-label bg-sand px-1.5 py-0.5 text-[11px] text-body",
        tone === "pink" && "bg-pink/15 text-pink-ink",
        tone === "done" && "bg-paper-light text-ink ring-1 ring-rule ring-inset",
      )}
    >
      {children}
    </span>
  );
}

function Flags({ item }: { item: AdminItem }) {
  return (
    <>
      {needsAlt(item) && <Badge tone="pink">No alt</Badge>}
      {isDraft(item) && <Badge>AI draft</Badge>}
      {needsSound(item) && <Badge tone="pink">Sound?</Badge>}
      {isUnused(item) && <Badge>Unused</Badge>}
    </>
  );
}

function Thumb({
  item,
  host,
  sizes = "200px",
  className,
}: {
  item: AdminItem;
  host?: string;
  sizes?: string;
  className?: string;
}) {
  const src = item.type === "video" ? item.poster : item.key;
  return (
    <span
      className={cn("relative block aspect-square shrink-0 overflow-hidden bg-sand", className)}
      style={{ backgroundColor: item.color }}
    >
      {host && src && (
        <MediaImage
          src={item.type === "svg" ? mediaUrl(src) : src}
          unoptimized={item.type === "svg"}
          alt=""
          fill
          sizes={sizes}
          className="object-contain"
        />
      )}
    </span>
  );
}

const splitKey = (key: string) => {
  const i = key.lastIndexOf("/");
  return { name: key.slice(i + 1), folder: i < 0 ? "" : key.slice(0, i) };
};

const compare = (x: string | number, y: string | number) =>
  typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));

type ViewProps = { items: AdminItem[]; host?: string; selected: string | null; onOpen: (key: string) => void };

function MediaTable({ items, host, selected, onOpen }: ViewProps) {
  const [sort, setSort] = useState<Sort>({ col: "key", dir: 1 });
  const value = COLUMNS[sort.col].value;
  const rows = [...items].sort((a, b) => compare(value(a), value(b)) * sort.dir || a.key.localeCompare(b.key));

  // Numbers start biggest-first; text starts A→Z.
  const sortBy = (col: Column) =>
    setSort((s) =>
      s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: typeof COLUMNS[col].value(items[0]) === "number" ? -1 : 1 },
    );

  const th = "border-b border-ink px-2 py-2 text-left font-normal";
  const td = "border-b border-rule px-2 py-2 align-middle";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-fl-14">
        <thead>
          <tr>
            <th className={cn(th, "w-14")}>
              <span className="sr-only">Preview</span>
            </th>
            {(Object.keys(COLUMNS) as Column[]).map((col) => (
              <th
                key={col}
                aria-sort={sort.col === col ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                className={cn(th, col !== "key" && "whitespace-nowrap")}
              >
                <button
                  type="button"
                  onClick={() => sortBy(col)}
                  className={cn("mono-label text-fl-12 text-muted hover:text-ink", sort.col === col && "text-ink")}
                >
                  {COLUMNS[col].label}
                  <span aria-hidden="true" className={cn("ml-1", sort.col !== col && "invisible")}>
                    {sort.dir === 1 ? "↑" : "↓"}
                  </span>
                </button>
              </th>
            ))}
            <th className={th}>
              <span className="mono-label text-fl-12 text-muted">Status</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const { name, folder } = splitKey(item.key);
            return (
              <tr
                key={item.key}
                onClick={() => onOpen(item.key)}
                className={cn("cursor-pointer hover:bg-sand/50", item.key === selected && "bg-sand")}
              >
                <td className={td}>
                  <Thumb item={item} host={host} sizes="48px" className="size-10" />
                </td>
                <td className={cn(td, "max-w-0 w-full")}>
                  <button
                    type="button"
                    onClick={() => onOpen(item.key)}
                    aria-pressed={item.key === selected}
                    title={item.key}
                    className="flex w-full min-w-0 flex-col text-left"
                  >
                    <span className="truncate font-mono text-fl-12 text-ink">{name}</span>
                    {folder && <span className="truncate font-mono text-fl-12 text-muted">{folder}</span>}
                  </button>
                </td>
                <td className={cn(td, "whitespace-nowrap font-mono text-fl-12")}>
                  {TYPE_LABEL[item.type]}
                  {item.type === "video" && <span className="text-muted"> · {item.duration}s</span>}
                </td>
                <td className={cn(td, "whitespace-nowrap font-mono text-fl-12")}>
                  {item.width} × {item.height}
                </td>
                <td className={cn(td, "whitespace-nowrap font-mono text-fl-12")}>{kb(item.bytes)}</td>
                <td
                  className={cn(td, "font-mono text-fl-12", isUnused(item) && "text-muted")}
                  title={item.usedIn.map((u) => u.file).join("\n") || undefined}
                >
                  {item.usedIn.length}
                </td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    <Flags item={item} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Folder = { name: string; path: string; folders: Folder[]; files: AdminItem[] };

function buildTree(items: AdminItem[]) {
  const root: Folder = { name: "", path: "", folders: [], files: [] };
  for (const item of items) {
    let node = root;
    for (const part of item.key.split("/").slice(0, -1)) {
      let child = node.folders.find((f) => f.name === part);
      if (!child) {
        child = { name: part, path: node.path ? `${node.path}/${part}` : part, folders: [], files: [] };
        node.folders.push(child);
      }
      node = child;
    }
    node.files.push(item);
  }
  const sortNode = (node: Folder) => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.key.localeCompare(b.key));
    node.folders.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

const allFiles = (node: Folder): AdminItem[] => [...node.files, ...node.folders.flatMap(allFiles)];

function MediaTree({ expandAll, ...props }: ViewProps & { expandAll: boolean }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <TreeLevel
      node={buildTree(props.items)}
      isOpen={(path) => expandAll || !collapsed.has(path)}
      onToggle={toggle}
      {...props}
    />
  );
}

function TreeLevel({
  node,
  host,
  selected,
  onOpen,
  isOpen,
  onToggle,
  nested,
}: Omit<ViewProps, "items"> & {
  node: Folder;
  isOpen: (path: string) => boolean;
  onToggle: (path: string) => void;
  nested?: boolean;
}) {
  const row = "flex w-full items-center gap-3 px-2 py-1.5 text-left hover:bg-sand/50";

  return (
    <ul className={cn("flex flex-col", nested && "ml-4 border-l border-rule pl-2")}>
      {node.folders.map((folder) => {
        const files = allFiles(folder);
        const open = isOpen(folder.path);
        const noAlt = files.filter(needsAlt).length;
        const sound = files.filter(needsSound).length;
        return (
          <li key={folder.path}>
            <button type="button" aria-expanded={open} onClick={() => onToggle(folder.path)} className={row}>
              <svg
                viewBox="0 0 16 16"
                className={cn("size-4 shrink-0 text-muted transition-transform motion-reduce:transition-none", open && "rotate-90")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0 flex-1 truncate font-mono text-fl-14 text-ink">{folder.name}/</span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {noAlt > 0 && <Badge tone="pink">{noAlt} no alt</Badge>}
                {sound > 0 && <Badge tone="pink">{sound} sound?</Badge>}
              </span>
              <span className="shrink-0 text-right sm:w-32 font-mono text-fl-12 text-muted">
                {files.length} · {kb(files.reduce((n, f) => n + f.bytes, 0))}
              </span>
            </button>
            {open && (
              <TreeLevel
                node={folder}
                host={host}
                selected={selected}
                onOpen={onOpen}
                isOpen={isOpen}
                onToggle={onToggle}
                nested
              />
            )}
          </li>
        );
      })}
      {node.files.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            onClick={() => onOpen(item.key)}
            aria-pressed={item.key === selected}
            title={item.key}
            className={cn(row, item.key === selected && "bg-sand hover:bg-sand")}
          >
            <Thumb item={item} host={host} sizes="32px" className="size-7" />
            <span className="min-w-0 flex-1 truncate font-mono text-fl-12 text-ink">{splitKey(item.key).name}</span>
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              <Flags item={item} />
            </span>
            <span className="shrink-0 text-right sm:w-32 font-mono text-fl-12 text-muted">
              {TYPE_LABEL[item.type]} · {kb(item.bytes)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Uploader({
  disabled,
  folders,
  onUpload,
}: {
  disabled: boolean;
  folders: string[];
  onUpload: (folder: string, files: File[]) => void;
}) {
  const [folder, setFolder] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onUpload(folder, [...e.dataTransfer.files]);
      }}
      className={cn(
        "flex flex-wrap items-center gap-3 border border-dashed border-guide p-fl-16",
        over && "border-ink bg-sand",
      )}
    >
      <label className="flex items-center gap-2 font-mono text-fl-14 text-muted">
        Folder
        {/* Native combobox: suggests known folders, still accepts a new one. */}
        <input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          list={listId}
          placeholder="Choose or type a folder"
          autoComplete="off"
          spellCheck={false}
          className={cn(field, "w-72")}
        />
        <datalist id={listId}>
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>
      <button type="button" className={btn} disabled={disabled} onClick={() => input.current?.click()}>
        Choose files
      </button>
      <span className="font-mono text-fl-12 text-muted">or drop images/videos here</span>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          onUpload(folder, [...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Full-height panel sliding in from the right. A modal <dialog>, so the page
 * behind is inert, focus stays inside, and Esc or a click on the backdrop closes it.
 */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const unmounting = useRef(false);

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      unmounting.current = true;
      root.style.overflow = overflow;
      dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => !unmounting.current && onClose()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[min(34rem,100vw)] border-0 border-l border-rule bg-paper p-0 text-ink shadow-[-24px_0_48px_rgb(28_25_22/0.12)] transition-transform duration-300 ease-out backdrop:bg-ink/40 starting:translate-x-full motion-reduce:transition-none"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-rule bg-paper-raised px-fl-24 py-fl-16">
          <h2 id={titleId} className="text-fl-18 font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 p-2 text-muted transition-colors hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

const TYPE_LABEL = { image: "IMG", svg: "SVG", video: "VID" };

function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-fl-16 border-b border-rule px-fl-24 py-fl-24", className)}>
      {title && <h3 className="text-fl-18 font-medium">{title}</h3>}
      {children}
    </section>
  );
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", wide && "col-span-2")}>
      <dt className="text-fl-14 text-muted">{label}</dt>
      <dd className="text-fl-14 break-words text-ink">{children}</dd>
    </div>
  );
}

function Detail({
  item,
  host,
  folders,
  notice,
  onChange,
  onMoved,
}: {
  item: AdminItem;
  host?: string;
  folders: string[];
  notice: string;
  onChange: () => void;
  onMoved: (key: string, message: string) => void;
}) {
  const [dest, setDest] = useState(item.key);
  const moveId = useId();
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [context, setContext] = useState(item.context);
  const [status, setStatus] = useState(notice);
  const [busy, startTransition] = useTransition();

  const act = (fn: () => Promise<string>) =>
    startTransition(async () => {
      try {
        setStatus(await fn());
        onChange();
      } catch (err) {
        setStatus(`Error: ${message(err)}`);
      }
    });

  const chooseAudio = (audio: "keep" | "remove") =>
    act(async () => {
      const reencode = (audio === "remove") === Boolean(item.hasAudio);
      setStatus(reencode ? "Re-encoding from the original…" : "Saving…");
      await setVideoAudio(item.key, audio);
      return audio === "remove" ? "Sound removed. It now loops silently." : "Sound kept. It plays with controls.";
    });

  const move = () =>
    act(async () => {
      const n = item.usedIn.length;
      if (n && !confirm(`Move to ${dest.trim()}? References in ${n} file${n > 1 ? "s" : ""} will be updated.`)) return "";
      setStatus("Moving…");
      const r = await moveEntry(item.key, dest);
      const message = r.key === item.key ? "" : `Moved ${item.key} → ${r.key}${r.files.length ? ` · updated ${r.files.join(", ")}` : ""}`;
      // The details remount under the new key, so the sheet hands the message back in.
      if (r.key !== item.key) onMoved(r.key, message);
      return message;
    });

  const generate = () =>
    act(async () => {
      setStatus("Asking Claude…");
      const r = await generateAlt(item.key, context);
      setAlt(r.alt);
      return r.decorative
        ? "Claude thinks this is decorative, so alt is empty. Save to accept."
        : "Draft ready. Edit if needed, then Save to approve.";
    });

  const save = () =>
    act(async () => {
      await saveEntry(item.key, { alt, caption, context });
      return alt ? "Saved." : "Saved as decorative (empty alt).";
    });

  const snippet = `<Figure media="${item.key}" />`;
  const dirty = alt !== item.alt || caption !== item.caption || context !== item.context;

  const name = item.key.split("/").pop();
  const folder = item.key.includes("/") ? item.key.slice(0, item.key.lastIndexOf("/")) : "(bucket root)";

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <Section>
          <div className="flex items-start gap-fl-16">
            <span className="mono-label grid size-11 shrink-0 place-items-center border border-rule bg-paper-light text-fl-12 text-muted">
              {TYPE_LABEL[item.type]}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-fl-20 font-medium" title={name}>
                {name}
              </span>
              <span className="truncate font-mono text-fl-12 text-muted" title={folder}>
                {folder}
              </span>
            </div>
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              <Flags item={item} />
              {!needsAlt(item) && !isDraft(item) && !needsSound(item) && <Badge tone="done">Reviewed</Badge>}
            </span>
          </div>

          <div className="bg-sand" style={{ backgroundColor: item.color }}>
            {host &&
              (item.type === "video" ? (
                <video
                  src={mediaUrl(item.key)}
                  poster={item.poster ? mediaUrl(item.poster) : undefined}
                  controls
                  playsInline
                  preload="none"
                  className="block max-h-[50vh] w-full object-contain"
                />
              ) : (
                <MediaImage
                  src={item.type === "svg" ? mediaUrl(item.key) : item.key}
                  unoptimized={item.type === "svg"}
                  alt=""
                  width={item.width}
                  height={item.height}
                  sizes="544px"
                  className="block max-h-[50vh] w-full object-contain"
                />
              ))}
          </div>
        </Section>

        <Section>
          <dl className="grid grid-cols-2 gap-x-fl-24 gap-y-fl-20">
            <Fact label="Dimensions">
              {item.width} × {item.height}
            </Fact>
            <Fact label="File size">{kb(item.bytes)}</Fact>
            {item.type === "video" && (
              <>
                <Fact label="Duration">{item.duration}s</Fact>
                <Fact label="Sound">{item.hasAudio ? "Yes, plays with controls" : "Silent loop"}</Fact>
                {item.encode && <Fact label="Encoding">H.264 · preset v{item.encode}</Fact>}
                {item.original && (
                  <Fact label="Original">
                    {host ? (
                      <a href={mediaUrl(item.original)} className="underline hover:text-pink-ink">
                        Download
                      </a>
                    ) : (
                      "Kept"
                    )}
                  </Fact>
                )}
              </>
            )}
            <Fact label="Used in" wide>
              {item.usedIn.length ? (
                <ul className="font-mono text-fl-12">
                  {item.usedIn.map((u) => (
                    <li key={u.file}>{u.file}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted">Not referenced anywhere yet</span>
              )}
            </Fact>
          </dl>
        </Section>

        {item.type === "video" && (item.hasAudio || item.audio === "remove") && (
          <Section title="Sound" className={cn(needsSound(item) && "bg-pink/5")}>
            <p className="text-fl-14 text-body">
              {needsSound(item)
                ? "This video has sound. With sound it plays with controls; without, it loops silently while on screen."
                : item.hasAudio
                  ? "Sound kept: plays with controls."
                  : "Sound removed: loops silently."}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.hasAudio ? (
                <>
                  <button type="button" className={btn} disabled={busy} onClick={() => chooseAudio("remove")}>
                    Remove sound
                  </button>
                  {needsSound(item) && (
                    <button type="button" className={btn} disabled={busy} onClick={() => chooseAudio("keep")}>
                      Keep sound
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className={btn} disabled={busy} onClick={() => chooseAudio("keep")}>
                  Restore sound
                </button>
              )}
            </div>
          </Section>
        )}

        <Section title="Alt text">
          <label className="flex flex-col gap-1.5">
            <span className="text-fl-14 text-muted">Context for Claude</span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              placeholder="Who or what is shown, which project, what the reader should notice…"
              className={field}
            />
          </label>
          <button type="button" className={cn(btn, "self-start")} disabled={busy} onClick={generate}>
            {alt ? "Regenerate alt text" : "Generate alt text"}
          </button>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-fl-14 text-muted">
              <span>
                Alt text {isDraft(item) && item.alt === alt && <span className="text-pink-ink">· AI draft</span>}
              </span>
              <span className={cn("font-mono text-fl-12", alt.length > 125 && "text-pink-ink")}>{alt.length}</span>
            </span>
            <textarea
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              rows={3}
              placeholder="Leave empty and save to mark as decorative"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-fl-14 text-muted">Caption</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} className={field} />
          </label>
        </Section>

        <Section title="Key" className="border-b-0">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate bg-sand px-2 py-2 font-mono text-fl-12">{snippet}</code>
            <button
              type="button"
              className={btn}
              onClick={() => navigator.clipboard.writeText(snippet).then(() => setStatus("Copied snippet."))}
            >
              Copy
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={moveId} className="text-fl-14 text-muted">
              Move / rename
            </label>
            <div className="flex gap-2">
              {/* Suggests this file in each known folder; any key can be typed. */}
              <input
                id={moveId}
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && dest.trim() !== item.key && move()}
                list={`${moveId}-folders`}
                autoComplete="off"
                spellCheck={false}
                className={cn(field, "min-w-0 flex-1 font-mono text-fl-12")}
              />
              <button
                type="button"
                className={btn}
                disabled={busy || !dest.trim() || dest.trim() === item.key}
                onClick={move}
              >
                Move
              </button>
            </div>
            <datalist id={`${moveId}-folders`}>
              {folders.map((f) => (
                <option key={f} value={`${f}/${name}`} />
              ))}
            </datalist>
          </div>
        </Section>
      </div>

      <footer className="flex items-center gap-fl-16 border-t border-rule bg-paper-raised px-fl-24 py-fl-16">
        <span className="min-w-0 flex-1 font-mono text-fl-12 text-muted" role="status">
          {status}
        </span>
        <button
          type="button"
          className={cn(btn, "bg-ink text-paper hover:bg-ink-2")}
          disabled={busy || (!dirty && item.reviewed)}
          onClick={save}
        >
          {item.reviewed || dirty ? "Save" : "Approve"}
        </button>
      </footer>
    </>
  );
}
