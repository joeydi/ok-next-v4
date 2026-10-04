import { cross, dot, icosphere, LIGHT, norm, sub, type Vec } from "../icosphere";
import type { Palette } from "../primitives";
import { deg, identity, type Mat4, mul, Q0, type Quat, qrot, rotateX, rotateZ, scale, translate, trs } from "./math";
import { LIT_FS, LIT_VS, MAX_OCC } from "./shaders";

// A tiny WebGL2 renderer for the hero illustrations. Scenes use the CSS
// handoff's coordinates: px on the 300×300 iso plane, y down, z up. The camera
// is the handoff's scene transform exactly, so it's orthographic.

export type BoxItem = {
  kind: "box";
  center: Vec;
  half: Vec;
  q?: Quat;
  pal: Palette;
  /** A second palette blended toward by `mix` (0–1), e.g. a flash of colour. */
  pal2?: Palette;
  mix?: number;
  /** Walls fade into the paper at their foot, reaching full colour this fraction of the way up. */
  groundFade?: number;
  /** Which faces (by local axis x, y, z) carry the 1px inset edge line. */
  edges?: Vec;
  /** Opacity: 0 = gone, 1 = solid. */
  fade?: number;
};

export type BallItem = {
  kind: "ball";
  center: Vec;
  r: number;
  q?: Quat;
  /** Facet edge width, in barycentric units (0 = none). */
  edge?: number;
  fade?: number;
};

export type Item = BoxItem | BallItem;

/** x0, y0, x1, y1 on the plane (px). */
export type Rect = [x0: number, y0: number, x1: number, y1: number];

export type SceneDef = {
  labels: readonly [string, string, string];
  guideEnd?: number;
  /** Loop length (s). */
  duration: number;
  /** The frame the poster shows, the loop starts on, and prefers-reduced-motion keeps (s). */
  posterTime: number;
  /** Screen-space transform applied before the iso rotation, like Scene's `pre`. */
  pre?: Mat4;
  floorZ?: number;
  /** Floor area drawn in tiles, taking AO (multiples of 60); objects and their AO reach must stay inside. */
  floor?: Rect;
  frame(t: number): Item[];
  /** Makes the scene interactive on the page: a player that stands in for `frame`. */
  play?: () => Player;
  /** Canvas-px outline that takes the player's pointer input (and touch, instead of scrolling). */
  hitArea?: [number, number][];
};

/** An interactive run of a scene: owns its clock and takes pointer input in canvas px. */
export type Player = {
  /** The items at `now` (s, the rAF clock). */
  frame(now: number): Item[];
  /** Whether the press landed on something to drag; `t` is the event's time (s). */
  down(x: number, y: number, t: number): boolean;
  move(x: number, y: number, t: number): void;
  up(t: number): void;
  /** Whether something draggable is under the pointer. */
  hover(x: number, y: number): boolean;
};

export type Settings = {
  /** Light direction: compass angle on the plane (deg) and height above it (deg). */
  azimuth: number;
  elevation: number;
  /** Penumbra radius (px). */
  shadowSoft: number;
  shadowStrength: number;
  aoStrength: number;
  /** How far occlusion reaches (px). */
  aoRadius: number;
  floorAo: number;
  edges: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  azimuth: 250,
  elevation: 65,
  shadowSoft: 25,
  shadowStrength: 0.35,
  aoStrength: 1.25,
  aoRadius: 50,
  floorAo: 0.35,
  edges: false,
};

const W = 620,
  H = 660;
const PAPER = "#F1E8E4";
const TINT = "#AB899A";
/** The floor beyond the tiles, out past every canvas edge (integers, so seams are exact). */
const FLOOR_MIN = -1500,
  FLOOR_MAX = 1800;
const DEFAULT_FLOOR: Rect = [-150, -150, 450, 450];
/** Floor tile size (px): each tile loops over only the objects in reach. */
const TILE = 60;

/** Texels per object in the shadow data: shape (5) and up to 8 outline edges. */
const SHADOW_ROW = 13;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Interleaved position, normal, barycentric; indexed unless `idx` is omitted. */
type MeshData = { v: number[]; idx?: number[] };
type Mesh = { vao: WebGLVertexArrayObject; bufs: WebGLBuffer[]; count: number; type: number | null };

