import { MAX_INSTANCES, STRIDE } from "./simulation";

// Every line and node is one instanced quad around a segment (a node's has zero
// length), shaded by distance to that segment: a capsule, antialiased over a
// device pixel. Lines and nodes go in one draw call.

const VS = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 segment;
layout(location = 2) in vec2 style;

uniform vec2 size;
uniform float dpr;

out vec2 p;
flat out vec2 a;
flat out vec2 b;
flat out float radius;
flat out float alpha;

void main() {
  a = segment.xy * dpr;
  b = segment.zw * dpr;
  radius = style.x * dpr;
  alpha = style.y;

  vec2 d = b - a;
  float len = length(d);
  vec2 along = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  float pad = radius + 1.0;

  p = (a + b) * 0.5 + along * corner.x * (len * 0.5 + pad) + across * corner.y * pad;
  gl_Position = vec4(p / size * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;

uniform vec3 color;

in vec2 p;
flat in vec2 a;
flat in vec2 b;
flat in float radius;
flat in float alpha;

out vec4 outColor;

void main() {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float coverage = clamp(radius + 0.5 - length(pa - ba * h), 0.0, 1.0) * alpha;
  outColor = vec4(color * coverage, coverage);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "");
  return shader;
}

export class NetworkRenderer {
  data = new Float32Array(MAX_INSTANCES * STRIDE);
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private corners: WebGLBuffer;
  private instances: WebGLBuffer;
  private size: WebGLUniformLocation | null;
  private dpr: WebGLUniformLocation | null;

  constructor(
    private gl: WebGL2RenderingContext,
    color: [number, number, number],
  ) {
    const program = gl.createProgram();
    const shaders = [compile(gl, gl.VERTEX_SHADER, VS), compile(gl, gl.FRAGMENT_SHADER, FS)];
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "");
    this.program = program;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const instances = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, STRIDE * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE * 4, 16);
    gl.vertexAttribDivisor(2, 1);

    this.corners = corners;
    this.instances = instances;

    gl.useProgram(program);
    gl.uniform3fv(gl.getUniformLocation(program, "color"), color);
    this.size = gl.getUniformLocation(program, "size");
    this.dpr = gl.getUniformLocation(program, "dpr");

    // Premultiplied output over a transparent canvas.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Call after sizing the canvas's drawing buffer. */
  resize(dpr: number) {
    const { gl } = this;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(this.size, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(this.dpr, dpr);
  }

  /** Draws the first `count` instances of `data`. */
  draw(count: number) {
    const { gl } = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, count * STRIDE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
  }

  destroy() {
    const { gl } = this;
    gl.deleteBuffer(this.corners);
    gl.deleteBuffer(this.instances);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}
