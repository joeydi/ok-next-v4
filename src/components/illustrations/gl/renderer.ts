import { cross, dot, icosphere, LIGHT, norm, sub, type Vec } from "../icosphere";
import type { Palette } from "../primitives";
import { deg, identity, lookAt, mul, ortho, Q0, rotateX, rotateZ, scale, translate, trs, type Mat4, type Quat } from "./math";
import { DEPTH_FS, DEPTH_VS, LIT_FS, LIT_VS, MAX_OCC } from "./shaders";

// A tiny WebGL2 renderer for the hero illustrations. Scenes use the CSS
// version's coordinates: px on the 300×300 iso plane, y down, z up. The camera
// reproduces `.ok-illo-scene`'s transform exactly, so it's orthographic.

export type BoxItem = {
  kind: "box";
  center: Vec;
  half: Vec;
  q?: Quat;
  pal: Palette;
  /** Which faces (by local axis x, y, z) carry the 1px inset edge line. */
  edges?: Vec;
  /** 0 = paper, 1 = fully drawn. */
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
  /** Floor area that takes AO (multiples of 6); objects and their reach must stay inside. */
  floor?: Rect;
  frame(t: number): Item[];
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
  azimuth: 215,
  elevation: 65,
  shadowSoft: 10,
  shadowStrength: 0.35,
  aoStrength: 0.6,
  aoRadius: 125,
  floorAo: 0.35,
  edges: false,
};

const W = 620, H = 660;
const PAPER = "#F3EFE8";
const TINT = "#A39284";
const LIGHT_EXTENT = 450;
/** How far grounded boxes extend below the floor in the shadow pass (px). */
const SINK = 30;
/** The floor beyond the AO grid, out past every canvas edge. Multiples of CELL keep seams exact. */
const FLOOR_MIN = -1500, FLOOR_MAX = 1800;
const DEFAULT_FLOOR: Rect = [-150, -150, 450, 450];
/** Floor mesh spacing for per-vertex AO (px). */
const CELL = 6;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Interleaved position, normal, barycentric; indexed unless `idx` is omitted. */
type MeshData = { v: number[]; idx?: number[] };
type Mesh = { vao: WebGLVertexArrayObject; bufs: WebGLBuffer[]; count: number; type: number | null };

