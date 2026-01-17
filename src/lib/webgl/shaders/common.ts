/**
 * Common GLSL shader utilities
 * These are prepended to all shader programs
 */

export const SHADER_PRECISION = `
precision mediump float;
`

export const SHADER_UNIFORMS = `
uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform float u_progress;
uniform float u_intensity;
uniform vec2 u_resolution;
uniform float u_time;
varying vec2 v_texCoord;
`

// Noise functions
export const SHADER_NOISE = `
// Simple pseudo-random hash
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// 2D noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

// Simplex-like 2D noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Voronoi/Cellular noise
vec2 voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash(n + g) * vec2(1.0);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mg = g;
      }
    }
  }
  return vec2(md, hash(n + mg));
}
`

// Easing functions
export const SHADER_EASING = `
// Linear
float easeLinear(float t) { return t; }

// Quadratic
float easeInQuad(float t) { return t * t; }
float easeOutQuad(float t) { return t * (2.0 - t); }
float easeInOutQuad(float t) {
  return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
}

// Cubic
float easeInCubic(float t) { return t * t * t; }
float easeOutCubic(float t) { float t1 = t - 1.0; return t1 * t1 * t1 + 1.0; }
float easeInOutCubic(float t) {
  return t < 0.5 ? 4.0 * t * t * t : (t - 1.0) * (2.0 * t - 2.0) * (2.0 * t - 2.0) + 1.0;
}

// Quartic
float easeInQuart(float t) { return t * t * t * t; }
float easeOutQuart(float t) { float t1 = t - 1.0; return 1.0 - t1 * t1 * t1 * t1; }

// Exponential
float easeInExpo(float t) { return t == 0.0 ? 0.0 : pow(2.0, 10.0 * (t - 1.0)); }
float easeOutExpo(float t) { return t == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t); }

// Sine
float easeInSine(float t) { return 1.0 - cos(t * 3.14159265 / 2.0); }
float easeOutSine(float t) { return sin(t * 3.14159265 / 2.0); }
float easeInOutSine(float t) { return 0.5 * (1.0 - cos(3.14159265 * t)); }

// Elastic
float easeOutElastic(float t) {
  float p = 0.3;
  return pow(2.0, -10.0 * t) * sin((t - p / 4.0) * (2.0 * 3.14159265) / p) + 1.0;
}

// Bounce
float easeOutBounce(float t) {
  float n1 = 7.5625;
  float d1 = 2.75;
  if (t < 1.0 / d1) {
    return n1 * t * t;
  } else if (t < 2.0 / d1) {
    t -= 1.5 / d1;
    return n1 * t * t + 0.75;
  } else if (t < 2.5 / d1) {
    t -= 2.25 / d1;
    return n1 * t * t + 0.9375;
  } else {
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  }
}
`

// Color utilities
export const SHADER_COLOR = `
// Convert RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Luminance
float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// Gamma correction
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toGamma(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }
`

// Geometric utilities
export const SHADER_GEOMETRY = `
// Rotate 2D point
vec2 rotate2D(vec2 p, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Scale from center
vec2 scaleFromCenter(vec2 uv, float scale) {
  return (uv - 0.5) * scale + 0.5;
}

// Distance functions
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Polar coordinates
vec2 toPolar(vec2 uv) {
  vec2 centered = uv - 0.5;
  float r = length(centered);
  float theta = atan(centered.y, centered.x);
  return vec2(r, theta);
}

vec2 fromPolar(vec2 polar) {
  return vec2(cos(polar.y), sin(polar.y)) * polar.x + 0.5;
}
`

// Blend modes
export const SHADER_BLEND = `
// Blend modes
vec3 blendMultiply(vec3 a, vec3 b) { return a * b; }
vec3 blendScreen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
vec3 blendOverlay(vec3 a, vec3 b) {
  return mix(
    2.0 * a * b,
    1.0 - 2.0 * (1.0 - a) * (1.0 - b),
    step(0.5, a)
  );
}
vec3 blendSoftLight(vec3 a, vec3 b) {
  return mix(
    2.0 * a * b + a * a * (1.0 - 2.0 * b),
    sqrt(a) * (2.0 * b - 1.0) + 2.0 * a * (1.0 - b),
    step(0.5, b)
  );
}
vec3 blendHardLight(vec3 a, vec3 b) { return blendOverlay(b, a); }
vec3 blendDifference(vec3 a, vec3 b) { return abs(a - b); }
vec3 blendExclusion(vec3 a, vec3 b) { return a + b - 2.0 * a * b; }
vec3 blendAdd(vec3 a, vec3 b) { return min(a + b, 1.0); }
vec3 blendSubtract(vec3 a, vec3 b) { return max(a - b, 0.0); }
`

// Combine all common code
export const SHADER_COMMON = `
${SHADER_PRECISION}
${SHADER_UNIFORMS}
${SHADER_NOISE}
${SHADER_EASING}
${SHADER_COLOR}
${SHADER_GEOMETRY}
${SHADER_BLEND}
`

// Shader interface
export interface TransitionShader {
  name: string
  label: string
  fragment: string
  uniforms?: Record<string, number | number[]>
}
