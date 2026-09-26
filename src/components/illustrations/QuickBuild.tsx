import { Box, P, Scene, Stage, W } from "./primitives";

/** Creative production — four slabs drop in with a bounce, hold, then slide off along +X. 5.5s loop. */
export function QuickBuild({ className }: { className?: string }) {
  return (
    <Stage labels={["AGENCIES", "CAMPAIGNS", "REPORTING"]} className={className}>
      <Scene>
        {[W, W, W, P].map((c, i) => (
          <Box key={i} x={60} y={60} z={i * 40} w={180} d={180} h={36} c={c} anim={`okDrop${i} 5.5s linear infinite`} />
        ))}
      </Scene>
    </Stage>
  );
}
