import { Box, P, Scene, Stage, W } from "./primitives";

// [low, high] bar heights as a fraction of 200px
const BARS = [[0.3, 0.5], [0.5, 0.7], [0.35, 0.55], [0.6, 0.8], [0.85, 1], [0.4, 0.6], [0.25, 0.45], [0.55, 0.75], [0.2, 0.35]] as const;

/** Tools for better work — a 3×3 grid of isometric bars breathing in Z, staggered. */
export function Dashboard({ className }: { className?: string }) {
  return (
    <Stage labels={["VISIBILITY", "AUTOMATION", "MONITORING"]} className={className}>
      <Scene>
        {BARS.map(([a, b], i) => (
          <Box
            key={i}
            x={22 + (i % 3) * 90}
            y={22 + Math.floor(i / 3) * 90}
            w={64}
            d={64}
            h={200}
            c={i === 4 ? P : W}
            still={`translateZ(0) scale3d(1,1,${(a + b) / 2})`}
            vars={{ "--a": a, "--b": b }}
            anim={`okBar ${4 + (i % 3)}s ease-in-out ${-i * 0.7}s infinite`}
          />
        ))}
      </Scene>
    </Stage>
  );
}
