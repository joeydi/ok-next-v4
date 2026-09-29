"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Container } from "@/components/Container";
import { cn } from "@/lib/cn";

/** Whether the Gelica card in the media store matches the card as it is now. */
export type CardStatus = "saved" | "stale" | "missing";

export type OgPage = { path: string; label: string; draft?: boolean; card?: CardStatus };

/** Screenshots cards into the media store (/admin/og/capture); resolves to an error message, if any. */
async function capture(query: string) {
  const res = await fetch(`/admin/og/capture?${query}`, { method: "POST" });
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.error ?? `HTTP ${res.status} — full error in the dev server terminal`;
}

/** A button that runs `action`, showing progress and any error beside it. */
function CaptureButton({ label, action }: { label: string; action: () => Promise<string | null> }) {
  const [state, setState] = useState<{ busy: boolean; error?: string | null }>({ busy: false });
  return (
    <span className="flex items-baseline gap-2">
      <button
        type="button"
        disabled={state.busy}
        onClick={async () => {
          setState({ busy: true });
          setState({ busy: false, error: await action() });
        }}
        className="text-pink-ink hover:text-ink disabled:text-muted"
      >
        {state.busy ? "Saving…" : label}
      </button>
      {state.error && <span className="text-pink-ink">{state.error}</span>}
    </span>
  );
}

type Meta = Record<string, string>;
type Loaded = { src: string; ms: number; bytes: number; type: string; width: number; height: number };
type Async<T> = { key: string; value?: T; error?: string };

const WIDTHS = [
  ["S", 360],
  ["M", 600],
  ["L", 1200],
] as const;

/** The page's <title> and its og:/twitter:/description meta tags, as the page actually renders them. */
async function loadMeta(path: string, signal: AbortSignal): Promise<Meta> {
  const res = await fetch(path, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const meta: Meta = { title: doc.title };
  // The whole document, not just <head>: streamed metadata can land in <body>.
  for (const el of doc.querySelectorAll("meta[property], meta[name]")) {
    const k = el.getAttribute("property") ?? el.getAttribute("name")!;
    if (/^(og|twitter):|^description$/.test(k)) meta[k] ??= el.getAttribute("content") ?? "";
  }
  return meta;
}

/** Fetches a card uncached, timing it, and reads its real pixel size. Error pages become the error message. */
async function loadImage(url: string, signal: AbortSignal): Promise<Loaded> {
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) {
    const text = await res.text();
    const html = new DOMParser().parseFromString(text, "text/html");
    const summary = (html.title || html.body.textContent || text).replace(/\s+/g, " ").trim().slice(0, 400);
    throw new Error(`HTTP ${res.status}: ${summary || "(empty)"} — full error in the dev server terminal`);
  }
  const blob = await res.blob();
  const ms = performance.now() - t0;
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();
  return { src: URL.createObjectURL(blob), ms, bytes: blob.size, type: blob.type, width, height };
}

// Keyed so a reload keeps showing the last result (no flash) while `loading` is true.
function useMeta(path: string, version: number) {
  const key = `${path}#${version}`;
  const [state, setState] = useState<Async<Meta>>({ key: "" });
  useEffect(() => {
    const ctrl = new AbortController();
    loadMeta(path, ctrl.signal).then(
      (value) => setState({ key, value }),
      (e: Error) => ctrl.signal.aborted || setState({ key, error: e.message }),
    );
    return () => ctrl.abort();
  }, [path, key]);
  return { ...state, loading: state.key !== key };
}

function useOgImage(url: string | null, version: number) {
  const key = url ? `${url}#${version}` : "";
  const [state, setState] = useState<Async<Loaded>>({ key: "" });
  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    loadImage(url, ctrl.signal).then(
      (value) => setState({ key, value }),
      (e: Error) => ctrl.signal.aborted || setState({ key, error: e.message }),
    );
    return () => ctrl.abort();
  }, [url, key]);
  // Free each object URL once a newer one has replaced it.
  const src = state.value?.src;
  useEffect(
    () => () => {
      if (src) URL.revokeObjectURL(src);
    },
    [src],
  );
  return { ...state, loading: Boolean(url) && state.key !== key };
}