/** Unit cube, each face an n×n grid so per-vertex AO has somewhere to vary. */
function boxMesh(n = 10): MeshData {
  const v: number[] = [], idx: number[] = [];
  for (let a = 0; a < 3; a++)
    for (const s of [1, -1]) {
      const u = (a + 1) % 3, w = (a + 2) % 3;
      const base = v.length / 9;
      for (let i = 0; i <= n; i++)
        for (let j = 0; j <= n; j++) {
          const p: Vec = [0, 0, 0], nor: Vec = [0, 0, 0];
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

/** A mesh over `rect` in plane px, vertices CELL apart. */
function floorMesh([x0, y0, x1, y1]: Rect): MeshData {
  const nx = Math.round((x1 - x0) / CELL), ny = Math.round((y1 - y0) / CELL);
  const v: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) v.push(x0 + i * CELL, y0 + j * CELL, 0, 0, 0, 1, 1, 1, 1);
  const at = (i: number, j: number) => i * (ny + 1) + j;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  return { v, idx };
}

/** Unit quad, placed per strip of the floor outside the grid. */
function quadMesh(): MeshData {
  const corners: Vec[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
  return { v: corners.flatMap((c) => [...c, 0, 0, 1, 1, 1, 1]), idx: [0, 1, 2, 0, 2, 3] };
}

/** Maps canvas px (y down, z toward the viewer) to clip space. */
const CANVAS_TO_CLIP = mul(translate(-1, 1, 0), scale(2 / W, -2 / H, -1 / 1000));

/** Plane px → canvas px: exactly `.ok-illo-scene`'s transform (plus the scene's `pre`) about its centre (300, 400). */
export const planeToCanvas = (scene: SceneDef) =>
  mul(translate(300, 400, 0), ...(scene.pre ? [scene.pre] : []), rotateX(deg(58)), rotateZ(deg(-45)), translate(-150, -150, 0));

function startProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
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
  private floors = new Map<string, Mesh>();
  private shadowTex: WebGLTexture | null = null;
  private shadowSize = 0;
  private shadowFbo: WebGLFramebuffer;
  private colors = new Map<string, number[]>();
  private palettes = new WeakMap<Palette, Float32Array>();
  // Cached until the scene or light changes.
  private viewScene: SceneDef | null = null;
  private view = identity();
  private lightKey = "";
  private light: Vec = [0, 0, 1];
  private lightVP = identity();
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
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer });
    if (!gl) throw new Error("WebGL2 unavailable");
    const ext = gl.getExtension("KHR_parallel_shader_compile");
    const lit = startProgram(gl, LIT_VS, LIT_FS);
    const depth = startProgram(gl, DEPTH_VS, DEPTH_FS);
    if (ext)
      while (![lit, depth].every((p) => gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)))
        await new Promise((r) => setTimeout(r, 16));
    checkProgram(gl, lit);
    checkProgram(gl, depth);
    return new Renderer(canvas, gl, lit, depth, dither);
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    private gl: WebGL2RenderingContext,
    private lit: WebGLProgram,
    private depth: WebGLProgram,
    private dither: boolean,
  ) {
    this.box = this.mesh(boxMesh());
    this.ball = this.mesh(ballMesh());
    this.quad = this.mesh(quadMesh());
    this.shadowFbo = gl.createFramebuffer()!;
  }

  /** (Re)allocates the shadow map at `size`² texels. */
  private shadowMap(size: number) {
    if (size === this.shadowSize) return;
    const gl = this.gl;
    if (this.shadowTex) gl.deleteTexture(this.shadowTex);
    this.shadowSize = size;
    this.shadowTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    const key = `${p === this.lit ? "l" : "d"}:${name}`;
    if (!this.loc.has(key)) this.loc.set(key, this.gl.getUniformLocation(p, name));
    return this.loc.get(key)!;
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

  private floor(rect: Rect) {
    const key = rect.join();
    let m = this.floors.get(key);
    if (!m) this.floors.set(key, (m = this.mesh(floorMesh(rect))));
    return m;
  }

  /** Sets the drawing buffer size in device pixels. */
  resize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  render(scene: SceneDef, items: Item[], s: Settings) {
    const gl = this.gl;
    const floorZ = scene.floorZ ?? 0;
    if (scene !== this.viewScene) {
      this.viewScene = scene;
      this.view = mul(CANVAS_TO_CLIP, planeToCanvas(scene));
    }
    const lightKey = `${s.azimuth},${s.elevation}`;
    if (lightKey !== this.lightKey) {
      this.lightKey = lightKey;
      const az = deg(s.azimuth), el = deg(s.elevation);
      this.light = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
      const target: Vec = [150, 150, 100];
      const eye = target.map((x, i) => x + this.light[i] * 1000) as Vec;
      this.lightVP = mul(
        ortho(-LIGHT_EXTENT, LIGHT_EXTENT, -LIGHT_EXTENT, LIGHT_EXTENT, 400, 1600),
        lookAt(eye, target, Math.abs(this.light[2]) > 0.99 ? [0, 1, 0] : [0, 0, 1]),
      );
    }
    const { view, lightVP } = this;

    // Nearest first, so early depth testing skips shading hidden fragments.
    const depthOf = (it: Item) => view[2] * it.center[0] + view[6] * it.center[1] + view[10] * it.center[2];
    const list = items.slice(0, MAX_OCC).sort((a, b) => depthOf(a) - depthOf(b));
    list.forEach((it, i) => {
      const m = (this.models[i] ??= identity());
      if (it.kind === "box") trs(m, it.center, it.q ?? Q0, it.half[0] * 2, it.half[1] * 2, it.half[2] * 2, [-0.5, -0.5, -0.5]);
      else trs(m, it.center, it.q ?? Q0, it.r, it.r, it.r);
    });
    const meshOf = (it: Item) => (it.kind === "box" ? this.box : this.ball);
    // One texel per step of the 6×6 PCF grid, so the grid spans the penumbra.
    const size = Math.round(Math.min(2048, Math.max(128, (2 * LIGHT_EXTENT) / Math.max(s.shadowSoft / 3, 0.5))));
    this.shadowMap(size);

    // Shadow pass: back faces only, so lit faces never shadow themselves.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, size, size);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.depth);
    gl.uniformMatrix4fv(this.u(this.depth, "uLightVP"), false, lightVP);
    list.forEach((it, i) => {
      // Boxes standing on the floor reach a little below it here, so the floor at
      // their foot is clearly behind their back faces and doesn't leak light.
      let model = this.models[i];
      if (it.kind === "box" && !it.q && Math.abs(it.center[2] - it.half[2] - floorZ) < 1) {
        const top = it.center[2] + it.half[2], bottom = floorZ - SINK;
        model = trs(this.scratch, [it.center[0], it.center[1], (top + bottom) / 2], Q0, it.half[0] * 2, it.half[1] * 2, top - bottom, [-0.5, -0.5, -0.5]);
      }
      gl.uniformMatrix4fv(this.u(this.depth, "uModel"), false, model);
      gl.uniform1f(this.u(this.depth, "uFade"), it.fade ?? 1);
      this.draw(meshOf(it));
    });
    gl.disable(gl.CULL_FACE);

    // Main pass.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const p = this.lit;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(this.u(p, "uShadowMap"), 0);
    gl.uniformMatrix4fv(this.u(p, "uViewProj"), false, view);
    gl.uniformMatrix4fv(this.u(p, "uLightVP"), false, lightVP);
    gl.uniform3fv(this.u(p, "uLight"), this.light);
    gl.uniform3fv(this.u(p, "uBallLight"), LIGHT);
    gl.uniform3fv(this.u(p, "uPaper"), this.color(PAPER));
    gl.uniform3fv(this.u(p, "uTint"), this.color(TINT));
    gl.uniform1f(this.u(p, "uTexel"), 1 / size);
    gl.uniform1f(this.u(p, "uShadowStr"), s.shadowStrength);
    gl.uniform1f(this.u(p, "uAoStr"), s.aoStrength);
    gl.uniform1f(this.u(p, "uAoRadius"), s.aoRadius);
    gl.uniform1f(this.u(p, "uFloorAo"), s.floorAo);
    gl.uniform1f(this.u(p, "uFloorZ"), floorZ);
    gl.uniform1f(this.u(p, "uDither"), this.dither ? 1 : 0);

    // Every object occludes every other; each draw skips itself (uSelf).
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
    gl.uniform1i(this.u(p, "uOccN"), list.length);
    gl.uniform4fv(this.u(p, "uOccA"), occA);
    gl.uniform4fv(this.u(p, "uOccB"), occB);
    gl.uniform4fv(this.u(p, "uOccQ"), occQ);

    list.forEach((it, i) => {
      gl.uniformMatrix4fv(this.u(p, "uModel"), false, this.models[i]);
      gl.uniform1i(this.u(p, "uSelf"), i);
      gl.uniform1f(this.u(p, "uFade"), it.fade ?? 1);
      if (it.kind === "box") {
        gl.uniform1i(this.u(p, "uKind"), 0);
        gl.uniform3fv(this.u(p, "uPal"), this.palette(it.pal));
        gl.uniform3f(this.u(p, "uSize"), it.half[0] * 2, it.half[1] * 2, it.half[2] * 2);
        gl.uniform3fv(this.u(p, "uEdgeAxes"), it.edges ?? [0, 0, 0]);
        gl.uniform1f(this.u(p, "uEdge"), s.edges && it.edges ? 1 : 0);
      } else {
        gl.uniform1i(this.u(p, "uKind"), 1);
        gl.uniform1f(this.u(p, "uEdge"), s.edges ? (it.edge ?? 0) : 0);
      }
      this.draw(meshOf(it));
    });

    // Floor last: it only darkens what's already behind the canvas (the paper
    // and GLIllustration's SVG grid). A mesh near the objects takes AO; plain
    // strips cover the rest of the canvas.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1i(this.u(p, "uKind"), 2);
    gl.uniform1i(this.u(p, "uSelf"), -1);
    gl.uniform1f(this.u(p, "uFade"), 1);
    gl.uniform1f(this.u(p, "uEdge"), 0);
    const rect = scene.floor ?? DEFAULT_FLOOR;
    const m = this.scratch.fill(0);
    m[0] = m[5] = m[10] = m[15] = 1;
    m[14] = floorZ;
    gl.uniformMatrix4fv(this.u(p, "uModel"), false, m);
    this.draw(this.floor(rect));
    gl.uniform1i(this.u(p, "uOccN"), 0);
    const [x0, y0, x1, y1] = rect;
    const strips: Rect[] = [
      [FLOOR_MIN, FLOOR_MIN, x0, FLOOR_MAX],
      [x1, FLOOR_MIN, FLOOR_MAX, FLOOR_MAX],
      [x0, FLOOR_MIN, x1, y0],
      [x0, y1, x1, FLOOR_MAX],
    ];
    for (const [a, b, c, d] of strips) {
      m[0] = c - a;
      m[5] = d - b;
      m[12] = a;
      m[13] = b;
      gl.uniformMatrix4fv(this.u(p, "uModel"), false, m);
      this.draw(this.quad);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  /** Frees GPU resources. The context itself stays, since a remount on the same canvas gets it back. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.lit);
    gl.deleteProgram(this.depth);
    gl.deleteTexture(this.shadowTex);
    gl.deleteFramebuffer(this.shadowFbo);
    for (const m of [this.box, this.ball, this.quad, ...this.floors.values()]) {
      gl.deleteVertexArray(m.vao);
      m.bufs.forEach((b) => gl.deleteBuffer(b));
    }
  }
}
