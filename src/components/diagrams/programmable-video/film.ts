// The film in the programmable-video note's diagram: three one-second shots (a title,
// a bouncing ball, a bar chart), written as the note describes, as one function of
// time. `seek(t)` returns the frame at `t` and nothing else, so any frame can be
// drawn on its own, in any order, and the same `t` always gives the same frame.

export const FPS = 8; // the film's frame rate: low, so each frame reads on its own
export const SHOTS = 3; // one second each
export const FRAMES = FPS * SHOTS;
export const VIEW = [160, 90] as const; // the scene's own units, 16:9

/** Any time (s) as a time in the film: the film loops. */
export const filmTime = (t: number) => ((t % SHOTS) + SHOTS) % SHOTS;
/** Frame `j`'s time (s), for any whole `j`. */
export const frameTime = (j: number) => (((j % FRAMES) + FRAMES) % FRAMES) / FPS;

export type Tone = "ink" | "muted" | "pink";
export type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; tone: Tone }
  | { kind: "circle"; x: number; y: number; r: number; tone: Tone };

export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x: number) => {
  const c = clamp(x);
  return c < 0.5 ? 4 * c ** 3 : 1 - (2 - 2 * c) ** 3 / 2;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * The capture `t` s into a diagram's loop that spends `step` s on each frame (the
 * capture keeps its own pace, not the film's): the frame it's on, `i` (it wraps
 * at FRAMES with the loop), and `s`, 0–1 through the step's opening `move`,
 * eased in and out.
 */
export function capture(t: number, step: number, move: number) {
  const u = t / step;
  const i = Math.floor(u);
  return { i, s: easeInOut((u - i) / move) };
}

const GROUND = 74;
const BARS = [30, 46, 22, 56];

/** The film at `t` seconds, as shapes in VIEW units. `fix` is the edit to the ball shot: a bigger, pink ball. */
export function seek(t: number, fix = false): Shape[] {
  const shot = Math.floor(t) % SHOTS;
  const u = t - Math.floor(t);
  if (shot === 0)
    return [
      { kind: "rect", x: lerp(-96, 24, easeOut(u / 0.6)), y: 30, w: 88, h: 12, tone: "ink" },
      { kind: "rect", x: lerp(-64, 24, easeOut((u - 0.25) / 0.6)), y: 50, w: 56, h: 6, tone: "muted" },
    ];
  if (shot === 1) {
    const r = fix ? 9 : 7;
    return [
      { kind: "rect", x: 0, y: GROUND, w: VIEW[0], h: 1.5, tone: "muted" },
      { kind: "circle", x: 22 + 116 * u, y: GROUND - r - 44 * Math.sin(Math.PI * u), r, tone: fix ? "pink" : "ink" },
    ];
  }
  return [
    { kind: "rect", x: 20, y: GROUND, w: 120, h: 1.5, tone: "muted" },
    ...BARS.map((h, i): Shape => {
      const k = easeOut((u - i * 0.1) / 0.6) * h;
      return { kind: "rect", x: 32 + i * 26, y: GROUND - k, w: 18, h: k, tone: i === 3 ? "ink" : "muted" };
    }),
  ];
}
