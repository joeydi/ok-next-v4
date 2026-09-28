// GLSL for the illustration renderer. Three kinds of surface share one program:
//   0 box   — flat design palette picked by normal (top / side1 / side2) + inset edge line
//   1 ball  — the pink ramp from icosphere.ts shaded per facet + optional facet edges
//   2 floor — transparent shadow catcher (the grid is SVG, under the canvas)
// All three take ambient occlusion and a soft shadow from the other objects
// (boxes and spheres, ≤ MAX_OCC), both analytic and per pixel, so nothing is
// sampled on a grid that moving objects could step across (per-vertex AO
// flickered where a box's contact edge slid over the floor's vertices). AO
// is against each object's faces; shadows against its outline as the light
// sees it. Each draw only loops over the objects the CPU found in reach.

export const MAX_OCC = 32;

const common = /* glsl */ `
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
`;

export const LIT_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
layout(location = 2) in vec3 aBar;
uniform mat4 uModel;
uniform mat4 uViewProj;

out vec3 vWorld;
out vec3 vNor;
out vec3 vLocal;
out vec3 vObjN;
out vec3 vBar;

void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNor = transpose(inverse(mat3(uModel))) * aNor;
  vLocal = aPos;
  vObjN = aNor;
  vBar = aBar;
  gl_Position = uViewProj * w;
}
`;

const occlusion = /* glsl */ `
#define TAU 6.2831853