/** Things a scraper would trip on or render badly. */
function problems(meta: Meta | undefined, img: Loaded | undefined) {
  const out: string[] = [];
  if (meta) {
    for (const k of ["og:title", "og:description", "og:image", "og:image:alt", "twitter:card"])
      if (!meta[k]) out.push(`Missing ${k}`);
    if (meta["twitter:image"] && meta["og:image"] && meta["twitter:image"] !== meta["og:image"])
      out.push("twitter:image differs from og:image");
    const w = meta["og:image:width"];
    const h = meta["og:image:height"];
    if (img && w && h && (Number(w) !== img.width || Number(h) !== img.height))
      out.push(`Tags say ${w}×${h}, image is ${img.width}×${img.height}`);
  }
  if (img) {
    if (img.width !== 1200 || img.height !== 630) out.push(`${img.width}×${img.height}, expected 1200×630`);
    if (img.bytes > 1024 * 1024) out.push(`${kb(img.bytes)}: large for a preview image`);
  }
  return out;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

/** The image's path on this dev server: tags are absolute against metadataBase (the production domain). */
function localPath(url: string) {
  const u = new URL(url, location.origin);
  return u.pathname + u.search;
}

export function OgAdmin({
  pages,
  notesError,
  scenes,
  mediaKeys,
}: {
  pages: OgPage[];
  notesError: string | null;
  scenes: string[];
  mediaKeys: string[];
}) {
  const [width, setWidth] = useState<number>(1200);
  const [guides, setGuides] = useState(false);
  const [preview, setPreview] = useState(false);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const unsaved = pages.filter((p) => p.card && p.card !== "saved").length;
  const q = query.trim().toLowerCase();
  const shown = q ? pages.filter((p) => `${p.label} ${p.path}`.toLowerCase().includes(q)) : pages;

  return (
    <Container className="pt-fl-56 pb-fl-96 font-mono text-[12px]">
      <header className="mb-fl-32 flex flex-wrap items-end justify-between gap-fl-24 border-b border-rule pb-fl-24">
        <div className="flex flex-col gap-fl-8">
          <span className="mono-label text-muted">/ Admin · dev only</span>
          <h1 className="display text-fl-48 leading-none tracking-heading">Open Graph</h1>
          <p className="font-mono text-fl-14 text-muted">
            {q ? `${shown.length} of ${pages.length}` : pages.length} routes · {pages.filter((p) => p.draft).length}{" "}
            drafts
          </p>
        </div>
        {/* Filters the routes and hides the playground. */}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search routes"
          aria-label="Search routes by title or path"
          autoComplete="off"
          spellCheck={false}
          className="w-72 max-w-full border border-rule bg-paper-light px-3 py-2 font-mono text-fl-14 focus:border-ink focus:outline-none"
        />
      </header>

      <div className="mb-8 grid gap-y-3">
        <Row label="Width">
          {WIDTHS.map(([l, px]) => (
            <Chip key={px} on={px === width} onClick={() => setWidth(px)}>
              {l} · {px}
            </Chip>
          ))}
        </Row>
        <Row label="Show">
          <Chip on={guides} onClick={() => setGuides(!guides)}>
            Square crop
          </Chip>
          <Chip on={preview} onClick={() => setPreview(!preview)}>
            Link preview
          </Chip>
          <Chip on={false} onClick={() => setVersion(version + 1)}>
            Reload all
          </Chip>
        </Row>
        <Row label="Gelica">
          <span className="text-muted">
            {pages.filter((p) => p.card === "saved").length} saved · {unsaved} stale or missing
          </span>
          {unsaved > 0 && (
            <CaptureButton
              label="Save stale & missing"
              action={async () => {
                const error = await capture("all=stale");
                router.refresh();
                setVersion((v) => v + 1);
                return error;
              }}
            />
          )}
        </Row>
      </div>

      {/* Hidden rather than unmounted, so what's typed into it survives a search. */}
      <div hidden={Boolean(q)}>
        <Playground width={width} guides={guides} scenes={scenes} mediaKeys={mediaKeys} />
      </div>

      {notesError && <p className="mb-6 text-pink-ink">Notes failed to load: {notesError}</p>}
      <div className="grid gap-y-16">
        {shown.map((p) => (
          <Card key={p.path} page={p} width={width} guides={guides} preview={preview} version={version} />
        ))}
        {shown.length === 0 && <p className="text-muted">No routes match “{query}”.</p>}
      </div>
    </Container>
  );
}

function Card({
  page,
  width,
  guides,
  preview,
  version,
}: {
  page: OgPage;
  width: number;
  guides: boolean;
  preview: boolean;
  version: number;
}) {
  const router = useRouter();
  const [own, setOwn] = useState(0);
  const meta = useMeta(page.path, version + own);
  const ogImage = meta.value?.["og:image"];
  const img = useOgImage(ogImage ? localPath(ogImage) : null, version + own);
  const issues = problems(meta.value, img.value);

  return (
    <article className="grid w-fit max-w-full gap-4">
      <header className="flex flex-col gap-1">
        <a href={page.path} className="w-fit text-[20px] underline-offset-2 hover:underline">
          {page.label}
        </a>
        <div className="flex items-baseline gap-3">
          <span className="text-muted">{page.path}</span>
          {page.draft && <span className="text-pink-ink">draft</span>}
          <span className="ml-auto flex items-baseline gap-3">
            {page.card && (
              <>
                <a
                  href={`/admin/og/card?path=${encodeURIComponent(page.path)}`}
                  className={page.card === "saved" ? "text-muted hover:text-ink" : "text-pink-ink hover:text-ink"}
                >
                  Gelica {page.card}
                </a>
                <CaptureButton
                  label="Save"
                  action={async () => {
                    const error = await capture(`path=${encodeURIComponent(page.path)}`);
                    router.refresh();
                    setOwn((n) => n + 1);
                    return error;
                  }}
                />
              </>
            )}
            <button type="button" onClick={() => setOwn(own + 1)} className="text-muted hover:text-ink">
              Reload
            </button>
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-8">
        <div className="grid w-[520px] max-w-full content-start gap-3">
          {(meta.error || img.error) && <p className="whitespace-pre-wrap text-pink-ink">{meta.error ?? img.error}</p>}
          {issues.length > 0 && (
            <ul className="text-pink-ink">
              {issues.map((i) => (
                <li key={i}>⚠ {i}</li>
              ))}
            </ul>
          )}
          {meta.value && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {Object.entries(meta.value).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div style={{ width }} className="flex max-w-full flex-col gap-2">
          <Frame
            img={img.value}
            alt={meta.value?.["og:image:alt"] ?? ""}
            guides={guides}
            busy={meta.loading || img.loading}
          />
          <Stats img={img.value} />
          {preview && meta.value && <LinkPreview meta={meta.value} src={img.value?.src} />}
        </div>
      </div>
    </article>
  );
}

function Playground({
  width,
  guides,
  scenes,
  mediaKeys,
}: {
  width: number;
  guides: boolean;
  scenes: string[];
  mediaKeys: string[];
}) {
  const [eyebrow, setEyebrow] = useState("/ 00  Burlington, Vermont");
  const [title, setTitle] = useState("Let’s think it through, *together.*");
  const [illustration, setIllustration] = useState("puzzle-cube");
  const [image, setImage] = useState("");
  const [version, setVersion] = useState(0);

  const url = `/admin/og/card?${new URLSearchParams({ eyebrow, title, illustration, image })}`;
  // Re-render once typing pauses, not on every keystroke.
  const [settled, setSettled] = useState(url);
  useEffect(() => {
    const t = setTimeout(() => setSettled(url), 300);
    return () => clearTimeout(t);
  }, [url]);

  return (
    <section className="mb-12 border-y border-rule py-6">
      <h2 className="mb-4 text-[20px]">Playground</h2>
      <div className="flex flex-wrap gap-8">
        <div className="grid w-[520px] max-w-full content-start gap-3">
          <Field id="og-eyebrow" label="Eyebrow (parts split by two spaces)">
            <input id="og-eyebrow" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} className={input} />
          </Field>
          <Field id="og-title" label={`Title (*starred* = pink) · ${title.replace(/\*/g, "").length} chars`}>
            <textarea
              id="og-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              className={input}
            />
          </Field>
          <Field id="og-illustration" label="Illustration">
            <select
              id="og-illustration"
              value={illustration}
              onChange={(e) => setIllustration(e.target.value)}
              className={input}
            >
              <option value="">None</option>
              {scenes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field id="og-image" label="Image (media key; replaces the illustration)">
            <input
              id="og-image"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              list="og-media-keys"
              placeholder="notes/…"
              className={input}
            />
            <datalist id="og-media-keys">
              {mediaKeys.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>
          <div className="flex gap-2">
            <Chip on={false} onClick={() => setVersion(version + 1)}>
              Re-render
            </Chip>
            <a href={settled} target="_blank" rel="noreferrer" className="self-center text-muted hover:text-ink">
              Open card ↗
            </a>
          </div>
        </div>
        <div style={{ width }} className="flex max-w-full flex-col gap-2">
          <CardFrame key={version} src={settled} guides={guides} />
          <p className="text-muted">Gelica, as the browser draws it for Save</p>
        </div>
      </div>
    </section>
  );
}

function Frame({ img, alt, guides, busy }: { img?: Loaded; alt: string; guides: boolean; busy: boolean }) {
  return (
    <div className="relative aspect-[1200/630] w-full overflow-hidden bg-paper outline outline-rule">
      {/* biome-ignore lint/performance/noImgElement: a blob: URL of the generated card, shown at its real pixels. */}
      {img && <img src={img.src} alt={alt} className="size-full" />}
      {/* Apps that crop link images square keep roughly the middle. */}
      {guides && (
        <div className="absolute inset-y-0 left-1/2 aspect-square -translate-x-1/2 outline-2 outline-pink outline-dashed" />
      )}
      {busy && <div className="absolute top-2 right-2 rounded-full bg-ink px-2 py-0.5 text-paper">Rendering…</div>}
    </div>
  );
}

/** The browser-drawn card page (1200×630) in an iframe, scaled to fit the frame's width. */
function CardFrame({ src, guides }: { src: string; guides: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1200));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative aspect-[1200/630] w-full overflow-hidden bg-paper outline outline-rule">
      <iframe
        src={src}
        title="Card preview"
        className="pointer-events-none absolute top-0 left-0 h-[630px] w-[1200px] origin-top-left border-0"
        style={{ transform: `scale(${scale})` }}
      />
      {guides && (
        <div className="absolute inset-y-0 left-1/2 aspect-square -translate-x-1/2 outline-2 outline-pink outline-dashed" />
      )}
    </div>
  );
}

function Stats({ img }: { img?: Loaded }) {
  if (!img) return null;
  return (
    <p className="text-muted">
      {img.width}×{img.height} · {kb(img.bytes)} · {img.type} · {Math.round(img.ms)} ms
    </p>
  );
}

/** Roughly how Slack/iMessage-style unfurls show the card. */
function LinkPreview({ meta, src }: { meta: Meta; src?: string }) {
  const host = meta["og:url"] ? new URL(meta["og:url"]).host : "okaypl.us";
  return (
    <div className="max-w-[420px] overflow-hidden rounded-lg border border-rule bg-paper font-sans text-[13px]">
      {/* biome-ignore lint/performance/noImgElement: blob: URL. */}
      {src && <img src={src} alt="" className="aspect-[1200/630] w-full object-cover" />}
      <div className="grid gap-1 p-3">
        <span className="text-muted">{host}</span>
        <strong className="font-semibold">{meta["og:title"] ?? meta.title}</strong>
        <span className="line-clamp-2 text-body">{meta["og:description"] ?? meta.description}</span>
      </div>
    </div>
  );
}

const input =
  "w-full rounded border border-rule bg-paper px-2 py-1 font-mono text-[12px] focus:border-ink focus:outline-none";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 shrink-0 text-muted">{label}</span>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1",
        on ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}
