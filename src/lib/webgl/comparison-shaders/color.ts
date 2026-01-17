/**
 * Color Analysis Shaders
 * 5 modes: hue, saturation, false color, channels, histogram
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

export const COLOR_SHADERS: Record<string, ComparisonShader> = {
  'color-hue': {
    name: 'color-hue',
    label: 'Hue Difference',
    category: 'color',
    description: 'Visualize hue/color shift differences on color wheel',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Convert to HSL
  vec3 hslA = rgbToHsl(colorA.rgb);
  vec3 hslB = rgbToHsl(colorB.rgb);

  // Calculate hue difference (circular, 0-1 range)
  float hueDiff = abs(hslA.x - hslB.x);
  hueDiff = min(hueDiff, 1.0 - hueDiff); // Handle wrap-around
  hueDiff = hueDiff * 2.0; // Scale to 0-1

  // Weight by saturation (low saturation = unreliable hue)
  float satWeight = min(hslA.y, hslB.y);
  hueDiff = hueDiff * satWeight;

  // Apply amplification
  hueDiff = hueDiff * u_amplification;
  hueDiff = clamp(hueDiff, 0.0, 1.0);

  // Apply threshold
  if (hueDiff < u_threshold) {
    hueDiff = 0.0;
  }

  // Visualize: show the hue direction of the difference
  float avgHue = (hslA.x + hslB.x) / 2.0;
  vec3 vis = hueWheelVis(avgHue) * hueDiff;

  // If no hue difference, show gray
  if (hueDiff < 0.01) {
    vis = vec3(0.2);
  }

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'color-saturation': {
    name: 'color-saturation',
    label: 'Saturation Map',
    category: 'color',
    description: 'Compare color intensity/vibrance differences',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Convert to HSL
  vec3 hslA = rgbToHsl(colorA.rgb);
  vec3 hslB = rgbToHsl(colorB.rgb);

  // Calculate saturation difference
  float satDiff = hslA.y - hslB.y; // Signed difference

  // Apply amplification
  satDiff = satDiff * u_amplification;
  satDiff = clamp(satDiff, -1.0, 1.0);

  // Apply threshold on magnitude
  if (abs(satDiff) < u_threshold) {
    satDiff = 0.0;
  }

  // Visualize: magenta = A more saturated, cyan = B more saturated
  vec3 vis;
  if (satDiff > 0.0) {
    vis = vec3(satDiff, 0.0, satDiff); // Magenta
  } else {
    vis = vec3(0.0, -satDiff, -satDiff); // Cyan
  }

  // Add gray base for neutral areas
  vis = vis + vec3(0.2);

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'color-false': {
    name: 'color-false',
    label: 'False Color',
    category: 'color',
    description: 'Map differences to rainbow gradient for scientific visualization',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Calculate perceptual difference
  vec3 labA = rgbToLab(colorA.rgb);
  vec3 labB = rgbToLab(colorB.rgb);
  float de = deltaE94(labA, labB);

  // Normalize
  float normalized = clamp(de * u_amplification / 50.0, 0.0, 1.0);

  // Apply threshold
  if (normalized < u_threshold) {
    normalized = 0.0;
  }

  // Rainbow false color visualization
  vec3 vis = rainbowVis(normalized);

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'color-channels': {
    name: 'color-channels',
    label: 'Channel Split',
    category: 'color',
    description: 'Show R/G/B channel differences separately',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Calculate per-channel difference
  vec3 diff = colorA.rgb - colorB.rgb; // Signed

  // Apply amplification
  diff = diff * u_amplification;

  // Split screen into 3 vertical sections
  float section = floor(v_texCoord.x * 3.0);

  vec3 vis;
  float channelDiff;

  if (section < 1.0) {
    // Red channel
    channelDiff = diff.r;
    vis = vec3(abs(channelDiff), 0.0, 0.0);
    // Show direction: bright red = A higher, dark red = B higher
    if (channelDiff < 0.0) {
      vis = vec3(0.0, 0.0, abs(channelDiff));
    }
  } else if (section < 2.0) {
    // Green channel
    channelDiff = diff.g;
    vis = vec3(0.0, abs(channelDiff), 0.0);
    if (channelDiff < 0.0) {
      vis = vec3(abs(channelDiff), 0.0, abs(channelDiff));
    }
  } else {
    // Blue channel
    channelDiff = diff.b;
    vis = vec3(0.0, 0.0, abs(channelDiff));
    if (channelDiff < 0.0) {
      vis = vec3(abs(channelDiff), abs(channelDiff), 0.0);
    }
  }

  // Apply threshold
  if (abs(channelDiff) < u_threshold) {
    vis = vec3(0.1);
  }

  vis = clamp(vis, 0.0, 1.0);

  // Draw section dividers
  float divider = step(0.995, fract(v_texCoord.x * 3.0));
  vis = mix(vis, vec3(0.5), divider);

  // Show original underneath if opacity < 1
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'color-histogram': {
    name: 'color-histogram',
    label: 'Histogram Overlay',
    category: 'color',
    description: 'Real-time histogram comparison overlay',
    fragment: `${COMPARISON_COMMON}

#define HISTOGRAM_SAMPLES 20.0
#define HISTOGRAM_SAMPLE_COUNT 400.0

// Simple histogram approximation using local sampling
void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Main comparison view
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float diffMag = (diff.r + diff.g + diff.b) / 3.0;
  diffMag = diffMag * u_amplification;

  // Create histogram overlay in bottom portion of screen
  float histogramHeight = 0.2;

  vec3 vis;
  if (v_texCoord.y < histogramHeight) {
    // Histogram region
    float binX = v_texCoord.x;
    float binY = v_texCoord.y / histogramHeight;

    // Sample across the image to build histogram approximation
    float countA = 0.0;
    float countB = 0.0;

    // Fixed 20x20 sampling grid for WebGL 1.0 compatibility
    for (float i = 0.0; i < 20.0; i += 1.0) {
      for (float j = 0.0; j < 20.0; j += 1.0) {
        vec2 sampleUV = vec2(i, j) / HISTOGRAM_SAMPLES;
        float lumA = luminance(texture2D(u_textureA, sampleUV).rgb);
        float lumB = luminance(texture2D(u_textureB, sampleUV).rgb);

        // Count samples that fall in this bin
        float binWidth = 1.0 / 64.0;
        if (abs(lumA - binX) < binWidth) countA += 1.0;
        if (abs(lumB - binX) < binWidth) countB += 1.0;
      }
    }

    // Normalize counts
    countA = countA / HISTOGRAM_SAMPLE_COUNT * 5.0;
    countB = countB / HISTOGRAM_SAMPLE_COUNT * 5.0;

    // Draw histogram bars
    float barA = step(binY, countA);
    float barB = step(binY, countB);

    // Red for A, Cyan for B, white for overlap
    vis = vec3(barA * 0.8, barB * 0.8, barB * 0.8);
    if (barA > 0.0 && barB > 0.0) {
      vis = vec3(0.9, 0.9, 0.9);
    }

    // Background
    if (barA < 0.5 && barB < 0.5) {
      vis = vec3(0.1);
    }
  } else {
    // Main comparison view
    vis = heatmapVis(clamp(diffMag, 0.0, 1.0));

    // Show original underneath if opacity < 1
    vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
    vis = mix(original, vis, u_opacity);
  }

  gl_FragColor = vec4(vis, 1.0);
}`
  }
}

export const COLOR_VARIANTS = Object.keys(COLOR_SHADERS)