/** Unit cube, each face an n×n grid. */
function boxMesh(n = 1): MeshData {
  const v: number[] = [],
    idx: number[] = [];
  for (let a = 0; a < 3; a++)
    for (const s of [1, -1]) {
      const u = (a + 1) % 3,
        w = (a + 2) % 3;
      const base = v.length / 9;
      for (let i = 0; i <= n; i++)
        for (let j = 0; j <= n; j++) {
          const p: Vec = [0, 0, 0],
            nor: Vec = [0, 0, 0];
          p[a] = s > 0 ? 1 : 0;
          p[u] = i / n;
          p[w] = j / n;
          nor[a] = s;
          v.push(...p, ...nor, 1, 1, 1);
        }
      const at = (i: number, j: number) => base + i * (n + 1) + j;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          // u × w = +a, so this order winds counter-clockwise seen from outside +a faces.
          const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
          idx.push(...(s > 0 ? [q[0], q[1], q[2], q[0], q[2], q[3]] : [q[0], q[2], q[1], q[0], q[3], q[2]]));
        }
    }
  return { v, idx };
}

/** The ball's 80 flat facets (not indexed: each corner carries its facet's normal and barycentrics). */
function ballMesh(): MeshData {
  const v: number[] = [];
  for (const tri of icosphere(1)) {
    const a = tri[0];
    let [, b, c] = tri;
    const cen: Vec = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot(cross(sub(b, a), sub(c, a)), cen) < 0) [b, c] = [c, b];
    const n = norm(cross(sub(b, a), sub(c, a)));
    v.push(...a, ...n, 1, 0, 0, ...b, ...n, 0, 1, 0, ...c, ...n, 0, 0, 1);
  }
  return { v };
}

/** Unit quad, placed per floor tile and per strip of the floor outside them. */
function quadMesh(): MeshData {
  const corners: Vec[] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ];
  return { v: corners.flatMap((c) => [...c, 0, 0, 1, 1, 1, 1]), idx: [0, 1, 2, 0, 2, 3] };
}

