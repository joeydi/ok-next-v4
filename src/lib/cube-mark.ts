// Brand mark: an isometric cube with a pink middle band, echoing the Home puzzle cube.
// Used for the favicon, Apple touch icon, and OG images.

const W = { top: "#FAF7F4", left: "#D8CCBF", right: "#C8BAAB" };
const P = { left: "#D62A4A", right: "#E63757" };

export function cubeMarkSvg({ background = "#1D1A17", size = 32 }: { background?: string | null; size?: number } = {}) {
  // Unit cube in a 32×32 box.
  const cx = 16, top = 4, dx = 11, dy = 6.35, h = 12.7;
  const band = h / 3;
  const left = (y0: number, y1: number, fill: string) =>
    `<path d="M${cx - dx} ${top + dy + y0} L${cx} ${top + 2 * dy + y0} L${cx} ${top + 2 * dy + y1} L${cx - dx} ${top + dy + y1}Z" fill="${fill}"/>`;
  const right = (y0: number, y1: number, fill: string) =>
    `<path d="M${cx} ${top + 2 * dy + y0} L${cx + dx} ${top + dy + y0} L${cx + dx} ${top + dy + y1} L${cx} ${top + 2 * dy + y1}Z" fill="${fill}"/>`;
  const bands = [W, P, W];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">`,
    background ? `<rect width="32" height="32" fill="${background}"/>` : "",
    ...bands.flatMap((c, i) => [left(i * band, (i + 1) * band, c.left), right(i * band, (i + 1) * band, c.right)]),
    `<path d="M${cx} ${top} L${cx + dx} ${top + dy} L${cx} ${top + 2 * dy} L${cx - dx} ${top + dy}Z" fill="${W.top}"/>`,
    `</svg>`,
  ].join("");
}
