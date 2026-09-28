// GLSL for the illustration renderer. Three kinds of surface share one program:
//   0 box   — flat design palette picked by normal (top / side1 / side2) + inset edge line
//   1 ball  — the pink ramp from icosphere.ts shaded per facet + optional facet edges
//   2 floor — transparent shadow catcher (the grid is SVG, under the canvas)
// All three take a soft shadow (shadow map + PCF, per pixel) and analytic
// ambient occlusion from the other objects (boxes and spheres, ≤ MAX_OCC).
// AO is smooth, so it's evaluated per vertex on subdivided meshes and
// interpolated — exact polygon occlusion per pixel costs ~100× more.

export const MAX_OCC = 32;

const common = /* glsl */ `
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

export const DEPTH_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uModel;
uniform mat4 uLightVP;
void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }
`;

// Fading objects cast a dithered shadow that the PCF blur averages out.
export const DEPTH_FS = /* glsl */ `#version 300 es
precision highp float;
uniform float uFade;
out vec4 o;
${common}
void main() {
  if (ign(gl_FragCoord.xy) >= uFade) discard;
  o = vec4(0.0);
}
`;

export const LIT_VS = /* glsl */ `#version 300 es
#define MAX_OCC ${MAX_OCC}
#define TAU 6.2831853

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in vec3 aBar;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform float uAoRadius;

// Every object in the frame; a draw skips its own (uSelf).
uniform int uOccN;
uniform int uSelf;
uniform vec4 uOccA[MAX_OCC]; // centre xyz, strength
uniform vec4 uOccB[MAX_OCC]; // half-size xyz (sphere: radius in x), kind (0 box, 1 sphere)
uniform vec4 uOccQ[MAX_OCC]; // orientation quaternion

out vec3 vWorld;
out vec3 vNor;
out vec3 vLocal;
out vec3 vObjN;
out vec3 vBar;
out float vOcc;

vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

// Directions below the receiver's horizon are pulled up onto it (cheap clipping).
vec3 horizon(vec3 v, vec3 n) {
  float d = dot(v, n);
  return d < 0.0 ? normalize(v - n * (d - 1e-4)) : v;
}

// θ/sinθ · (a × b) for unit vectors a, b: the edge integral from Heitz et al.'s
// LTC area lights (fitted by Hill), which avoids acos.
vec3 edgeVec(vec3 a, vec3 b) {
  float x = dot(a, b);
  float y = abs(x);
  float v = (0.8543985 + (0.4965155 + 0.0145206 * y) * y) / (3.4175940 + (4.1616724 + y) * y);
  float k = x > 0.0 ? v : 0.5 * inversesqrt(max(1.0 - x * x, 1e-7)) - v;
  return cross(a, b) * k;
}

// Cosine-weighted solid angle of a quad seen from p (Lambert's polygon formula).
float quadOcc(vec3 p, vec3 n, vec3 a, vec3 b, vec3 c, vec3 d) {
  a -= p; b -= p; c -= p; d -= p;
  // Wholly below the horizon: nothing to see.
  if (max(max(dot(a, n), dot(b, n)), max(dot(c, n), dot(d, n))) <= 0.0) return 0.0;
  a = horizon(normalize(a), n);
  b = horizon(normalize(b), n);
  c = horizon(normalize(c), n);
  d = horizon(normalize(d), n);
  return abs(dot(n, edgeVec(a, b) + edgeVec(b, c) + edgeVec(c, d) + edgeVec(d, a))) / TAU;
}

// Occlusion of a box centred at the origin: its (up to three) faces turned toward p.
float boxOcc(vec3 p, vec3 n, vec3 h) {
  // A point on or under the box (floor beneath a pillar) takes the value at the
  // foot of a wall, so interpolating toward it neither lightens nor overshoots
  // the contact.
  if (all(lessThan(abs(p), h + 0.5))) return 0.5;
  vec3 f = sign(p) * h;
  vec3 on = step(h, abs(p));
  return on.x * quadOcc(p, n, vec3(f.x, -h.y, -h.z), vec3(f.x, h.y, -h.z), vec3(f.x, h.y, h.z), vec3(f.x, -h.y, h.z))
       + on.y * quadOcc(p, n, vec3(-h.x, f.y, -h.z), vec3(h.x, f.y, -h.z), vec3(h.x, f.y, h.z), vec3(-h.x, f.y, h.z))
       + on.z * quadOcc(p, n, vec3(-h.x, -h.y, f.z), vec3(h.x, -h.y, f.z), vec3(h.x, h.y, f.z), vec3(-h.x, h.y, f.z));
}

// Sphere occlusion (Quilez, iquilezles.org/articles/sphereao).
float sphOcc(vec3 p, vec3 n, vec3 c, float r) {
  vec3 di = c - p;
  float l = length(di);
  float nl = dot(n, di / l);
  float h = l / r;
  float h2 = h * h;
  float k2 = 1.0 - h2 * nl * nl;
  float res = max(0.0, nl) / h2;
  if (k2 > 0.0) {
    res = max(0.0, nl * h + 1.0) / h2;
    res = 0.33 * res * res;
  }
  return res;
}

float occlusion(vec3 p, vec3 n) {
  float o = 0.0;
  for (int i = 0; i < MAX_OCC; i++) {
    if (i >= uOccN) break;
    if (i == uSelf) continue;
    vec4 a = uOccA[i], b = uOccB[i];
    float dist, occ;
    if (b.w < 0.5) {
      vec4 q = uOccQ[i] * vec4(-1.0, -1.0, -1.0, 1.0);
      vec3 lp = qrot(q, p - a.xyz);
      dist = length(max(abs(lp) - b.xyz, 0.0));
      occ = boxOcc(lp, qrot(q, n), b.xyz);
    } else {
      dist = max(length(p - a.xyz) - b.x, 0.0);
      occ = sphOcc(p, n, a.xyz, b.x);
    }
    o += a.w * occ * (1.0 - smoothstep(0.0, uAoRadius, dist));
  }
  return o;
}

void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNor = transpose(inverse(mat3(uModel))) * aNor;
  vLocal = aPos;
  vObjN = aNor;
  vBar = aBar;
  vOcc = uOccN > 0 ? occlusion(w.xyz, normalize(vNor)) : 0.0;
  gl_Position = uViewProj * w;
}
`;

