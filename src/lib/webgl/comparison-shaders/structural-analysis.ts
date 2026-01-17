/**
 * Advanced Structural Analysis Shaders
 * ANALYSIS-001: Multi-Scale Edge Comparison (Laplacian pyramid)
 * ANALYSIS-002: Local Contrast Map (local standard deviation)
 * ANALYSIS-003: Gradient Direction Visualization (edge direction as hue)
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

/**
 * Additional common utilities for structural analysis
 */
const STRUCTURAL_ANALYSIS_UTILS = `
// HSV to RGB conversion for direction visualization
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Gaussian blur at specific radius using box filter approximation
// WebGL 1.0 requires constant loop bounds, so we define specific radius functions

// 1-pixel radius blur (3x3 kernel)
vec3 blur1px(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 sum = vec3(0.0);
  for (float y = -1.0; y <= 1.0; y += 1.0) {
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb;
    }
  }
  return sum / 9.0;
}

// 4-pixel radius blur (9x9 kernel)
vec3 blur4px(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 sum = vec3(0.0);
  for (float y = -4.0; y <= 4.0; y += 1.0) {
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb;
    }
  }
  return sum / 81.0;
}

// 8-pixel radius blur (approximates 16px scale with downsampled kernel)
vec3 blur8px(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 sum = vec3(0.0);
  // Use step of 2 to cover larger area with fewer samples
  for (float y = -8.0; y <= 8.0; y += 2.0) {
    for (float x = -8.0; x <= 8.0; x += 2.0) {
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb;
    }
  }
  return sum / 81.0;  // 9x9 samples
}

// Laplacian edge detection at specific scale
// Returns the edge magnitude (approximation using difference of Gaussians)
float laplacianScale1(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 center = texture2D(tex, uv).rgb;
  vec3 blurred = blur1px(tex, uv, texelSize);
  vec3 laplacian = center - blurred;
  return length(laplacian);
}

float laplacianScale4(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 blurred1 = blur1px(tex, uv, texelSize);
  vec3 blurred4 = blur4px(tex, uv, texelSize);
  vec3 laplacian = blurred1 - blurred4;
  return length(laplacian);
}

float laplacianScale16(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 blurred4 = blur4px(tex, uv, texelSize);
  vec3 blurred16 = blur8px(tex, uv, texelSize * 2.0);  // 8px with 2x texel = 16px effective
  vec3 laplacian = blurred4 - blurred16;
  return length(laplacian);
}

// Local standard deviation for contrast map
// 4px radius version
float localStdDev4(sampler2D tex, vec2 uv, vec2 texelSize) {
  float sum = 0.0;
  float sumSq = 0.0;
  float count = 0.0;

  for (float y = -4.0; y <= 4.0; y += 1.0) {
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      float val = luminance(texture2D(tex, uv + vec2(x, y) * texelSize).rgb);
      sum += val;
      sumSq += val * val;
      count += 1.0;
    }
  }

  float mean = sum / count;
  float variance = (sumSq / count) - (mean * mean);
  return sqrt(max(0.0, variance));
}

// 8px radius version (uses step of 2)
float localStdDev8(sampler2D tex, vec2 uv, vec2 texelSize) {
  float sum = 0.0;
  float sumSq = 0.0;
  float count = 0.0;

  for (float y = -8.0; y <= 8.0; y += 2.0) {
    for (float x = -8.0; x <= 8.0; x += 2.0) {
      float val = luminance(texture2D(tex, uv + vec2(x, y) * texelSize).rgb);
      sum += val;
      sumSq += val * val;
      count += 1.0;
    }
  }

  float mean = sum / count;
  float variance = (sumSq / count) - (mean * mean);
  return sqrt(max(0.0, variance));
}

// 16px radius version (uses step of 4)
float localStdDev16(sampler2D tex, vec2 uv, vec2 texelSize) {
  float sum = 0.0;
  float sumSq = 0.0;
  float count = 0.0;

  for (float y = -16.0; y <= 16.0; y += 4.0) {
    for (float x = -16.0; x <= 16.0; x += 4.0) {
      float val = luminance(texture2D(tex, uv + vec2(x, y) * texelSize).rgb);
      sum += val;
      sumSq += val * val;
      count += 1.0;
    }
  }

  float mean = sum / count;
  float variance = (sumSq / count) - (mean * mean);
  return sqrt(max(0.0, variance));
}

// 32px radius version (uses step of 8)
float localStdDev32(sampler2D tex, vec2 uv, vec2 texelSize) {
  float sum = 0.0;
  float sumSq = 0.0;
  float count = 0.0;

  for (float y = -32.0; y <= 32.0; y += 8.0) {
    for (float x = -32.0; x <= 32.0; x += 8.0) {
      float val = luminance(texture2D(tex, uv + vec2(x, y) * texelSize).rgb);
      sum += val;
      sumSq += val * val;
      count += 1.0;
    }
  }

  float mean = sum / count;
  float variance = (sumSq / count) - (mean * mean);
  return sqrt(max(0.0, variance));
}

// Constants
#define PI 3.14159265359
`

