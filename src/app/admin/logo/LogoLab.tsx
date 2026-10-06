"use client";

import { type ReactNode, useState } from "react";
import { DockLogo } from "@/components/logo/DockLogo";
import { DEFAULT_DOCK, type DockAnchor, type DockFalloff, type DockSettings, falloff } from "@/components/logo/dock";
import { cn } from "@/lib/cn";

const SLIDERS: [
  key: keyof Omit<DockSettings, "falloff" | "anchor">,
  label: string,
  min: number,
  max: number,
  step: number,
][] = [
  ["scale", "Peak scale", 1, 2.5, 0.01],
  ["reach", "Reach (letters)", 0.5, 5, 0.05],
  ["spread", "Spread", 0, 1, 0.01],
  ["originY", "Origin y", 0, 1, 0.01],
  ["stiffness", "Stiffness", 20, 1200, 5],
  ["damping", "Damping", 1, 80, 0.5],
  ["mass", "Mass", 0.1, 5, 0.05],
];

const FALLOFFS: DockFalloff[] = ["cosine", "gaussian", "linear"];
const ANCHORS: DockAnchor[] = ["pointer", "left", "center"];

// Logo heights to try it at: the nav's (h-7 from lg), then bigger to see the motion.
const SIZES: [label: string, className: string][] = [
  ["Nav · 28px", "h-7 lg:h-7"],
  ["64px", "h-16 lg:h-16"],
  ["160px", "h-40 lg:h-40"],
];

export function LogoLab() {
  const [settings, setSettings] = useState<DockSettings>(DEFAULT_DOCK);
  const [dark, setDark] = useState(false);
  const set = (patch: Partial<DockSettings>) => setSettings({ ...settings, ...patch });
  // Below 1 the spring overshoots; the lower, the more it bounces.
  const zeta = settings.damping / (2 * Math.sqrt(settings.stiffness * settings.mass));

  return (
    <div className="pt-fl-56 pb-fl-96 font-mono text-[12px]">
      <header className="mb-fl-32 flex flex-col gap-fl-8 border-b border-rule pb-fl-24">
        <span className="mono-label text-muted">/ Admin · dev only</span>
        <h1 className="display text-fl-48 leading-heading-48 tracking-display-48">Logo</h1>
        <p className="font-mono text-fl-14 text-muted">The nav wordmark's dock swell. Hover a logo below.</p>
      </header>

      <div className="mb-8 grid gap-x-10 gap-y-3 md:grid-cols-2">
        {SLIDERS.map(([key, label, min, max, step]) => (
          <Row key={key} label={label}>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={settings[key]}
              onChange={(e) => set({ [key]: +e.target.value })}
              className="w-48"
            />
            <span className="w-12 tabular-nums">{settings[key]}</span>
          </Row>
        ))}
        <Row label="Damping ratio">
          <span className="tabular-nums">{zeta.toFixed(2)}</span>
          <span className="text-muted">{zeta < 1 ? "bouncy" : "no overshoot"}</span>
        </Row>
        <Row label="Falloff">
          {FALLOFFS.map((f) => (
            <Chip key={f} on={f === settings.falloff} onClick={() => set({ falloff: f })}>
              {f}
            </Chip>
          ))}
        </Row>
        <Row label="Anchor">
          {ANCHORS.map((a) => (
            <Chip key={a} on={a === settings.anchor} onClick={() => set({ anchor: a })}>
              {a}
            </Chip>
          ))}
        </Row>
        <Row label="Background">
          <Chip on={!dark} onClick={() => setDark(false)}>
            Paper
          </Chip>
          <Chip on={dark} onClick={() => setDark(true)}>
            Ink
          </Chip>
        </Row>
        <Row label="Settings">
          <Chip on={false} onClick={() => setSettings(DEFAULT_DOCK)}>
            Reset
          </Chip>
          <Chip on={false} onClick={() => navigator.clipboard.writeText(JSON.stringify(settings))}>
            Copy settings
          </Chip>
        </Row>
      </div>

      <Curve settings={settings} />

      <div className={cn("mt-8 flex flex-col rounded-lg", dark ? "bg-ink text-paper" : "bg-paper-light")}>
        {SIZES.map(([label, className]) => (
          <div key={label} className="flex flex-col gap-4 border-b border-rule/50 px-fl-48 py-fl-48 last:border-0">
            <span className={dark ? "text-muted-light" : "text-muted"}>{label}</span>
            <DockLogo settings={settings} className={cn("self-start", className)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Target scale against distance from the pointer, in letters. */
function Curve({ settings }: { settings: DockSettings }) {
  const span = Math.max(settings.reach * 1.5, 1);
  const w = 480;
  const h = 96;
  const points = Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * 2 - 1;
    const scale = 1 + (settings.scale - 1) * falloff(settings.falloff, (t * span) / settings.reach);
    // Rounded so the server's and browser's Math.cos agree when hydrating.
    return `${(((t + 1) / 2) * w).toFixed(1)},${(h - ((scale - 1) / 1.5) * (h - 8)).toFixed(1)}`;
  });
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted">Target scale across ±{span.toFixed(1)} letters from the pointer</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-120 overflow-visible" aria-hidden>
        <line x1={0} x2={w} y1={h} y2={h} className="stroke-rule" />
        <line x1={w / 2} x2={w / 2} y1={0} y2={h} className="stroke-rule" strokeDasharray="2 3" />
        <polyline points={points.join(" ")} fill="none" className="stroke-pink" strokeWidth={2} />
      </svg>
    </figure>
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