export const LIT_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DShadow;

in vec3 vWorld;
in vec3 vNor;
in vec3 vLocal;
in vec3 vObjN;
in vec3 vBar;
in float vOcc;

uniform int uKind;
uniform vec3 uPal[3];
uniform vec3 uSize;
uniform vec3 uEdgeAxes;
uniform float uEdge;
uniform float uFade;

uniform vec3 uPaper;
uniform vec3 uTint;
uniform vec3 uLight;
uniform vec3 uBallLight;
uniform mat4 uLightVP;
uniform sampler2DShadow uShadowMap;
uniform float uTexel;
uniform float uShadowStr;
uniform float uAoStr;
uniform float uAoRadius;
uniform float uFloorAo;
uniform float uFloorZ;
uniform float uDither;

out vec4 frag;

${common}

// Soft shadow: a 6×6 grid of hardware-PCF taps one shadow texel apart, tent
// weighted. The shadow map is sized so the grid spans the penumbra, which
// gives a smooth ramp with no noise.
float shadow(vec3 p, vec3 n) {
  vec4 lp = uLightVP * vec4(p + n * 1.5, 1.0);
  vec3 s = lp.xyz * 0.5 + 0.5;
  if (any(lessThan(s, vec3(0.0))) || any(greaterThan(s, vec3(1.0)))) return 1.0;
  float z = s.z - 0.002;
  // Corners first: fully lit or fully shadowed pixels stop there.
  float c = texture(uShadowMap, vec3(s.xy + vec2(-2.5, -2.5) * uTexel, z))
          + texture(uShadowMap, vec3(s.xy + vec2(2.5, -2.5) * uTexel, z))
          + texture(uShadowMap, vec3(s.xy + vec2(-2.5, 2.5) * uTexel, z))
          + texture(uShadowMap, vec3(s.xy + vec2(2.5, 2.5) * uTexel, z));
  if (c == 0.0 || c == 4.0) return c / 4.0;
  float sum = 0.0, wsum = 0.0;
  for (int j = 0; j < 6; j++)
    for (int i = 0; i < 6; i++) {
      vec2 o = vec2(float(i), float(j)) - 2.5;
      float w = (3.5 - abs(o.x)) * (3.5 - abs(o.y));
      sum += w * texture(uShadowMap, vec3(s.xy + o * uTexel, z));
      wsum += w;
    }
  return sum / wsum;
}