// Every object in the frame; the rows that can occlude this draw (never its own) are chosen on the CPU.
uniform vec4 uOccA[MAX_OCC]; // centre xyz, strength
uniform vec4 uOccB[MAX_OCC]; // half-size xyz (sphere: radius in x), kind (0 box, 1 sphere)
uniform vec4 uOccQ[MAX_OCC]; // orientation quaternion
uniform int uAoIdx[MAX_OCC];
uniform int uAoN;
uniform float uAoRadius;

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
  // A point on or under the box (floor beneath a fading pillar) takes the value at the foot of a wall.
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
  for (int k = 0; k < MAX_OCC; k++) {
    if (k >= uAoN) break;
    int i = uAoIdx[k];
    vec4 a = uOccA[i], b = uOccB[i];
    if (b.w < 0.5) {
      vec4 q = uOccQ[i] * vec4(-1.0, -1.0, -1.0, 1.0);
      vec3 lp = qrot(q, p - a.xyz);
      float dist = length(max(abs(lp) - b.xyz, 0.0));
      if (dist >= uAoRadius) continue;
      o += a.w * boxOcc(lp, qrot(q, n), b.xyz) * (1.0 - smoothstep(0.0, uAoRadius, dist));
    } else {
      float dist = max(length(p - a.xyz) - b.x, 0.0);
      if (dist >= uAoRadius) continue;
      o += a.w * sphOcc(p, n, a.xyz, b.x) * (1.0 - smoothstep(0.0, uAoRadius, dist));
    }
  }
  return o;
}
`;

export const LIT_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

#define MAX_OCC ${MAX_OCC}

in vec3 vWorld;
in vec3 vNor;
in vec3 vLocal;
in vec3 vObjN;
in vec3 vBar;

uniform int uKind;
uniform vec3 uPal[3];
uniform vec3 uPal2[3];
uniform float uMix;
uniform float uGroundFade;
uniform vec3 uSize;
uniform vec3 uEdgeAxes;
uniform float uEdge;
uniform float uFade;

uniform vec3 uPaper;
uniform vec3 uTint;
uniform vec3 uLight;
uniform vec3 uBallLight;
uniform float uShadowStr;
uniform float uShadowSoft;
// The plane the light sees along uLight: shadow outlines live in it.
uniform vec3 uLightU;
uniform vec3 uLightV;
// Per object, one row (see Renderer.shadowRows): shape, light-ward test, outline.
uniform sampler2D uShadowData;
// The rows that can shade this draw (chosen on the CPU).
uniform int uShadowIdx[MAX_OCC];
uniform int uShadowN;
uniform float uAoStr;
uniform float uFloorAo;
uniform float uFloorZ;
uniform float uDither;

out vec4 frag;

${common}
${occlusion}

// Soft shadow: for each other object the light-ward ray from p passes near,
// the distance from that ray to the object's outline (in the light's plane)
// sets how much of it is in shadow, over a penumbra ±uShadowSoft wide.
float shadow(vec3 p) {
  vec2 q = vec2(dot(p, uLightU), dot(p, uLightV));
  float vis = 1.0;
  for (int k = 0; k < MAX_OCC; k++) {
    if (k >= uShadowN || vis <= 0.0) break;
    int i = uShadowIdx[k];
    // Cheap rejects first: outline nowhere near p, or the object behind p.
    vec4 bound = texelFetch(uShadowData, ivec2(4, i), 0);
    if (length(q - bound.xy) > bound.z + uShadowSoft) continue;
    vec4 c = texelFetch(uShadowData, ivec2(0, i), 0);
    if (dot(c.xyz - p, uLight) < -bound.w) continue;
    vec4 e = texelFetch(uShadowData, ivec2(1, i), 0);
    float d;
    if (c.w > 0.5) {
      // Sphere: skip it if it's wholly on the far side of p from the light.
      vec3 oc = c.xyz - p;
      if (dot(oc, uLight) < -e.x) continue;
      d = length(cross(oc, uLight)) - e.x;
    } else {
      // Box: the ray has to pass through it grown by the penumbra, toward the light.
      vec3 lp = qrot(texelFetch(uShadowData, ivec2(2, i), 0), p - c.xyz);
      vec3 inv = texelFetch(uShadowData, ivec2(3, i), 0).xyz;
      vec3 t0 = (-e.xyz - lp) * inv, t1 = (e.xyz - lp) * inv;
      vec3 lo = min(t0, t1), hi = max(t0, t1);
      if (max(max(lo.x, lo.y), lo.z) > min(min(hi.x, hi.y), hi.z) || min(min(hi.x, hi.y), hi.z) <= 0.0) continue;
      // Signed distance to the outline: the furthest of its (up to 8) edge lines.
      d = -1e9;
      for (int k = 5; k < 13; k++) {
        vec4 l = texelFetch(uShadowData, ivec2(k, i), 0);
        d = max(d, dot(l.xy, q) - l.z);
      }
    }
    vis = min(vis, mix(1.0, smoothstep(-uShadowSoft, uShadowSoft, d), e.w));
  }
  return vis;
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
  float shade = facing > 0.0 ? (1.0 - mix(1.0, shadow(vWorld), facing)) * uShadowStr : 0.0;
  float occ = uAoN > 0 ? occlusion(vWorld, n) : 0.0;
  if (uKind != 2) {
    float above = max(vWorld.z - uFloorZ, 0.0);
    occ += uFloorAo * 0.5 * (1.0 - n.z) * (1.0 - smoothstep(0.0, uAoRadius, above));
  }
  float dark = clamp(shade + occ * uAoStr, 0.0, 1.0);
  vec3 col;

  if (uKind == 0) {
    // The design's flat shading: weights blend smoothly as a box turns. uPal2
    // is a second palette to blend toward (a flash), by uMix.
    vec3 w = n * n;
    col = mix(w.z * uPal[0] + w.y * uPal[1] + w.x * uPal[2], w.z * uPal2[0] + w.y * uPal2[1] + w.x * uPal2[2], uMix);
    vec3 edgeCol = mix(uPal[2], uPal2[2], uMix);
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
      col = mix(col, edgeCol, e);
    }
    // Walls that rise out of the paper: paper at the foot, the wall colour by uGroundFade of the height.
    if (uGroundFade > 0.0) col = mix(col, uPaper, (1.0 - abs(vObjN.z)) * (1.0 - clamp(vLocal.z / uGroundFade, 0.0, 1.0)));
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
    // Fading objects are translucent (premultiplied), so the grid and floor show through.
    frag = vec4(col * uFade, uFade);
  }
}
`;
