import { Box, N, P, Scene, Stage, W, type Style } from "./primitives";

const SLOTS = [[10, 10], [54, 10], [10, 54], [54, 54]] as const;
// Which slot is missing on each of the four platforms.
const MISSING = [0, 1, 3, 2] as const;
// Resting Y offset of each platform along the conveyor when motion is off.
const STILL_Y = [-120, 240, 120, 0] as const;

/**
 * CMS & integrations — a line of platforms slides along the iso diagonal while
 * a pink tile hops from the lower platform to fill each one's gap. 6s loop,
 * platforms offset by 1.5s.
 */
export function Conveyor({ className }: { className?: string }) {
  return (
    <Stage labels={["CONTENT", "INTEGRATIONS", "PLATFORM"]} className={className}>
      <Scene>
        <Box x={15} y={100} w={100} d={100} h={40} c={N} />
        {MISSING.map((miss, j) => {
          const delay = -j * 1.5;
          const platform: Style = {
            position: "absolute",
            left: 185,
            top: 100,
            width: 100,
            height: 100,
            transformStyle: "preserve-3d",
            transform: `translate3d(0,${STILL_Y[j]}px,0)`,
            animation: `okConvey 6s ease-in-out ${delay}s infinite`,
          };
          const [sx, sy] = SLOTS[miss];
          return [
            <div key={`pl${j}`} style={platform}>
              <Box x={0} y={0} w={100} d={100} h={40} c={W} />
              {SLOTS.map(([x, y], k) => (
                <Box
                  key={k}
                  x={x}
                  y={y}
                  z={40}
                  w={36}
                  d={36}
                  h={14}
                  c={P}
                  anim={k === miss ? `okFill 6s linear ${delay}s infinite` : undefined}
                />
              ))}
            </div>,
            <Box
              key={`t${j}`}
              x={15 + sx}
              y={100 + sy}
              z={40}
              w={36}
              d={36}
              h={14}
              c={P}
              still="translate3d(0,0,40px) scale3d(.001,.001,.001)"
              vars={{ "--dx": "170px" }}
              anim={`okHop2 6s linear ${delay}s infinite`}
            />,
          ];
        })}
      </Scene>
    </Stage>
  );
}