vec3 ramp(float k) {
  vec3 c0 = vec3(168.0, 23.0, 58.0) / 255.0;
  vec3 c1 = vec3(255.0, 77.0, 106.0) / 255.0;
  vec3 c2 = vec3(255.0, 170.0, 184.0) / 255.0;
  return k < 0.6 ? mix(c0, c1, k / 0.6) : mix(c1, c2, (k - 0.6) / 0.4);
}

void main() {
  vec3 n = normalize(vNor);

  // Surfaces turned from the light keep their designed shade; lit ones take cast shadows.
  float facing = smoothstep(0.0, 0.2, dot(n, uLight));
  float shade = facing > 0.0 ? (1.0 - mix(1.0, shadow(vWorld, n), facing)) * uShadowStr : 0.0;
  float occ = vOcc;
  if (uKind != 2) {
    float above = max(vWorld.z - uFloorZ, 0.0);
    occ += uFloorAo * 0.5 * (1.0 - n.z) * (1.0 - smoothstep(0.0, uAoRadius, above));
  }
  float dark = clamp(shade + occ * uAoStr, 0.0, 1.0);
  vec3 col;

  if (uKind == 0) {
    // The design's flat shading: weights blend smoothly as a box turns.
    vec3 w = n * n;
    col = w.z * uPal[0] + w.y * uPal[1] + w.x * uPal[2];
    if (uEdge > 0.0) {
      vec3 an = abs(vObjN);
      vec2 uv, sz;
      if (an.z > 0.5) { uv = vLocal.xy; sz = uSize.xy; }
      else if (an.y > 0.5) { uv = vLocal.xz; sz = uSize.xz; }
      else { uv = vLocal.yz; sz = uSize.yz; }
      vec2 px = uv * sz;
      float d = min(min(px.x, sz.x - px.x), min(px.y, sz.y - px.y));
      float aa = max(fwidth(d), 1e-4);
      float e = dot(an, uEdgeAxes) * clamp((uEdge - d) / aa + 0.5, 0.0, 1.0);
      col = mix(col, uPal[2], e);
    }
    col *= mix(vec3(1.0), uTint, dark);
  } else if (uKind == 1) {
    // Darken along the pink ramp so shadowed facets stay pink rather than going grey.
    col = ramp((0.25 + 0.75 * max(0.0, dot(n, uBallLight))) * (1.0 - 0.4 * dark));
    if (uEdge > 0.0) {
      float m = min(vBar.x, min(vBar.y, vBar.z));
      float aa = max(fwidth(m), 1e-4);
      col *= mix(vec3(1.0), vec3(1.0, 0.6, 0.68), clamp((uEdge - m) / aa + 0.5, 0.0, 1.0));
    }
  } else {
    col = uPaper * mix(vec3(1.0), uTint, dark);
  }

  // A fraction of an 8-bit step of noise breaks up banding in the soft gradients.
  col += uDither * (ign(gl_FragCoord.xy + 0.5) - 0.5) / 255.0;

  if (uKind == 2) {
    // Premultiplied colour that reproduces col when composited over the paper.
    vec3 k = 1.0 - col / uPaper;
    float a = clamp(max(k.x, max(k.y, k.z)), 0.0, 1.0);
    frag = vec4(col - uPaper * (1.0 - a), a);
  } else {
    frag = vec4(mix(uPaper, col, uFade), 1.0);
  }
}
`;
