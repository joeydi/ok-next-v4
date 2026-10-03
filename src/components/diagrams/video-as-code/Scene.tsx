import type { CSSProperties } from "react";
import { seek, type Tone, VIEW } from "./film";

// One frame of the film, drawn `width` px wide, by look: "frame" as the screenshot
// shows it, or "subject" as seek(t)'s output, its shapes in the pink hatch (pass
// the id of a HatchDef on the page).

const TONES: Record<Tone, string> = { ink: "fill-ink", muted: "fill-muted-light", pink: "fill-pink" };

type Props = {
  t: number;
  width: number;
  fix?: boolean;
  look?: "frame" | "subject";
  hatch?: string;
  className?: string;
  style?: CSSProperties;
};

export function Scene({ t, width, fix = false, look = "frame", hatch, className, style }: Props) {
  const k = width / VIEW[0];
  const height = width * (VIEW[1] / VIEW[0]);
  return (
    <svg aria-hidden="true" width={width} height={height} className={className} style={style}>
      {seek(t, fix).map((s, i) => {
        const shape =
          s.kind === "rect"
            ? { x: s.x * k, y: s.y * k, width: s.w * k, height: s.h * k }
            : { cx: s.x * k, cy: s.y * k, r: s.r * k };
        const Tag = s.kind === "rect" ? "rect" : "circle";
        if (look === "frame") return <Tag key={i} {...shape} className={TONES[s.tone]} />;
        return (
          <g key={i}>
            <Tag {...shape} className="fill-pink/15" />
            <Tag {...shape} fill={hatch ? `url(#${hatch})` : "none"} className="stroke-pink" strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}
