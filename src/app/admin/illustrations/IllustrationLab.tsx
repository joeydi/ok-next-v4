"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Container } from "@/components/Container";
import { GLIllustration } from "@/components/illustrations/gl/GLIllustration";
import { POSTER_WIDTHS } from "@/components/illustrations/gl/poster";
import { DEFAULT_SETTINGS, Renderer, type Settings } from "@/components/illustrations/gl/renderer";
import { SCENES, type SceneName } from "@/components/illustrations/gl/scenes";
import { cn } from "@/lib/cn";

const MODES = { side: "Side by side", overlay: "Overlay", gl: "WebGL only" };
type Mode = keyof typeof MODES;

// Illustration widths the pages actually use (see page.tsx / ServicePage.tsx).
const WIDTHS: [label: string, px: number][] = [
  ["320 vp", 288],
  ["390 vp", 358],
  ["768 vp", 540],
  ["1440 vp", 713],
  ["1920 vp", 951],
];

const SLIDERS: [key: keyof Omit<Settings, "edges">, label: string, min: number, max: number, step: number][] = [
  ["azimuth", "Light azimuth°", 0, 360, 1],
  ["elevation", "Light elevation°", 10, 89, 1],
  ["shadowSoft", "Shadow softness px", 0, 40, 0.5],
  ["shadowStrength", "Shadow strength", 0, 1, 0.01],
  ["aoStrength", "AO strength", 0, 2, 0.01],
  ["aoRadius", "AO radius px", 10, 300, 1],
  ["floorAo", "Floor contact AO", 0, 1, 0.01],
];

export function IllustrationLab({ css }: { css: Record<SceneName, ReactNode> }) {
  const [name, setName] = useState<SceneName>("ring");
  const [mode, setMode] = useState<Mode>("side");
  const [width, setWidth] = useState(540);
  const [playing, setPlaying] = useState(true);
  const [poster, setPoster] = useState("");
  const [time, setTime] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const duration = SCENES[name].duration;

  // The lab owns the clock so the scrubber follows playback.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      // Read the step now: the updater may run after `last` moves on.
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => (t + dt) % duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  // Renders the poster frame at the largest poster width with the default
  // settings (what the site uses) and hands it to the poster route.
  async function savePoster() {
    setPoster("Rendering…");
    const scene = SCENES[name];
    const canvas = document.createElement("canvas");
    canvas.width = POSTER_WIDTHS.at(-1)!;
    canvas.height = Math.round((canvas.width * 660) / 620);
    const r = await Renderer.create(canvas, { preserveDrawingBuffer: true, dither: false });
    r.render(scene, scene.frame(scene.posterTime), DEFAULT_SETTINGS);
    const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    r.dispose();
    const res = await fetch(`/admin/illustrations/poster?scene=${name}`, { method: "POST", body: png });
    const { written, error } = await res.json();
    setPoster(error ?? written.map((w: { file: string; bytes: number }) => `${w.file.split("/").pop()} ${(w.bytes / 1024).toFixed(1)}KB`).join(" · "));
  }

  const gl = <GLIllustration scene={name} time={time} settings={settings} className="w-full" />;
  const cssView = css[name];

  return (
    <Container className="py-fl-40 font-mono text-[12px]">
      <h1 className="mb-6 text-[20px]">Illustration lab</h1>

      <div className="mb-8 grid gap-x-10 gap-y-3 md:grid-cols-2">
        <Row label="Scene">
          {Object.keys(SCENES).map((k) => (
            <Chip key={k} on={k === name} onClick={() => setName(k as SceneName)}>
              {k}
            </Chip>
          ))}
        </Row>
        <Row label="View">
          {Object.entries(MODES).map(([k, l]) => (
            <Chip key={k} on={k === mode} onClick={() => setMode(k as Mode)}>
              {l}
            </Chip>
          ))}
        </Row>
        <Row label="Width">
          {WIDTHS.map(([l, px]) => (
            <Chip key={px} on={px === width} onClick={() => setWidth(px)}>
              {l} · {px}
            </Chip>
          ))}
        </Row>
        <Row label="Time">
          <Chip on={playing} onClick={() => setPlaying(!playing)}>
            {playing ? "Pause" : "Play"}
          </Chip>
          <Chip
            on={false}
            onClick={() => {
              setPlaying(false);
              setTime(SCENES[name].posterTime);
            }}
          >
            Poster frame
          </Chip>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={time}
            onChange={(e) => {
              setPlaying(false);
              setTime(+e.target.value);
            }}
            className="w-48"
          />
          <span className="w-12 tabular-nums">{time.toFixed(2)}s</span>
        </Row>
        {SLIDERS.map(([key, label, min, max, step]) => (
          <Row key={key} label={label}>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={settings[key]}
              onChange={(e) => setSettings({ ...settings, [key]: +e.target.value })}
              className="w-48"
            />
            <span className="w-12 tabular-nums">{settings[key]}</span>
          </Row>
        ))}
        <Row label="Edges">
          <Chip on={settings.edges} onClick={() => setSettings({ ...settings, edges: !settings.edges })}>
            {settings.edges ? "On" : "Off"}
          </Chip>
          <Chip on={false} onClick={() => setSettings(DEFAULT_SETTINGS)}>
            Reset
          </Chip>
          <Chip on={false} onClick={() => navigator.clipboard.writeText(JSON.stringify(settings))}>
            Copy settings
          </Chip>
        </Row>
        <Row label="Poster">
          <Chip on={false} onClick={savePoster}>
            Save poster
          </Chip>
          <span className="text-muted">{poster || "Default settings, to public/illustrations"}</span>
        </Row>
      </div>

      {mode === "side" ? (
        <div className="flex flex-wrap gap-8">
          <Panel label="CSS" width={width}>
            {cssView}
          </Panel>
          <Panel label="WebGL" width={width}>
            {gl}
          </Panel>
        </div>
      ) : mode === "overlay" ? (
        <Panel label="CSS + WebGL at 50%" width={width}>
          <div className="relative">
            {cssView}
            <div className="absolute inset-0 opacity-50">{gl}</div>
          </div>
        </Panel>
      ) : (
        <Panel label="WebGL" width={width}>
          {gl}
        </Panel>
      )}
    </Container>
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
      className={cn("rounded-full border px-3 py-1", on ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink")}
    >
      {children}
    </button>
  );
}

function Panel({ label, width, children }: { label: string; width: number; children: ReactNode }) {
  return (
    <figure style={{ width }} className="max-w-full">
      <figcaption className="mb-2 text-muted">{label}</figcaption>
      <div className="outline outline-rule">{children}</div>
    </figure>
  );
}
