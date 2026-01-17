/**
 * Common GLSL utilities for video scope shaders
 * SCOPE-001, SCOPE-002, SCOPE-003
 */

// Vertex shader for scope displays (full-screen quad)
export const SCOPE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`

// Common header with uniforms for all scope shaders
export const SCOPE_HEADER = `
precision highp float;

uniform sampler2D u_sourceTexture;
uniform vec2 u_resolution;
uniform vec2 u_textureSize;
uniform float u_intensity;     // Scope brightness (0.5 - 3.0)
uniform float u_time;

varying vec2 v_texCoord;
`

// Color space conversion utilities for scopes
export const SCOPE_COLOR_UTILS = `
// RGB to YUV (Rec. 601 for standard scopes)
vec3 rgbToYuv(vec3 rgb) {
  float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  float u = 0.492 * (rgb.b - y);  // Cb, range -0.436 to 0.436
  float v = 0.877 * (rgb.r - y);  // Cr, range -0.615 to 0.615
  return vec3(y, u, v);
}

// RGB to YPbPr (component video)
vec3 rgbToYpbpr(vec3 rgb) {
  float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  float pb = 0.5 * (rgb.b - y) / (1.0 - 0.114);
  float pr = 0.5 * (rgb.r - y) / (1.0 - 0.299);
  return vec3(y, pb, pr);
}

// Luminance (Rec. 709)
float luminance(vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

// IRE scale conversion (0-100 IRE for video levels)
// In digital (0-255), black is typically at 16 and white at 235
float toIRE(float level) {
  return level * 100.0;
}

float fromIRE(float ire) {
  return ire / 100.0;
}
`

// Graticule drawing utilities
export const GRATICULE_UTILS = `
// Draw horizontal graticule line
float graticuleHLine(vec2 uv, float y, float thickness) {
  return smoothstep(thickness, 0.0, abs(uv.y - y));
}

// Draw vertical graticule line
float graticuleVLine(vec2 uv, float x, float thickness) {
  return smoothstep(thickness, 0.0, abs(uv.x - x));
}

// Draw circle graticule
float graticuleCircle(vec2 uv, vec2 center, float radius, float thickness) {
  float dist = length(uv - center);
  return smoothstep(thickness, 0.0, abs(dist - radius));
}

// Draw line from point A to B
float graticuleLine(vec2 uv, vec2 a, vec2 b, float thickness) {
  vec2 ab = b - a;
  vec2 ap = uv - a;
  float t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
  vec2 closest = a + t * ab;
  return smoothstep(thickness, 0.0, length(uv - closest));
}
`

// Scope display common utilities
export const SCOPE_DISPLAY_UTILS = `
// Smooth point accumulation for scope display
float scopePoint(vec2 uv, vec2 point, float size) {
  float dist = length(uv - point);
  return smoothstep(size, 0.0, dist);
}

// Additive scope accumulation with glow effect
vec3 scopeAccumulate(vec3 current, vec3 add, float intensity) {
  return current + add * intensity;
}

// Apply scope intensity and clamp
vec3 scopeOutput(vec3 accumulated, float intensity) {
  return clamp(accumulated * intensity, 0.0, 1.0);
}
`

// Combined common utilities
export const SCOPE_COMMON = `
${SCOPE_HEADER}
${SCOPE_COLOR_UTILS}
${GRATICULE_UTILS}
${SCOPE_DISPLAY_UTILS}
`
