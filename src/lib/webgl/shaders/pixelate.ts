/**
 * Pixelate transition shaders
 * 8 variants: block, dither, mosaic, retro, 8bit, halftone, dots, crosshatch
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const PIXELATE_SHADERS: Record<string, TransitionShader> = {
  block: {
    name: 'block',
    label: 'Block',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Pixelation increases then decreases
  float pixelSize = 1.0 + intensity * 50.0;
  vec2 pixelUV = floor(v_texCoord * pixelSize) / pixelSize;

  vec4 colorA = texture2D(u_textureA, pixelUV);
  vec4 colorB = texture2D(u_textureB, pixelUV);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  dither: {
    name: 'dither',
    label: 'Dither',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec4 base = mix(colorA, colorB, u_progress);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Bayer dither pattern
  vec2 pixel = floor(v_texCoord * u_resolution);
  float bayer = mod(pixel.x + pixel.y * 2.0, 4.0) / 4.0;

  // Reduce color depth with dithering
  float levels = 4.0 + (1.0 - intensity) * 252.0;
  vec3 dithered = floor(base.rgb * levels + bayer * intensity) / levels;

  gl_FragColor = vec4(dithered, 1.0);
}`
  },

  mosaic: {
    name: 'mosaic',
    label: 'Mosaic',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Hexagonal-ish mosaic
  float size = 10.0 + intensity * 40.0;
  vec2 hex = v_texCoord * size;

  // Offset every other row
  float row = floor(hex.y);
  if (mod(row, 2.0) > 0.5) {
    hex.x += 0.5;
  }

  vec2 mosaicUV = (floor(hex) + 0.5) / size;

  vec4 colorA = texture2D(u_textureA, mosaicUV);
  vec4 colorB = texture2D(u_textureB, mosaicUV);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  retro: {
    name: 'retro',
    label: 'Retro',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Low-res pixelation
  float pixelSize = 4.0 + intensity * 20.0;
  vec2 pixelUV = floor(v_texCoord * pixelSize) / pixelSize;

  vec4 colorA = texture2D(u_textureA, pixelUV);
  vec4 colorB = texture2D(u_textureB, pixelUV);
  vec4 base = mix(colorA, colorB, u_progress);

  // Reduce to retro palette (limited colors)
  float palette = 8.0 + (1.0 - intensity) * 248.0;
  vec3 retro = floor(base.rgb * palette) / palette;

  // Add scanlines
  float scanline = sin(v_texCoord.y * u_resolution.y * 2.0) * 0.5 + 0.5;
  retro *= 0.9 + scanline * 0.1 * intensity;

  gl_FragColor = vec4(retro, 1.0);
}`
  },

  eight_bit: {
    name: 'eight_bit',
    label: '8-Bit',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // 8-bit style pixelation
  float pixelSize = 8.0 + intensity * 24.0;
  vec2 pixelUV = floor(v_texCoord * pixelSize) / pixelSize;

  vec4 colorA = texture2D(u_textureA, pixelUV);
  vec4 colorB = texture2D(u_textureB, pixelUV);
  vec4 base = mix(colorA, colorB, u_progress);

  // NES-style color palette (limited)
  float r = floor(base.r * 4.0) / 4.0;
  float g = floor(base.g * 4.0) / 4.0;
  float b = floor(base.b * 4.0) / 4.0;

  // Slightly boost saturation for that 8-bit pop
  vec3 hsv = rgb2hsv(vec3(r, g, b));
  hsv.y = min(hsv.y * (1.0 + intensity * 0.5), 1.0);
  vec3 result = hsv2rgb(hsv);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  halftone: {
    name: 'halftone',
    label: 'Halftone',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Halftone dot pattern
  float dotSize = 4.0 + intensity * 8.0;
  vec2 cell = floor(v_texCoord * dotSize);
  vec2 cellCenter = (cell + 0.5) / dotSize;

  vec4 colorA = texture2D(u_textureA, cellCenter);
  vec4 colorB = texture2D(u_textureB, cellCenter);
  vec4 base = mix(colorA, colorB, u_progress);

  float brightness = luminance(base.rgb);

  // Distance from cell center
  vec2 cellUV = fract(v_texCoord * dotSize) - 0.5;
  float dist = length(cellUV);

  // Dot size based on brightness
  float dotRadius = brightness * 0.5 * (1.0 + intensity * 0.5);
  float dot = smoothstep(dotRadius, dotRadius - 0.1, dist);

  vec3 result = base.rgb * dot + vec3(1.0 - dot) * (1.0 - intensity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  dots: {
    name: 'dots',
    label: 'Dots',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  float dotGrid = 20.0 + intensity * 30.0;
  vec2 cell = floor(v_texCoord * dotGrid);
  vec2 cellCenter = (cell + 0.5) / dotGrid;

  vec4 colorA = texture2D(u_textureA, cellCenter);
  vec4 colorB = texture2D(u_textureB, cellCenter);
  vec4 base = mix(colorA, colorB, u_progress);

  // Distance from cell center
  vec2 cellUV = fract(v_texCoord * dotGrid) - 0.5;
  float dist = length(cellUV);

  // Circular dots
  float dot = smoothstep(0.4, 0.35, dist);

  gl_FragColor = vec4(base.rgb * dot, 1.0);
}`
  },

  crosshatch: {
    name: 'crosshatch',
    label: 'Crosshatch',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  vec4 base = mix(colorA, colorB, u_progress);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;
  float brightness = luminance(base.rgb);

  // Crosshatch lines based on brightness
  vec2 pixel = v_texCoord * u_resolution;
  float hatch1 = mod(pixel.x + pixel.y, 4.0 + intensity * 4.0) / (4.0 + intensity * 4.0);
  float hatch2 = mod(pixel.x - pixel.y, 6.0 + intensity * 6.0) / (6.0 + intensity * 6.0);
  float hatch3 = mod(pixel.x, 8.0 + intensity * 8.0) / (8.0 + intensity * 8.0);

  float line1 = step(hatch1, brightness);
  float line2 = step(hatch2, brightness * 0.7);
  float line3 = step(hatch3, brightness * 0.5);

  float hatch = (line1 + line2 + line3) / 3.0;
  hatch = mix(brightness, hatch, intensity);

  gl_FragColor = vec4(base.rgb * hatch + (1.0 - hatch) * 0.1, 1.0);
}`
  }
}

export const PIXELATE_VARIANTS = Object.keys(PIXELATE_SHADERS)
