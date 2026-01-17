/**
 * Difference Analysis Shaders
 * 6 modes: absolute, perceptual, luminance, chroma, threshold, amplified
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

export const DIFFERENCE_SHADERS: Record<string, ComparisonShader> = {
  // Debug shader - solid red color to test WebGL pipeline
  'diff-debug': {
    name: 'diff-debug',
    label: 'Debug (Solid Red)',
    category: 'difference',
    description: 'Debug mode - shows solid red if WebGL works',
    fragment: `
precision highp float;
varying vec2 v_texCoord;

void main() {
  // Just output solid red to verify WebGL pipeline works
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}`
  },

  'diff-absolute': {
    name: 'diff-absolute',
    label: 'Absolute Difference',
    category: 'difference',
    description: 'RGB channel difference with adjustable amplification',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Calculate absolute difference per channel
  vec3 diff = abs(colorA.rgb - colorB.rgb);

  // Apply amplification
  diff = diff * u_amplification;

  // Clamp to valid range
  diff = clamp(diff, 0.0, 1.0);

  // Apply threshold
  float diffMag = (diff.r + diff.g + diff.b) / 3.0;
  if (diffMag < u_threshold) {
    diff = vec3(0.0);
  }

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, diff, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-perceptual': {
    name: 'diff-perceptual',
    label: 'Perceptual (Delta E)',
    category: 'difference',
    description: 'CIE Delta E in LAB color space - matches human perception',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Convert to LAB color space
  vec3 labA = rgbToLab(colorA.rgb);
  vec3 labB = rgbToLab(colorB.rgb);

  // Calculate Delta E (CIE94 for better perceptual uniformity)
  float de = deltaE94(labA, labB);

  // Normalize (Delta E typically 0-100, but can be higher)
  // Apply amplification
  float normalized = clamp(de * u_amplification / 50.0, 0.0, 1.0);

  // Apply threshold
  if (normalized < u_threshold) {
    normalized = 0.0;
  }

  // Visualize with heatmap
  vec3 vis = heatmapVis(normalized);

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-luminance': {
    name: 'diff-luminance',
    label: 'Luminance Only',
    category: 'difference',
    description: 'Grayscale comparison - ignores color differences',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Extract luminance
  float lumA = luminance(colorA.rgb);
  float lumB = luminance(colorB.rgb);

  // Calculate difference
  float diff = abs(lumA - lumB);

  // Apply amplification
  diff = diff * u_amplification;
  diff = clamp(diff, 0.0, 1.0);

  // Apply threshold
  if (diff < u_threshold) {
    diff = 0.0;
  }

  // Visualize (grayscale or heatmap)
  vec3 vis = heatmapVis(diff);

  // Show original underneath if opacity < 1
  vec3 original = vec3(mix(lumA, lumB, 0.5));
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-chroma': {
    name: 'diff-chroma',
    label: 'Chroma Only',
    category: 'difference',
    description: 'Color difference ignoring brightness',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Convert to LAB
  vec3 labA = rgbToLab(colorA.rgb);
  vec3 labB = rgbToLab(colorB.rgb);

  // Calculate chroma difference (a* and b* channels only, ignore L*)
  float dA = labA.y - labB.y;
  float dB = labA.z - labB.z;
  float chromaDiff = sqrt(dA * dA + dB * dB);

  // Normalize (chroma typically 0-128)
  float normalized = clamp(chromaDiff * u_amplification / 64.0, 0.0, 1.0);

  // Apply threshold
  if (normalized < u_threshold) {
    normalized = 0.0;
  }

  // Visualize with rainbow (shows color direction)
  vec3 vis = rainbowVis(normalized);

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-threshold': {
    name: 'diff-threshold',
    label: 'Binary Threshold',
    category: 'difference',
    description: 'Black/white pass-fail visualization at adjustable threshold',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Calculate absolute difference
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float diffMag = (diff.r + diff.g + diff.b) / 3.0;

  // Apply amplification before threshold
  diffMag = diffMag * u_amplification;

  // Binary threshold
  float binary = step(u_threshold, diffMag);

  // Visualization: red for differences, green for matches
  vec3 vis = mix(vec3(0.0, 0.8, 0.0), vec3(1.0, 0.0, 0.0), binary);

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-amplified': {
    name: 'diff-amplified',
    label: 'Amplified (10x-100x)',
    category: 'difference',
    description: 'Magnify tiny differences for subtle change detection',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Calculate signed difference (preserves direction)
  vec3 diff = colorA.rgb - colorB.rgb;

  // Heavy amplification (10x to 100x controlled by u_amplification)
  // Map u_amplification 1-100 to 10-100x multiplier
  float multiplier = 10.0 + (u_amplification - 1.0) * 0.909;
  diff = diff * multiplier;

  // Center around 0.5 gray for visualization
  vec3 vis = diff + 0.5;
  vis = clamp(vis, 0.0, 1.0);

  // Apply threshold on magnitude
  float diffMag = length(diff);
  if (diffMag < u_threshold * multiplier) {
    vis = vec3(0.5); // Gray for no difference
  }

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-wipe': {
    name: 'diff-wipe',
    label: 'Wipe (A/B Split)',
    category: 'difference',
    description: 'Drag to compare A vs B with a vertical wipe line',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Wipe position based on mouse X (0-1)
  float wipePos = u_mouse.x;

  vec3 result;
  if (v_texCoord.x < wipePos) {
    result = colorA.rgb;
  } else {
    result = colorB.rgb;
  }

  // Draw wipe line
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - wipePos) < lineWidth) {
    result = vec3(1.0, 0.84, 0.0); // Gold line
  }

  // Labels near the line
  float labelDist = 30.0 / u_resolution.x;
  if (abs(v_texCoord.x - wipePos + labelDist) < lineWidth * 2.0 && v_texCoord.y > 0.95) {
    result = vec3(1.0, 0.5, 0.0); // A label area
  }
  if (abs(v_texCoord.x - wipePos - labelDist) < lineWidth * 2.0 && v_texCoord.y > 0.95) {
    result = vec3(0.0, 0.8, 1.0); // B label area
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-wipe-horizontal': {
    name: 'diff-wipe-horizontal',
    label: 'Wipe Horizontal',
    category: 'difference',
    description: 'Drag to compare A vs B with a horizontal wipe line',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Wipe position based on mouse Y (0-1)
  float wipePos = u_mouse.y;

  vec3 result;
  if (v_texCoord.y < wipePos) {
    result = colorB.rgb; // B on bottom
  } else {
    result = colorA.rgb; // A on top
  }

  // Draw wipe line
  float lineWidth = 2.0 / u_resolution.y;
  if (abs(v_texCoord.y - wipePos) < lineWidth) {
    result = vec3(1.0, 0.84, 0.0); // Gold line
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'diff-split': {
    name: 'diff-split',
    label: 'Side by Side',
    category: 'difference',
    description: 'A on left, B on right - fixed 50/50 split',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  vec3 result;
  if (v_texCoord.x < 0.5) {
    result = colorA.rgb;
  } else {
    result = colorB.rgb;
  }

  // Draw center divider
  float lineWidth = 1.0 / u_resolution.x;
  if (abs(v_texCoord.x - 0.5) < lineWidth) {
    result = vec3(0.3);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  }
}

export const DIFFERENCE_VARIANTS = Object.keys(DIFFERENCE_SHADERS)