export const STRUCTURAL_ANALYSIS_SHADERS: Record<string, ComparisonShader> = {
  /**
   * ANALYSIS-001: Multi-Scale Edge Comparison
   * Compares edges at different frequency scales using Laplacian pyramid decomposition
   * - Fine (1px): texture detail, noise, sharpening artifacts
   * - Medium (4px): general edges, object boundaries
   * - Coarse (16px): large structures, major contours
   */
  'analysis-multiscale-edge': {
    name: 'analysis-multiscale-edge',
    label: 'Multi-Scale Edge',
    category: 'analysis',
    description: 'Compare edges at fine (1px), medium (4px), and coarse (16px) scales using Laplacian pyramid',
    fragment: `${COMPARISON_COMMON}
${STRUCTURAL_ANALYSIS_UTILS}

// u_blockSize repurposed as scale selector: 1=fine, 4=medium, 16=coarse, 0=all
uniform float u_scaleSelector;  // Added via blockSize uniform

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 uvA = getAspectCorrectUV(v_texCoord, u_textureASize, u_resolution);
  vec2 uvB = getAspectCorrectUV(v_texCoord, u_textureBSize, u_resolution);

  // Check bounds
  bool validA = isUVValid(uvA);
  bool validB = isUVValid(uvB);

  if (!validA || !validB) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Compute Laplacian at each scale for both images
  float fineA = laplacianScale1(u_textureA, uvA, texelSize);
  float fineB = laplacianScale1(u_textureB, uvB, texelSize);

  float mediumA = laplacianScale4(u_textureA, uvA, texelSize);
  float mediumB = laplacianScale4(u_textureB, uvB, texelSize);

  float coarseA = laplacianScale16(u_textureA, uvA, texelSize);
  float coarseB = laplacianScale16(u_textureB, uvB, texelSize);

  // Calculate differences at each scale
  float fineDiff = abs(fineA - fineB);
  float mediumDiff = abs(mediumA - mediumB);
  float coarseDiff = abs(coarseA - coarseB);

  // Scale selector (using blockSize uniform)
  // 1 = fine only, 4 = medium only, 16 = coarse only, else = combined
  float selector = u_blockSize;

  vec3 vis;

  if (selector < 2.0) {
    // Fine scale only (1px) - Red channel
    float diff = fineDiff * u_amplification * 10.0;
    diff = clamp(diff, 0.0, 1.0);
    if (diff < u_threshold) diff = 0.0;
    vis = heatmapVis(diff);
  } else if (selector < 8.0) {
    // Medium scale only (4px) - Green channel
    float diff = mediumDiff * u_amplification * 8.0;
    diff = clamp(diff, 0.0, 1.0);
    if (diff < u_threshold) diff = 0.0;
    vis = heatmapVis(diff);
  } else if (selector < 20.0) {
    // Coarse scale only (16px) - Blue channel
    float diff = coarseDiff * u_amplification * 5.0;
    diff = clamp(diff, 0.0, 1.0);
    if (diff < u_threshold) diff = 0.0;
    vis = heatmapVis(diff);
  } else {
    // Combined view: RGB = Fine/Medium/Coarse differences
    float r = fineDiff * u_amplification * 10.0;
    float g = mediumDiff * u_amplification * 8.0;
    float b = coarseDiff * u_amplification * 5.0;

    // Apply threshold
    if (r < u_threshold) r = 0.0;
    if (g < u_threshold) g = 0.0;
    if (b < u_threshold) b = 0.0;

    vis = vec3(clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0));
  }

  // Blend with original if opacity < 1
  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-002: Local Contrast Map
   * Visualizes micro-contrast (local standard deviation) across the image
   * High contrast = detail-rich areas (bright)
   * Low contrast = flat areas (dark)
   * Useful for detecting compression contrast loss
   */
  'analysis-local-contrast': {
    name: 'analysis-local-contrast',
    label: 'Local Contrast Map',
    category: 'analysis',
    description: 'Visualize micro-contrast using local standard deviation - high contrast = bright, low = dark',
    fragment: `${COMPARISON_COMMON}
${STRUCTURAL_ANALYSIS_UTILS}

// u_blockSize repurposed as radius selector: 4, 8, 16, or 32 pixels

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 uvA = getAspectCorrectUV(v_texCoord, u_textureASize, u_resolution);
  vec2 uvB = getAspectCorrectUV(v_texCoord, u_textureBSize, u_resolution);

  // Check bounds
  bool validA = isUVValid(uvA);
  bool validB = isUVValid(uvB);

  if (!validA || !validB) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Select radius based on blockSize (4, 8, 16, 32)
  float radius = u_blockSize;

  float contrastA, contrastB;

  if (radius < 6.0) {
    // 4px radius
    contrastA = localStdDev4(u_textureA, uvA, texelSize);
    contrastB = localStdDev4(u_textureB, uvB, texelSize);
  } else if (radius < 12.0) {
    // 8px radius
    contrastA = localStdDev8(u_textureA, uvA, texelSize);
    contrastB = localStdDev8(u_textureB, uvB, texelSize);
  } else if (radius < 24.0) {
    // 16px radius
    contrastA = localStdDev16(u_textureA, uvA, texelSize);
    contrastB = localStdDev16(u_textureB, uvB, texelSize);
  } else {
    // 32px radius
    contrastA = localStdDev32(u_textureA, uvA, texelSize);
    contrastB = localStdDev32(u_textureB, uvB, texelSize);
  }

  // Calculate contrast difference
  float diff = abs(contrastA - contrastB);

  // Apply amplification and threshold
  diff = diff * u_amplification * 5.0;
  diff = clamp(diff, 0.0, 1.0);

  if (diff < u_threshold) {
    diff = 0.0;
  }

  // Visualize with directional color coding
  // Red: A has more contrast (more detail)
  // Blue: B has more contrast (more detail)
  // Green: similar contrast
  float direction = contrastA - contrastB;
  vec3 vis;

  if (abs(direction) < u_threshold * 0.5) {
    // Similar contrast - show in grayscale/green
    vis = vec3(0.0, diff * 0.8, 0.0);
  } else if (direction > 0.0) {
    // A has more contrast - red
    vis = vec3(diff, diff * 0.2, 0.0);
  } else {
    // B has more contrast - blue
    vis = vec3(0.0, diff * 0.2, diff);
  }

  // Also show absolute contrast levels via heatmap
  float avgContrast = (contrastA + contrastB) * 0.5;
  float contrastLevel = avgContrast * u_amplification * 3.0;
  contrastLevel = clamp(contrastLevel, 0.0, 1.0);

  // Combine: heatmap for contrast level, RGB for difference direction
  vec3 heatColor = heatmapVis(contrastLevel);
  vis = mix(heatColor, vis, 0.5 + diff * 0.5);

  // Blend with original if opacity < 1
  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-003: Gradient Direction Visualization
   * Visualizes edge direction as hue (0-360 degrees)
   * - Horizontal edges = red (0 degrees)
   * - Diagonal edges = yellow/cyan (45/135 degrees)
   * - Vertical edges = cyan (90 degrees)
   * - Brightness = edge strength
   * Useful for detecting rotation, warping, or AI artifacts
   */
  'analysis-gradient-direction': {
    name: 'analysis-gradient-direction',
    label: 'Gradient Direction',
    category: 'analysis',
    description: 'Visualize edge direction as hue - horizontal=red, vertical=cyan, brightness=strength',
    fragment: `${COMPARISON_COMMON}
${STRUCTURAL_ANALYSIS_UTILS}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 uvA = getAspectCorrectUV(v_texCoord, u_textureASize, u_resolution);
  vec2 uvB = getAspectCorrectUV(v_texCoord, u_textureBSize, u_resolution);

  // Check bounds
  bool validA = isUVValid(uvA);
  bool validB = isUVValid(uvB);

  if (!validA || !validB) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Get Sobel gradients for both images
  vec2 gradA = sobel(u_textureA, uvA, texelSize);
  vec2 gradB = sobel(u_textureB, uvB, texelSize);

  // Calculate magnitude and direction
  float magA = length(gradA);
  float magB = length(gradB);

  float dirA = atan(gradA.y, gradA.x);  // -PI to PI
  float dirB = atan(gradB.y, gradB.x);

  // Convert direction to hue (0-1)
  // 0 = horizontal (red), 0.5 = vertical (cyan)
  float hueA = (dirA + PI) / (2.0 * PI);
  float hueB = (dirB + PI) / (2.0 * PI);

  // Direction difference (handle wrap-around)
  float dirDiff = abs(dirA - dirB);
  dirDiff = min(dirDiff, 2.0 * PI - dirDiff);
  dirDiff = dirDiff / PI;  // Normalize to 0-1

  // Magnitude difference
  float magDiff = abs(magA - magB);

  // Apply threshold to show only edges above strength threshold
  float thresholdStrength = u_threshold * 0.5;  // Scale threshold for edge detection

  // Visualize based on mode (using blockSize as mode selector)
  // < 8: Show A's gradient direction
  // >= 8 and < 16: Show B's gradient direction
  // >= 16 and < 24: Show difference in direction
  // >= 24: Show combined comparison

  vec3 vis;
  float selector = u_blockSize;

  if (selector < 8.0) {
    // Show A's gradient direction
    float strength = magA * u_amplification * 2.0;
    strength = clamp(strength, 0.0, 1.0);
    if (magA < thresholdStrength) {
      vis = vec3(0.1, 0.1, 0.1);  // Dark for weak edges
    } else {
      vis = hsv2rgb(vec3(hueA, 0.9, strength));
    }
  } else if (selector < 16.0) {
    // Show B's gradient direction
    float strength = magB * u_amplification * 2.0;
    strength = clamp(strength, 0.0, 1.0);
    if (magB < thresholdStrength) {
      vis = vec3(0.1, 0.1, 0.1);
    } else {
      vis = hsv2rgb(vec3(hueB, 0.9, strength));
    }
  } else if (selector < 24.0) {
    // Show direction difference
    // Where directions differ, show as bright
    float avgMag = (magA + magB) * 0.5;
    if (avgMag < thresholdStrength) {
      vis = vec3(0.1, 0.1, 0.1);
    } else {
      // Direction difference mapped to heatmap
      float diff = dirDiff * u_amplification;
      diff = clamp(diff, 0.0, 1.0);
      vis = heatmapVis(diff);
    }
  } else {
    // Combined comparison view
    // Use split view: left shows A direction, right shows B direction
    // With direction difference as brightness overlay

    float splitPos = u_mouse.x;  // Use mouse position for interactive split

    float avgMag = (magA + magB) * 0.5;

    if (avgMag < thresholdStrength) {
      vis = vec3(0.1, 0.1, 0.1);
    } else {
      float strength = avgMag * u_amplification * 2.0;
      strength = clamp(strength, 0.0, 1.0);

      // Mix hues based on split position or show difference
      if (v_texCoord.x < splitPos) {
        vis = hsv2rgb(vec3(hueA, 0.9, strength));
      } else {
        vis = hsv2rgb(vec3(hueB, 0.9, strength));
      }

      // Overlay direction difference
      float diff = dirDiff * u_amplification;
      diff = clamp(diff, 0.0, 1.0);
      if (diff > u_threshold) {
        // Highlight areas with significant direction difference
        vis = mix(vis, vec3(1.0, 0.3, 0.0), diff * 0.5);
      }
    }
  }

  // Blend with original if opacity < 1
  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * Bonus: Direction Histogram Overlay
   * Shows dominant edge orientations as a pie chart overlay
   */
  'analysis-direction-histogram': {
    name: 'analysis-direction-histogram',
    label: 'Direction Histogram',
    category: 'analysis',
    description: 'Overlay showing dominant edge orientations - useful for detecting rotation/warping',
    fragment: `${COMPARISON_COMMON}
${STRUCTURAL_ANALYSIS_UTILS}

// Build a simple direction histogram from local neighborhood
// Returns dominant direction as angle 0-1 and strength
vec2 localDirectionHistogram(sampler2D tex, vec2 uv, vec2 texelSize) {
  // 8 direction bins
  float bins[8];
  for (int i = 0; i < 8; i++) {
    bins[i] = 0.0;
  }

  // Sample neighborhood
  for (float y = -4.0; y <= 4.0; y += 2.0) {
    for (float x = -4.0; x <= 4.0; x += 2.0) {
      vec2 sampleUV = uv + vec2(x, y) * texelSize;
      vec2 grad = sobel(tex, sampleUV, texelSize);
      float mag = length(grad);
      float dir = atan(grad.y, grad.x);

      // Map direction to bin (0-7)
      float binFloat = (dir + PI) / (2.0 * PI) * 8.0;
      int bin = int(mod(binFloat, 8.0));

      // Add magnitude to bin
      if (bin == 0) bins[0] += mag;
      else if (bin == 1) bins[1] += mag;
      else if (bin == 2) bins[2] += mag;
      else if (bin == 3) bins[3] += mag;
      else if (bin == 4) bins[4] += mag;
      else if (bin == 5) bins[5] += mag;
      else if (bin == 6) bins[6] += mag;
      else bins[7] += mag;
    }
  }

  // Find dominant bin
  float maxBin = 0.0;
  int maxIdx = 0;
  float totalMag = 0.0;

  for (int i = 0; i < 8; i++) {
    totalMag += bins[i];
    if (bins[i] > maxBin) {
      maxBin = bins[i];
      maxIdx = i;
    }
  }

  // Return dominant direction (0-1) and relative strength
  float dominantDir = float(maxIdx) / 8.0;
  float strength = totalMag > 0.0 ? maxBin / totalMag : 0.0;

  return vec2(dominantDir, strength);
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 uvA = getAspectCorrectUV(v_texCoord, u_textureASize, u_resolution);
  vec2 uvB = getAspectCorrectUV(v_texCoord, u_textureBSize, u_resolution);

  // Check bounds
  bool validA = isUVValid(uvA);
  bool validB = isUVValid(uvB);

  if (!validA || !validB) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Get local direction histograms
  vec2 histA = localDirectionHistogram(u_textureA, uvA, texelSize);
  vec2 histB = localDirectionHistogram(u_textureB, uvB, texelSize);

  // Compare dominant directions
  float dirDiff = abs(histA.x - histB.x);
  dirDiff = min(dirDiff, 1.0 - dirDiff);  // Wrap-around
  dirDiff = dirDiff * 2.0;  // Normalize

  // Apply amplification
  dirDiff = dirDiff * u_amplification;
  dirDiff = clamp(dirDiff, 0.0, 1.0);

  // Strength difference
  float strengthDiff = abs(histA.y - histB.y);

  // Apply threshold
  if (dirDiff < u_threshold && strengthDiff < u_threshold) {
    dirDiff = 0.0;
    strengthDiff = 0.0;
  }

  // Visualize
  // Use hue for direction difference, saturation for strength difference
  vec3 vis;

  // Background: direction color from A
  float strength = max(histA.y, histB.y);
  if (strength > 0.1) {
    vis = hsv2rgb(vec3(histA.x, 0.6, 0.5 + dirDiff * 0.5));

    // Highlight differences
    if (dirDiff > u_threshold) {
      // Significant direction difference - show as orange/red overlay
      vis = mix(vis, vec3(1.0, 0.4, 0.0), dirDiff * 0.7);
    }
  } else {
    vis = vec3(0.15, 0.15, 0.15);
  }

  // Blend with original if opacity < 1
  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  }
}

export const STRUCTURAL_ANALYSIS_VARIANTS = Object.keys(STRUCTURAL_ANALYSIS_SHADERS)
