"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
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
  host,
}: {
  items: AdminItem[];
  broken: BrokenRef[];
  folders: string[];
  host?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => FILTERS[filter].test(i) && i.key.toLowerCase().includes(q));
  const current = items.find((i) => i.key === selected);
  const missing = items.filter(needsAlt);

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
        </div>

        <div className="grid items-start gap-fl-32 lg:grid-cols-[minmax(0,1fr)_420px]">
          {current && (
            <aside className="border border-rule bg-paper-raised p-fl-20 lg:sticky lg:top-24 lg:order-2 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <Detail
                key={current.key}
                item={current}
                host={host}
                folders={folders}
                onChange={() => router.refresh()}
                onMoved={(key, message) => {
                  setSelected(key);
                  setStatus(message);
                }}
                onClose={() => setSelected(null)}
              />
            </aside>
          )}
          <ul className={cn("grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3", !current && "lg:col-span-2")}>
            {shown.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setSelected(item.key === selected ? null : item.key)}
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
                    {needsAlt(item) && <Badge tone="pink">No alt</Badge>}
                    {isDraft(item) && <Badge>AI draft</Badge>}
                    {needsSound(item) && <Badge tone="pink">Sound?</Badge>}
                    {isUnused(item) && <Badge>Unused</Badge>}
                    {item.type === "video" && <Badge>{item.duration}s</Badge>}
                  </span>
                </button>
              </li>
            ))}
            {!shown.length && (
              <li className="col-span-full py-fl-40 font-mono text-fl-14 text-muted">
                {items.length ? "Nothing matches." : "No media yet. Upload files above, or add them to the bucket and Sync."}
              </li>
            )}
          </ul>
        </div>
      </Container>
    </main>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="border border-pink-ink/40 bg-pink/5 p-fl-16 text-fl-14 text-body">{children}</div>;
}

function Badge({ children, tone }: { children: ReactNode; tone?: "pink" }) {
  return (
    <span
      className={cn(
        "mono-label bg-sand px-1.5 py-0.5 text-[11px] text-body",
        tone === "pink" && "bg-pink/15 text-pink-ink",
      )}
    >
      {children}
    </span>
  );
}

function Thumb({ item, host }: { item: AdminItem; host?: string }) {
  const src = item.type === "video" ? item.poster : item.key;
  return (
    <span className="relative block aspect-square overflow-hidden bg-sand" style={{ backgroundColor: item.color }}>
      {host && src && (
        <MediaImage
          src={item.type === "svg" ? mediaUrl(src) : src}
          unoptimized={item.type === "svg"}
          alt=""
          fill
          sizes="200px"
          className="object-contain"
        />
      )}
    </span>
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

function Detail({
  item,
  host,
  folders,
  onChange,
  onMoved,
  onClose,
}: {
  item: AdminItem;
  host?: string;
  folders: string[];
  onChange: () => void;
  onMoved: (key: string, message: string) => void;
  onClose: () => void;
}) {
  const [dest, setDest] = useState(item.key);
  const moveId = useId();
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [context, setContext] = useState(item.context);
  const [status, setStatus] = useState("");
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
      // The panel remounts under the new key, so the message goes to the page status line.
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

  return (
    <div className="flex flex-col gap-fl-16">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-mono text-fl-14 break-all">{item.key}</h2>
        <button type="button" onClick={onClose} className="font-mono text-fl-14 text-muted hover:text-ink" aria-label="Close">
          ✕
        </button>
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
              className="block h-auto w-full"
            />
          ) : (
            <MediaImage
              src={item.type === "svg" ? mediaUrl(item.key) : item.key}
              unoptimized={item.type === "svg"}
              alt=""
              width={item.width}
              height={item.height}
              sizes="420px"
              className="block h-auto w-full"
            />
          ))}
      </div>

      <p className="font-mono text-fl-12 text-muted">
        {item.type} · {item.width}×{item.height} · {kb(item.bytes)}
        {item.type === "video" && ` · ${item.duration}s · ${item.hasAudio ? "has sound" : "silent"}`}
        {item.encode && ` · preset v${item.encode}`}
        {item.original && host && (
          <>
            {" · "}
            <a href={mediaUrl(item.original)} className="underline hover:text-ink">
              original
            </a>
          </>
        )}
      </p>

      {item.type === "video" && (item.hasAudio || item.audio === "remove") && (
        <div className={cn("flex flex-col gap-fl-12 p-fl-12 text-fl-14 text-body", needsSound(item) ? "bg-pink/10" : "bg-sand")}>
          <p>
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
        </div>
      )}

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate bg-sand px-2 py-1.5 font-mono text-fl-12">{snippet}</code>
        <button
          type="button"
          className={btn}
          onClick={() => navigator.clipboard.writeText(snippet).then(() => setStatus("Copied snippet."))}
        >
          Copy
        </button>
      </div>

      <div className="font-mono text-fl-12 text-muted">
        {item.usedIn.length ? (
          <>
            Used in:
            <ul>
              {item.usedIn.map((u) => (
                <li key={u.file} className="text-body">
                  {u.file}
                </li>
              ))}
            </ul>
          </>
        ) : (
          "Not referenced anywhere yet."
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={moveId} className="mono-label text-fl-12 text-muted">
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
            <option key={f} value={`${f}/${item.key.split("/").pop()}`} />
          ))}
        </datalist>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="mono-label text-fl-12 text-muted">Context for Claude</span>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={3}
          placeholder="Who or what is shown, which project, what the reader should notice…"
          className={field}
        />
      </label>
      <button type="button" className={cn(btn, "self-start")} disabled={busy} onClick={generate}>
        {alt ? "Regenerate alt text" : "Generate alt text"}
      </button>

      <label className="flex flex-col gap-1.5">
        <span className="mono-label flex justify-between text-fl-12 text-muted">
          <span>
            Alt text {isDraft(item) && item.alt === alt && <span className="text-pink-ink">· AI draft</span>}
          </span>
          <span className={cn(alt.length > 125 && "text-pink-ink")}>{alt.length}</span>
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
        <span className="mono-label text-fl-12 text-muted">Caption</span>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} className={field} />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={cn(btn, "bg-ink text-paper hover:bg-ink-2")}
          disabled={busy || (!dirty && item.reviewed)}
          onClick={save}
        >
          {item.reviewed || dirty ? "Save" : "Approve"}
        </button>
        {status && (
          <span className="font-mono text-fl-12 text-muted" role="status">
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