/** Convex hull of 2D points, counter-clockwise (Andrew's monotone chain). */
export function hull(points: [number, number][]) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (pts: [number, number][]) => {
    const h: [number, number][] = [];
    for (const q of pts) {
      while (h.length >= 2 && turn(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    return h.slice(0, -1);
  };
  return [...half(p), ...half(p.reverse())];
}

/** Maps canvas px (y down, z toward the viewer) to clip space. */
const CANVAS_TO_CLIP = mul(translate(-1, 1, 0), scale(2 / W, -2 / H, -1 / 1000));

/** Plane px → canvas px: the handoff's rotateX(58deg) rotateZ(-45deg) (after the scene's `pre`) about the plane's centre, (300, 400) on the canvas. */
export const planeToCanvas = (scene: Pick<SceneDef, "pre">) =>
  mul(
    translate(300, 400, 0),
    ...(scene.pre ? [scene.pre] : []),
    rotateX(deg(58)),
    rotateZ(deg(-45)),
    translate(-150, -150, 0),
  );

function startProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  return p;
}

function checkProgram(gl: WebGL2RenderingContext, p: WebGLProgram) {
  if (gl.getProgramParameter(p, gl.LINK_STATUS)) return;
  const logs = (gl.getAttachedShaders(p) ?? []).map((s) => gl.getShaderInfoLog(s)).filter(Boolean);
  throw new Error([gl.getProgramInfoLog(p), ...logs].join("\n"));
}

export class Renderer {
  private loc = new Map<string, WebGLUniformLocation | null>();
  private box: Mesh;
  private ball: Mesh;
  private quad: Mesh;
  private shadowTex: WebGLTexture;
  private shadowData = new Float32Array(SHADOW_ROW * 4 * MAX_OCC);
  private colors = new Map<string, number[]>();
  private palettes = new WeakMap<Palette, Float32Array>();
  // Cached until the scene or light changes.
  private viewScene: SceneDef | null = null;
  private view = identity();
  private toViewer: Vec = [0, 0, 1];
  private lightKey = "";
  private light: Vec = [0, 0, 1];
  // The plane the light sees, perpendicular to it.
  private lightU: Vec = [1, 0, 0];
  private lightV: Vec = [0, 1, 0];
  // Scratch, reused every frame.
  private models: Mat4[] = [];
  private scratch = identity();
  private occA = new Float32Array(MAX_OCC * 4);
  private occB = new Float32Array(MAX_OCC * 4);
  private occQ = new Float32Array(MAX_OCC * 4);

  /**
   * Compiles the shaders off the main thread where the driver supports
   * KHR_parallel_shader_compile, instead of blocking on the first draw.
   * `dither` breaks up banding on screen; poster exports turn it off, since
   * noise is what image codecs compress worst.
   */
  static async create(canvas: HTMLCanvasElement, { preserveDrawingBuffer = false, dither = true } = {}) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      stencil: true,
      preserveDrawingBuffer,
    });
    if (!gl) throw new Error("WebGL2 unavailable");
    const ext = gl.getExtension("KHR_parallel_shader_compile");
    const lit = startProgram(gl, LIT_VS, LIT_FS);
    if (ext)
      while (!gl.getProgramParameter(lit, ext.COMPLETION_STATUS_KHR)) await new Promise((r) => setTimeout(r, 16));
    checkProgram(gl, lit);
    return new Renderer(canvas, gl, lit, dither);
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    private gl: WebGL2RenderingContext,
    private lit: WebGLProgram,
    private dither: boolean,
  ) {
    this.box = this.mesh(boxMesh());
    this.ball = this.mesh(ballMesh());
    this.quad = this.mesh(quadMesh());
    this.shadowTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, SHADOW_ROW, MAX_OCC);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private mesh({ v, idx }: MeshData): Mesh {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, i * 12);
    }
    const bufs = [vbuf];
    let type: number | null = null;
    if (idx) {
      const ibuf = gl.createBuffer()!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      const wide = v.length / 9 > 65535;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wide ? new Uint32Array(idx) : new Uint16Array(idx), gl.STATIC_DRAW);
      type = wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      bufs.push(ibuf);
    }
    gl.bindVertexArray(null);
    return { vao, bufs, count: idx?.length ?? v.length / 9, type };
  }

  private draw(m: Mesh) {
    const gl = this.gl;
    gl.bindVertexArray(m.vao);
    if (m.type === null) gl.drawArrays(gl.TRIANGLES, 0, m.count);
    else gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
  }

  private u(p: WebGLProgram, name: string) {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(p, name));
    return this.loc.get(name)!;
  }

  private color(hex: string) {
    if (!this.colors.has(hex)) this.colors.set(hex, rgb(hex));
    return this.colors.get(hex)!;
  }

  private palette(pal: Palette) {
    let a = this.palettes.get(pal);
    if (!a) this.palettes.set(pal, (a = new Float32Array(pal.flatMap((c) => this.color(c)))));
    return a;
  }

  /**
   * Each object as the light sees it, one texture row per object: centre and
   * kind; half-size grown by the penumbra (box) or radius (ball), and opacity;
   * the inverse rotation; the light direction in the box's frame (inverted,
   * for a slab test); a bounding circle of its outline and its 3D bounding
   * radius; then the outline's edges as lines (nx, ny, c) in the light's
   * plane, padded to 8. Returns each object's bounds for choosing rows per draw.
   */
  private shadowRows(list: Item[], soft: number) {
    const d = this.shadowData.fill(0);
    const bounds: { u: number; v: number; r: number; r3: number }[] = [];
    const L = this.light,
      U = this.lightU,
      V = this.lightV;
    const onPlane = (p: Vec): [number, number] => [dot(p, U), dot(p, V)];
    list.forEach((it, i) => {
      const row = i * SHADOW_ROW * 4;
      const set = (texel: number, v: number[]) => d.set(v, row + texel * 4);
      const [cu, cv] = onPlane(it.center);
      if (it.kind === "ball") {
        set(0, [...it.center, 1]);
        set(1, [it.r, 0, 0, it.fade ?? 1]);
        set(4, [cu, cv, it.r, it.r]);
        bounds.push({ u: cu, v: cv, r: it.r, r3: it.r });
        return;
      }
      const q = it.q ?? Q0,
        inv: Quat = [-q[0], -q[1], -q[2], q[3]];
      const ld = qrot(inv, L).map((x) => 1 / (Math.abs(x) < 1e-6 ? 1e-6 : x));
      set(0, [...it.center, 0]);
      set(1, [it.half[0] + soft, it.half[1] + soft, it.half[2] + soft, it.fade ?? 1]);
      set(2, inv);
      set(3, [...ld, 0]);
      const corners = [-1, 1].flatMap((x) =>
        [-1, 1].flatMap((y) =>
          [-1, 1].map((z) => {
            const o = qrot(q, [x * it.half[0], y * it.half[1], z * it.half[2]]);
            return onPlane([it.center[0] + o[0], it.center[1] + o[1], it.center[2] + o[2]]);
          }),
        ),
      );
      const h = hull(corners);
      const r = Math.max(0, ...h.map(([u, v]) => Math.hypot(u - cu, v - cv))),
        r3 = Math.hypot(...it.half);
      set(4, [cu, cv, r, r3]);
      bounds.push({ u: cu, v: cv, r, r3 });
      // Outward edge lines of the counter-clockwise outline; a degenerate one casts nothing.
      const lines = h.flatMap((a, k) => {
        const b = h[(k + 1) % h.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1e-6) return [];
        const nx = (b[1] - a[1]) / len,
          ny = -(b[0] - a[0]) / len;
        return [[nx, ny, nx * a[0] + ny * a[1], 0]];
      });
      for (let k = 0; k < 8; k++)
        set(5 + k, lines.length >= 3 ? lines[Math.min(k, lines.length - 1)] : [0, 0, -1e9, 0]);
    });
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SHADOW_ROW, MAX_OCC, gl.RGBA, gl.FLOAT, d);
    return bounds;
  }

  /** Sets the drawing buffer size in device pixels. True if it changed, which clears the canvas. */
  resize(width: number, height: number) {
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  render(scene: SceneDef, items: Item[], s: Settings) {
    const gl = this.gl;
    const floorZ = scene.floorZ ?? 0;
    if (scene !== this.viewScene) {
      this.viewScene = scene;
      this.view = mul(CANVAS_TO_CLIP, planeToCanvas(scene));
      // The one direction that keeps clip x and y, pointed toward smaller depth.
      const row = (r: number): Vec => [this.view[r], this.view[4 + r], this.view[8 + r]];
      const d = norm(cross(row(0), row(1)));
      this.toViewer = dot(d, row(2)) > 0 ? [-d[0], -d[1], -d[2]] : d;
    }
    const lightKey = `${s.azimuth},${s.elevation}`;
    if (lightKey !== this.lightKey) {
      this.lightKey = lightKey;
      const az = deg(s.azimuth),
        el = deg(s.elevation);
      const L: Vec = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
      this.light = L;
      this.lightU = norm(cross(L, Math.abs(L[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1]));
      this.lightV = cross(L, this.lightU);
    }
    const { view } = this;

    // Nearest first, so early depth testing skips shading hidden fragments.
    const depthOf = (it: Item) => view[2] * it.center[0] + view[6] * it.center[1] + view[10] * it.center[2];
    const list = items.slice(0, MAX_OCC).sort((a, b) => depthOf(a) - depthOf(b));
    list.forEach((it, i) => {
      const m = (this.models[i] ??= identity());
      if (it.kind === "box")
        trs(m, it.center, it.q ?? Q0, it.half[0] * 2, it.half[1] * 2, it.half[2] * 2, [-0.5, -0.5, -0.5]);
      else trs(m, it.center, it.q ?? Q0, it.r, it.r, it.r);
    });
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const p = this.lit;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    const bounds = this.shadowRows(list, s.shadowSoft);
    gl.uniform1i(this.u(p, "uShadowData"), 0);
    // Which rows can shade a draw, so each pixel only loops over those.
    const shadowIdx = new Int32Array(MAX_OCC);
    const setRows = (rows: number[]) => {
      shadowIdx.set(rows);
      gl.uniform1iv(this.u(p, "uShadowIdx"), shadowIdx);
      gl.uniform1i(this.u(p, "uShadowN"), rows.length);
    };
    /** For an object: the others whose outlines come near its own and sit toward the light. */
    const rowsForObject = (i: number) =>
      list.flatMap((other, j) => {
        const a = bounds[i],
          b = bounds[j];
        const toward = dot(sub(other.center, list[i].center), this.light) > -(a.r3 + b.r3);
        return j !== i && toward && Math.hypot(a.u - b.u, a.v - b.v) <= a.r + b.r + 2 * s.shadowSoft ? [j] : [];
      });
    // Where each object's shadow can land on the floor: its bounding sphere
    // pushed down the light onto the floor, widened by the slant and penumbra.
    const L = this.light;
    const onFloor = list.map((it, j) => {
      const k = (it.center[2] - floorZ) / L[2];
      return { x: it.center[0] - L[0] * k, y: it.center[1] - L[1] * k, r: bounds[j].r3 / L[2] + s.shadowSoft };
    });
    /** For a patch of floor: the objects whose shadow can land on it. */
    const rowsForRect = ([x0, y0, x1, y1]: Rect) =>
      onFloor.flatMap((f, j) =>
        Math.hypot(Math.max(x0 - f.x, 0, f.x - x1), Math.max(y0 - f.y, 0, f.y - y1)) < f.r ? [j] : [],
      );

    // Which objects can occlude a draw: those whose bounding sphere comes within the AO radius.
    const aoIdx = new Int32Array(MAX_OCC);
    const setAo = (rows: number[]) => {
      aoIdx.set(rows);
      gl.uniform1iv(this.u(p, "uAoIdx"), aoIdx);
      gl.uniform1i(this.u(p, "uAoN"), rows.length);
    };
    const aoForObject = (i: number) =>
      list.flatMap((other, j) => {
        const gap = Math.hypot(...sub(other.center, list[i].center)) - bounds[i].r3 - bounds[j].r3;
        return j !== i && gap < s.aoRadius ? [j] : [];
      });
    const aoForRect = ([x0, y0, x1, y1]: Rect) =>
      list.flatMap(({ center: [x, y, z] }, j) => {
        const gap = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1), z - floorZ) - bounds[j].r3;
        return gap < s.aoRadius ? [j] : [];
      });
    gl.uniform1f(this.u(p, "uShadowSoft"), s.shadowSoft);
    gl.uniform3fv(this.u(p, "uLightU"), this.lightU);
    gl.uniform3fv(this.u(p, "uLightV"), this.lightV);
    gl.uniformMatrix4fv(this.u(p, "uViewProj"), false, view);
    gl.uniform3fv(this.u(p, "uView"), this.toViewer);
    gl.uniform3fv(this.u(p, "uLight"), this.light);
    gl.uniform3fv(this.u(p, "uBallLight"), LIGHT);
    gl.uniform3fv(this.u(p, "uPaper"), this.color(PAPER));
    gl.uniform3fv(this.u(p, "uTint"), this.color(TINT));
    gl.uniform1f(this.u(p, "uShadowStr"), s.shadowStrength);
    gl.uniform1f(this.u(p, "uAoStr"), s.aoStrength);
    gl.uniform1f(this.u(p, "uAoRadius"), s.aoRadius);
    gl.uniform1f(this.u(p, "uFloorAo"), s.floorAo);
    gl.uniform1f(this.u(p, "uFloorZ"), floorZ);
    gl.uniform1f(this.u(p, "uDither"), this.dither ? 1 : 0);

    // Every object can occlude every other; each draw picks the ones in reach (setAo).
    const { occA, occB, occQ } = this;
    list.forEach((it, i) => {
      const q = it.q ?? Q0;
      occA.set(it.center, i * 4);
      occA[i * 4 + 3] = it.fade ?? 1;
      if (it.kind === "box") occB.set(it.half, i * 4);
      else occB.fill(it.r, i * 4, i * 4 + 3);
      occB[i * 4 + 3] = it.kind === "box" ? 0 : 1;
      occQ.set(q, i * 4);
    });
    gl.uniform4fv(this.u(p, "uOccA"), occA);
    gl.uniform4fv(this.u(p, "uOccB"), occB);
    gl.uniform4fv(this.u(p, "uOccQ"), occQ);

    const drawItem = (i: number) => {
      const it = list[i];
      gl.uniformMatrix4fv(this.u(p, "uModel"), false, this.models[i]);
      setRows(rowsForObject(i));
      setAo(aoForObject(i));
      gl.uniform1f(this.u(p, "uFade"), it.fade ?? 1);
      if (it.kind === "box") {
        gl.uniform1i(this.u(p, "uKind"), 0);
        gl.uniform3fv(this.u(p, "uPal"), this.palette(it.pal));
        gl.uniform3fv(this.u(p, "uPal2"), this.palette(it.pal2 ?? it.pal));
        gl.uniform1f(this.u(p, "uMix"), it.mix ?? 0);
        gl.uniform1f(this.u(p, "uGroundFade"), it.groundFade ?? 0);
        gl.uniform3f(this.u(p, "uSize"), it.half[0] * 2, it.half[1] * 2, it.half[2] * 2);
        gl.uniform3fv(this.u(p, "uEdgeAxes"), it.edges ?? [0, 0, 0]);
        gl.uniform1f(this.u(p, "uEdge"), s.edges && it.edges ? 1 : 0);
      } else {
        gl.uniform1i(this.u(p, "uKind"), 1);
        gl.uniform1f(this.u(p, "uEdge"), s.edges ? (it.edge ?? 0) : 0);
      }
      this.draw(it.kind === "box" ? this.box : this.ball);
    };
    const indices = list.map((_, i) => i);
    const solid = (i: number) => (list[i].fade ?? 1) >= 1;
    // Solid objects mark their pixels, so the floor can leave them alone.
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    indices.filter(solid).forEach(drawItem);

    // Floor last: it only darkens what's already behind the canvas (the paper
    // and GLIllustration's SVG grid). Near the objects it's drawn in TILE
    // tiles, each with its own shadow and AO rows; strips without AO cover the
    // rest of the canvas. Integer bounds keep the seams exact.
    // Only where no solid object was drawn: an object dipping below the floor
    // (a puzzle-cube slice turn) would otherwise take the floor's contact shadow.
    gl.stencilFunc(gl.EQUAL, 0, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1i(this.u(p, "uKind"), 2);
    gl.uniform1f(this.u(p, "uFade"), 1);
    gl.uniform1f(this.u(p, "uEdge"), 0);
    const m = this.scratch.fill(0);
    m[0] = m[5] = TILE;
    m[10] = m[15] = 1;
    m[14] = floorZ;
    const [x0, y0, x1, y1] = scene.floor ?? DEFAULT_FLOOR;
    for (let x = x0; x < x1; x += TILE)
      for (let y = y0; y < y1; y += TILE) {
        const tile: Rect = [x, y, x + TILE, y + TILE];
        m[12] = x;
        m[13] = y;
        gl.uniformMatrix4fv(this.u(p, "uModel"), false, m);
        setRows(rowsForRect(tile));
        setAo(aoForRect(tile));
        this.draw(this.quad);
      }
    setAo([]);
    const strips: Rect[] = [
      [FLOOR_MIN, FLOOR_MIN, x0, FLOOR_MAX],
      [x1, FLOOR_MIN, FLOOR_MAX, FLOOR_MAX],
      [x0, FLOOR_MIN, x1, y0],
      [x0, y1, x1, FLOOR_MAX],
    ];
    for (const strip of strips) {
      const [a, b, c, d] = strip;
      m[0] = c - a;
      m[5] = d - b;
      m[12] = a;
      m[13] = b;
      gl.uniformMatrix4fv(this.u(p, "uModel"), false, m);
      setRows(rowsForRect(strip));
      this.draw(this.quad);
    }

    // Fading objects last, far to near, over everything behind them. Only
    // their near faces: the view flips y, so those wind clockwise (GL's back).
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    indices
      .filter((i) => !solid(i))
      .reverse()
      .forEach(drawItem);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  /** Frees GPU resources. The context itself stays, since a remount on the same canvas gets it back. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.lit);
    gl.deleteTexture(this.shadowTex);
    for (const m of [this.box, this.ball, this.quad]) {
      gl.deleteVertexArray(m.vao);
      for (const b of m.bufs) gl.deleteBuffer(b);
    }
  }
}
