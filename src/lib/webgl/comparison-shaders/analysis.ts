/**
 * Advanced Analysis Shaders
 * ANALYSIS-004: Optical Flow Visualization
 * ANALYSIS-005: FFT Spectrum Visualization
 * ANALYSIS-006: Band-Pass Frequency Filter
 * ANALYSIS-007: Temporal Noise Analysis
 * ANALYSIS-008: Frame Difference Accumulator
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

export const ANALYSIS_SHADERS: Record<string, ComparisonShader> = {
  /**
   * ANALYSIS-004: Optical Flow Visualization
   * Motion vectors between frames using block matching
   * Color = direction (HSV wheel)
   * Brightness = magnitude
   */
  'analysis-optical-flow': {
    name: 'analysis-optical-flow',
    label: 'Optical Flow',
    category: 'video',
    description: 'Motion vectors between frames - color=direction, brightness=magnitude',
    fragment: `${COMPARISON_COMMON}

// Block sizes controlled by u_blockSize uniform (8, 16, 32)
#define SEARCH_RANGE 8

// Compute Sum of Absolute Differences for a block
float computeSAD(vec2 centerA, vec2 centerB, float blockRadius, vec2 texelSize) {
  float sad = 0.0;
  float samples = 0.0;

  // Sample points within the block (using fixed loops for WebGL 1.0)
  for (float y = -16.0; y <= 16.0; y += 2.0) {
    if (abs(y) > blockRadius) continue;
    for (float x = -16.0; x <= 16.0; x += 2.0) {
      if (abs(x) > blockRadius) continue;

      vec2 offset = vec2(x, y) * texelSize;
      vec3 colorA = texture2D(u_textureA, centerA + offset).rgb;
      vec3 colorB = texture2D(u_textureB, centerB + offset).rgb;

      sad += abs(colorA.r - colorB.r) + abs(colorA.g - colorB.g) + abs(colorA.b - colorB.b);
      samples += 1.0;
    }
  }

  return samples > 0.0 ? sad / samples : 0.0;
}

// Find best matching block in B for a block from A
vec2 findMotionVector(vec2 uv, vec2 texelSize) {
  float blockRadius = u_blockSize * 0.5;
  float bestSAD = 999999.0;
  vec2 bestOffset = vec2(0.0);

  // Search in a range around the original position
  for (float dy = -8.0; dy <= 8.0; dy += 1.0) {
    for (float dx = -8.0; dx <= 8.0; dx += 1.0) {
      vec2 searchOffset = vec2(dx, dy) * texelSize * 2.0;
      vec2 searchPos = uv + searchOffset;

      // Check bounds
      if (searchPos.x < 0.0 || searchPos.x > 1.0 || searchPos.y < 0.0 || searchPos.y > 1.0) continue;

      float sad = computeSAD(uv, searchPos, blockRadius, texelSize);

      if (sad < bestSAD) {
        bestSAD = sad;
        bestOffset = vec2(dx, dy) * 2.0;
      }
    }
  }

  return bestOffset;
}

// Convert motion vector to color (HSV wheel for direction)
vec3 motionToColor(vec2 motion, float threshold) {
  float magnitude = length(motion);

  // Apply threshold - ignore small motions
  if (magnitude < threshold * 10.0) {
    return vec3(0.1); // Dark gray for no/minimal motion
  }

  // Direction as hue (0-1)
  float angle = atan(motion.y, motion.x);
  float hue = (angle + 3.14159) / (2.0 * 3.14159);

  // Magnitude as brightness (clamped)
  float brightness = clamp(magnitude / 20.0, 0.0, 1.0);

  // HSV to RGB
  return hueWheelVis(hue) * brightness;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Find motion vector at this pixel
  vec2 motion = findMotionVector(v_texCoord, texelSize);

  // Apply amplification
  motion *= u_amplification * 0.1;

  // Convert to color visualization
  vec3 motionColor = motionToColor(motion, u_threshold);

  // Blend with original based on opacity
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);

  vec3 result = mix(original, motionColor, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-004b: Optical Flow - 8x8 blocks
   */
  'analysis-optical-flow-8': {
    name: 'analysis-optical-flow-8',
    label: 'Optical Flow (8x8)',
    category: 'video',
    description: 'Fine-grained motion vectors with 8x8 pixel blocks',
    fragment: `${COMPARISON_COMMON}

float computeSAD8(vec2 centerA, vec2 centerB, vec2 texelSize) {
  float sad = 0.0;
  for (float y = -4.0; y <= 4.0; y += 1.0) {
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      vec2 offset = vec2(x, y) * texelSize;
      vec3 colorA = texture2D(u_textureA, centerA + offset).rgb;
      vec3 colorB = texture2D(u_textureB, centerB + offset).rgb;
      sad += length(colorA - colorB);
    }
  }
  return sad / 81.0;
}

vec2 findMotion8(vec2 uv, vec2 texelSize) {
  float bestSAD = 999.0;
  vec2 bestOffset = vec2(0.0);

  for (float dy = -6.0; dy <= 6.0; dy += 1.0) {
    for (float dx = -6.0; dx <= 6.0; dx += 1.0) {
      vec2 offset = vec2(dx, dy) * texelSize;
      float sad = computeSAD8(uv, uv + offset, texelSize);
      if (sad < bestSAD) {
        bestSAD = sad;
        bestOffset = vec2(dx, dy);
      }
    }
  }
  return bestOffset;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 motion = findMotion8(v_texCoord, texelSize) * u_amplification * 0.2;

  float mag = length(motion);
  if (mag < u_threshold * 5.0) {
    vec4 avg = mix(sampleTextureA(v_texCoord), sampleTextureB(v_texCoord), 0.5);
    gl_FragColor = vec4(avg.rgb * 0.3, 1.0);
    return;
  }

  float hue = (atan(motion.y, motion.x) + 3.14159) / (2.0 * 3.14159);
  vec3 color = hueWheelVis(hue) * clamp(mag / 15.0, 0.2, 1.0);

  vec3 original = mix(sampleTextureA(v_texCoord).rgb, sampleTextureB(v_texCoord).rgb, 0.5);
  gl_FragColor = vec4(mix(original, color, u_opacity), 1.0);
}`
  },

  /**
   * ANALYSIS-004c: Optical Flow - 32x32 blocks
   */
  'analysis-optical-flow-32': {
    name: 'analysis-optical-flow-32',
    label: 'Optical Flow (32x32)',
    category: 'video',
    description: 'Coarse motion vectors with 32x32 pixel blocks',
    fragment: `${COMPARISON_COMMON}

float computeSAD32(vec2 centerA, vec2 centerB, vec2 texelSize) {
  float sad = 0.0;
  // Sample every 4th pixel in 32x32 block for efficiency
  for (float y = -16.0; y <= 16.0; y += 4.0) {
    for (float x = -16.0; x <= 16.0; x += 4.0) {
      vec2 offset = vec2(x, y) * texelSize;
      vec3 colorA = texture2D(u_textureA, centerA + offset).rgb;
      vec3 colorB = texture2D(u_textureB, centerB + offset).rgb;
      sad += length(colorA - colorB);
    }
  }
  return sad / 81.0;
}

vec2 findMotion32(vec2 uv, vec2 texelSize) {
  float bestSAD = 999.0;
  vec2 bestOffset = vec2(0.0);

  for (float dy = -12.0; dy <= 12.0; dy += 2.0) {
    for (float dx = -12.0; dx <= 12.0; dx += 2.0) {
      vec2 offset = vec2(dx, dy) * texelSize * 2.0;
      float sad = computeSAD32(uv, uv + offset, texelSize);
      if (sad < bestSAD) {
        bestSAD = sad;
        bestOffset = vec2(dx, dy) * 2.0;
      }
    }
  }
  return bestOffset;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 motion = findMotion32(v_texCoord, texelSize) * u_amplification * 0.15;

  float mag = length(motion);
  if (mag < u_threshold * 8.0) {
    vec4 avg = mix(sampleTextureA(v_texCoord), sampleTextureB(v_texCoord), 0.5);
    gl_FragColor = vec4(avg.rgb * 0.3, 1.0);
    return;
  }

  float hue = (atan(motion.y, motion.x) + 3.14159) / (2.0 * 3.14159);
  vec3 color = hueWheelVis(hue) * clamp(mag / 25.0, 0.2, 1.0);

  vec3 original = mix(sampleTextureA(v_texCoord).rgb, sampleTextureB(v_texCoord).rgb, 0.5);
  gl_FragColor = vec4(mix(original, color, u_opacity), 1.0);
}`
  },

  /**
   * ANALYSIS-005: FFT Spectrum Visualization (Approximation)
   * Uses Gaussian blur approximation for frequency analysis
   * Low frequencies at center, high at edges
   */
  'analysis-fft-magnitude': {
    name: 'analysis-fft-magnitude',
    label: 'FFT Magnitude',
    category: 'video',
    description: 'Frequency spectrum approximation - low freq center, high freq edges',
    fragment: `${COMPARISON_COMMON}

// Approximate frequency content using multi-scale blur difference
// This is a Laplacian pyramid approximation of FFT

// Gaussian blur at different scales
vec3 blur(sampler2D tex, vec2 uv, vec2 texelSize, float radius) {
  vec3 sum = vec3(0.0);
  float weight = 0.0;

  // Fixed loop bounds for WebGL 1.0
  for (float y = -8.0; y <= 8.0; y += 1.0) {
    if (abs(y) > radius) continue;
    for (float x = -8.0; x <= 8.0; x += 1.0) {
      if (abs(x) > radius) continue;

      float d = length(vec2(x, y));
      if (d > radius) continue;

      // Gaussian weight
      float g = exp(-d * d / (2.0 * radius * radius));
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb * g;
      weight += g;
    }
  }

  return weight > 0.0 ? sum / weight : vec3(0.0);
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 uv = v_texCoord;

  // Sample at multiple scales from A and B
  vec3 origA = texture2D(u_textureA, uv).rgb;
  vec3 origB = texture2D(u_textureB, uv).rgb;

  // Multi-scale decomposition
  float scale1 = 2.0;
  float scale2 = 4.0;
  float scale3 = 8.0;

  vec3 blurA1 = blur(u_textureA, uv, texelSize, scale1);
  vec3 blurA2 = blur(u_textureA, uv, texelSize, scale2);
  vec3 blurA3 = blur(u_textureA, uv, texelSize, scale3);

  vec3 blurB1 = blur(u_textureB, uv, texelSize, scale1);
  vec3 blurB2 = blur(u_textureB, uv, texelSize, scale2);
  vec3 blurB3 = blur(u_textureB, uv, texelSize, scale3);

  // Extract frequency bands (Laplacian pyramid style)
  // High frequency = original - small blur
  vec3 highFreqA = abs(origA - blurA1);
  vec3 midFreqA = abs(blurA1 - blurA2);
  vec3 lowFreqA = blurA3;

  vec3 highFreqB = abs(origB - blurB1);
  vec3 midFreqB = abs(blurB1 - blurB2);
  vec3 lowFreqB = blurB3;

  // Difference in frequency content
  float highDiff = length(highFreqA - highFreqB);
  float midDiff = length(midFreqA - midFreqB);
  float lowDiff = length(lowFreqA - lowFreqB);

  // Combine into spectrum visualization
  // Use log scaling for better visibility
  highDiff = log(1.0 + highDiff * u_amplification * 10.0);
  midDiff = log(1.0 + midDiff * u_amplification * 10.0);
  lowDiff = log(1.0 + lowDiff * u_amplification * 10.0);

  // Map to distance from center for frequency visualization
  vec2 centered = uv - 0.5;
  float dist = length(centered);

  // Low freq at center (red), mid freq (green), high freq at edges (blue)
  vec3 freqColor;
  if (dist < 0.15) {
    freqColor = vec3(lowDiff, 0.0, 0.0); // Low frequencies
  } else if (dist < 0.35) {
    float t = (dist - 0.15) / 0.2;
    freqColor = vec3(lowDiff * (1.0 - t), midDiff, 0.0);
  } else {
    float t = clamp((dist - 0.35) / 0.15, 0.0, 1.0);
    freqColor = vec3(0.0, midDiff * (1.0 - t), highDiff);
  }

  // Apply threshold
  float total = (highDiff + midDiff + lowDiff) / 3.0;
  if (total < u_threshold) {
    freqColor *= 0.2;
  }

  // Output
  vec3 original = mix(origA, origB, 0.5);
  vec3 result = mix(original, freqColor * 2.0, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-005b: FFT Phase Spectrum
   */
  'analysis-fft-phase': {
    name: 'analysis-fft-phase',
    label: 'FFT Phase',
    category: 'video',
    description: 'Phase spectrum visualization using gradient direction',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Use gradient direction as phase approximation
  vec2 gradA = sobel(u_textureA, v_texCoord, texelSize);
  vec2 gradB = sobel(u_textureB, v_texCoord, texelSize);

  // Phase = gradient direction
  float phaseA = atan(gradA.y, gradA.x);
  float phaseB = atan(gradB.y, gradB.x);

  // Phase difference
  float phaseDiff = abs(phaseA - phaseB);
  // Wrap around
  if (phaseDiff > 3.14159) phaseDiff = 2.0 * 3.14159 - phaseDiff;

  // Normalize to 0-1
  phaseDiff = phaseDiff / 3.14159;

  // Apply amplification
  phaseDiff *= u_amplification;
  phaseDiff = clamp(phaseDiff, 0.0, 1.0);

  // Apply threshold
  if (phaseDiff < u_threshold) phaseDiff = 0.0;

  // Visualize phase difference
  vec3 phaseColor = hueWheelVis(phaseDiff);

  // Gradient magnitude for brightness
  float magA = length(gradA);
  float magB = length(gradB);
  float avgMag = (magA + magB) * 0.5;
  phaseColor *= clamp(avgMag * 5.0, 0.0, 1.0);

  // Blend with original
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);

  vec3 result = mix(original, phaseColor, u_opacity);
  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-006: Band-Pass Frequency Filter - Low Pass
   */
  'analysis-bandpass-low': {
    name: 'analysis-bandpass-low',
    label: 'Low-Pass Filter',
    category: 'video',
    description: 'Show only structure (low frequencies) - removes detail/noise',
    fragment: `${COMPARISON_COMMON}

vec3 gaussianBlur(sampler2D tex, vec2 uv, vec2 texelSize, float sigma) {
  vec3 sum = vec3(0.0);
  float weight = 0.0;

  float radius = sigma * 3.0;

  for (float y = -12.0; y <= 12.0; y += 1.0) {
    if (abs(y) > radius) continue;
    for (float x = -12.0; x <= 12.0; x += 1.0) {
      if (abs(x) > radius) continue;

      float d2 = x * x + y * y;
      if (d2 > radius * radius) continue;

      float g = exp(-d2 / (2.0 * sigma * sigma));
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb * g;
      weight += g;
    }
  }

  return weight > 0.0 ? sum / weight : texture2D(tex, uv).rgb;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Cutoff frequency controlled by threshold (0-1 -> sigma 2-12)
  float sigma = mix(2.0, 12.0, u_threshold);

  // Apply low-pass filter to both textures
  vec3 lowA = gaussianBlur(u_textureA, v_texCoord, texelSize, sigma);
  vec3 lowB = gaussianBlur(u_textureB, v_texCoord, texelSize, sigma);

  // Compare low-frequency content
  vec3 diff = abs(lowA - lowB) * u_amplification;

  // Heatmap visualization
  float diffMag = (diff.r + diff.g + diff.b) / 3.0;
  vec3 heatColor = heatmapVis(diffMag);

  // Show original low-pass or difference based on opacity
  vec3 filtered = mix(lowA, lowB, 0.5);
  vec3 result = mix(filtered, heatColor, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-006b: Band-Pass Frequency Filter - High Pass
   */
  'analysis-bandpass-high': {
    name: 'analysis-bandpass-high',
    label: 'High-Pass Filter',
    category: 'video',
    description: 'Show only detail/noise (high frequencies) - removes structure',
    fragment: `${COMPARISON_COMMON}

vec3 gaussianBlur(sampler2D tex, vec2 uv, vec2 texelSize, float sigma) {
  vec3 sum = vec3(0.0);
  float weight = 0.0;

  for (float y = -8.0; y <= 8.0; y += 1.0) {
    for (float x = -8.0; x <= 8.0; x += 1.0) {
      float d2 = x * x + y * y;
      if (d2 > sigma * sigma * 9.0) continue;

      float g = exp(-d2 / (2.0 * sigma * sigma));
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb * g;
      weight += g;
    }
  }

  return weight > 0.0 ? sum / weight : texture2D(tex, uv).rgb;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Cutoff frequency controlled by threshold
  float sigma = mix(1.0, 8.0, u_threshold);

  // High-pass = original - low-pass
  vec3 origA = texture2D(u_textureA, v_texCoord).rgb;
  vec3 origB = texture2D(u_textureB, v_texCoord).rgb;

  vec3 lowA = gaussianBlur(u_textureA, v_texCoord, texelSize, sigma);
  vec3 lowB = gaussianBlur(u_textureB, v_texCoord, texelSize, sigma);

  vec3 highA = origA - lowA + 0.5; // Shift to visible range
  vec3 highB = origB - lowB + 0.5;

  // Compare high-frequency content
  vec3 diff = abs(highA - highB) * u_amplification * 2.0;

  // Heatmap visualization
  float diffMag = (diff.r + diff.g + diff.b) / 3.0;
  vec3 heatColor = heatmapVis(diffMag);

  // Show filtered or difference
  vec3 filtered = mix(highA, highB, 0.5);
  vec3 result = mix(filtered, heatColor, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-006c: Band-Pass Frequency Filter - Band Pass
   */
  'analysis-bandpass-band': {
    name: 'analysis-bandpass-band',
    label: 'Band-Pass Filter',
    category: 'video',
    description: 'Show specific frequency range - isolate mid-level detail',
    fragment: `${COMPARISON_COMMON}

vec3 gaussianBlur(sampler2D tex, vec2 uv, vec2 texelSize, float sigma) {
  vec3 sum = vec3(0.0);
  float weight = 0.0;

  for (float y = -10.0; y <= 10.0; y += 1.0) {
    for (float x = -10.0; x <= 10.0; x += 1.0) {
      float d2 = x * x + y * y;
      if (d2 > sigma * sigma * 9.0) continue;

      float g = exp(-d2 / (2.0 * sigma * sigma));
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb * g;
      weight += g;
    }
  }

  return weight > 0.0 ? sum / weight : texture2D(tex, uv).rgb;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Band controlled by threshold (center freq) and blockSize (bandwidth)
  float sigmaLow = mix(2.0, 6.0, u_threshold);
  float sigmaHigh = sigmaLow + u_blockSize * 0.25;

  // Band-pass = low_pass(smaller) - low_pass(larger)
  vec3 lowA1 = gaussianBlur(u_textureA, v_texCoord, texelSize, sigmaLow);
  vec3 lowA2 = gaussianBlur(u_textureA, v_texCoord, texelSize, sigmaHigh);

  vec3 lowB1 = gaussianBlur(u_textureB, v_texCoord, texelSize, sigmaLow);
  vec3 lowB2 = gaussianBlur(u_textureB, v_texCoord, texelSize, sigmaHigh);

  vec3 bandA = lowA1 - lowA2 + 0.5;
  vec3 bandB = lowB1 - lowB2 + 0.5;

  // Compare band content
  vec3 diff = abs(bandA - bandB) * u_amplification * 3.0;

  float diffMag = (diff.r + diff.g + diff.b) / 3.0;
  vec3 heatColor = heatmapVis(diffMag);

  vec3 filtered = mix(bandA, bandB, 0.5);
  vec3 result = mix(filtered, heatColor, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-007: Temporal Noise Analysis
   * Visualizes frame-to-frame noise characteristics
   */
  'analysis-temporal-noise': {
    name: 'analysis-temporal-noise',
    label: 'Temporal Noise',
    category: 'video',
    description: 'Frame-to-frame noise - distinguishes static vs temporal noise',
    fragment: `${COMPARISON_COMMON}

// Estimate local variance (noise level) in a region
float localVarianceL(sampler2D tex, vec2 uv, vec2 texelSize) {
  float mean = 0.0;
  float meanSq = 0.0;
  float count = 0.0;

  for (float y = -2.0; y <= 2.0; y += 1.0) {
    for (float x = -2.0; x <= 2.0; x += 1.0) {
      vec3 c = texture2D(tex, uv + vec2(x, y) * texelSize).rgb;
      float lum = luminance(c);
      mean += lum;
      meanSq += lum * lum;
      count += 1.0;
    }
  }

  mean /= count;
  meanSq /= count;

  return meanSq - mean * mean; // Variance = E[X^2] - E[X]^2
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Local variance (noise level) in each frame
  float varA = localVarianceL(u_textureA, v_texCoord, texelSize);
  float varB = localVarianceL(u_textureB, v_texCoord, texelSize);

  // Temporal difference (frame-to-frame change)
  vec3 diff = colorA.rgb - colorB.rgb;
  float temporalDiff = length(diff);

  // If variance is similar but temporal diff is high -> temporal noise
  // If variance is high but temporal diff is low -> static noise (like sensor noise)

  float avgVar = (varA + varB) * 0.5;

  // Temporal noise indicator (changes between frames)
  float temporalNoise = temporalDiff / max(sqrt(avgVar) * 2.0, 0.01);
  temporalNoise *= u_amplification;
  temporalNoise = clamp(temporalNoise, 0.0, 1.0);

  // Static noise indicator (consistent in both frames)
  float staticNoise = avgVar * u_amplification * 100.0;
  staticNoise = clamp(staticNoise, 0.0, 1.0);

  // Apply threshold
  if (temporalNoise < u_threshold) temporalNoise = 0.0;
  if (staticNoise < u_threshold) staticNoise = 0.0;

  // Visualize: red = temporal noise, blue = static noise
  vec3 noiseVis = vec3(0.0);
  noiseVis.r = temporalNoise;  // Temporal noise (bad for video)
  noiseVis.b = staticNoise;    // Static noise (sensor/compression)
  noiseVis.g = min(temporalNoise, staticNoise) * 0.5; // Both present

  // Blend with original
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, noiseVis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-007b: Noise Variance Map
   */
  'analysis-noise-variance': {
    name: 'analysis-noise-variance',
    label: 'Noise Variance Map',
    category: 'video',
    description: 'Spatial noise variance visualization across the image',
    fragment: `${COMPARISON_COMMON}

float localVariance(sampler2D tex, vec2 uv, vec2 texelSize, float radius) {
  vec3 mean = vec3(0.0);
  vec3 meanSq = vec3(0.0);
  float count = 0.0;

  for (float y = -4.0; y <= 4.0; y += 1.0) {
    if (abs(y) > radius) continue;
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      if (abs(x) > radius) continue;

      vec3 c = texture2D(tex, uv + vec2(x, y) * texelSize).rgb;
      mean += c;
      meanSq += c * c;
      count += 1.0;
    }
  }

  mean /= count;
  meanSq /= count;

  vec3 variance = meanSq - mean * mean;
  return (variance.r + variance.g + variance.b) / 3.0;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  float radius = u_blockSize * 0.25;

  // Variance in both frames
  float varA = localVariance(u_textureA, v_texCoord, texelSize, radius);
  float varB = localVariance(u_textureB, v_texCoord, texelSize, radius);

  // Variance difference
  float varDiff = abs(varA - varB);

  // Scale and amplify
  float noiseLevel = sqrt(varA + varB) * u_amplification * 20.0;
  float noiseDiff = varDiff * u_amplification * 100.0;

  noiseLevel = clamp(noiseLevel, 0.0, 1.0);
  noiseDiff = clamp(noiseDiff, 0.0, 1.0);

  // Apply threshold
  if (noiseLevel < u_threshold) noiseLevel *= 0.2;
  if (noiseDiff < u_threshold) noiseDiff *= 0.2;

  // Visualize: brightness = noise level, color = difference
  vec3 vis = heatmapVis(noiseLevel);
  vis = mix(vis, vec3(1.0, 0.0, 1.0), noiseDiff); // Purple tint where different

  vec3 original = mix(sampleTextureA(v_texCoord).rgb, sampleTextureB(v_texCoord).rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-008: Frame Difference Accumulator
   * Note: True accumulation requires multiple passes/frame buffer
   * This simulates accumulation effect using spatial integration
   */
  'analysis-diff-accumulator': {
    name: 'analysis-diff-accumulator',
    label: 'Difference Accumulator',
    category: 'video',
    description: 'Accumulated motion history - any change visualization',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Current frame difference
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float diffMag = (diff.r + diff.g + diff.b) / 3.0;

  // Apply amplification
  diffMag *= u_amplification;
  diffMag = clamp(diffMag, 0.0, 1.0);

  // Apply threshold
  if (diffMag < u_threshold) {
    diffMag = 0.0;
  }

  // MAX accumulation mode simulation
  // Shows any difference that exists (accumulated effect)
  // In a real accumulator, this would persist across frames

  // Visualize with motion trail effect
  vec3 vis = vec3(0.0);

  // High difference = bright yellow/orange (recent change)
  // Medium = cyan/blue (older changes would appear here)
  if (diffMag > 0.5) {
    vis = vec3(1.0, 0.8, 0.2); // Bright for strong motion
  } else if (diffMag > 0.2) {
    vis = vec3(0.0, 0.8, 1.0) * (diffMag * 2.0); // Cyan for moderate
  } else if (diffMag > 0.0) {
    vis = vec3(0.2, 0.4, 0.8) * (diffMag * 5.0); // Blue for slight
  }

  // Blend with darkened original
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5) * 0.3;
  vec3 result = max(original, vis);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-008b: Difference Accumulator - Average Mode
   */
  'analysis-diff-accumulator-avg': {
    name: 'analysis-diff-accumulator-avg',
    label: 'Diff Accumulator (Avg)',
    category: 'video',
    description: 'Averaged motion history - frequent changes visualization',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Sample differences across a spatial window
  // This simulates temporal averaging by using spatial coherence
  float avgDiff = 0.0;
  float maxDiff = 0.0;

  float window = u_blockSize;

  for (float y = -4.0; y <= 4.0; y += 1.0) {
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      vec2 offset = vec2(x, y) * texelSize * (window * 0.25);
      vec3 a = texture2D(u_textureA, v_texCoord + offset).rgb;
      vec3 b = texture2D(u_textureB, v_texCoord + offset).rgb;

      float d = length(a - b);
      avgDiff += d;
      maxDiff = max(maxDiff, d);
    }
  }

  avgDiff /= 81.0;

  // Apply amplification
  avgDiff *= u_amplification;
  maxDiff *= u_amplification;

  // Apply threshold
  if (avgDiff < u_threshold) avgDiff = 0.0;
  if (maxDiff < u_threshold * 2.0) maxDiff = 0.0;

  // AVERAGE mode: Show where changes happen frequently
  avgDiff = clamp(avgDiff, 0.0, 1.0);
  maxDiff = clamp(maxDiff, 0.0, 1.0);

  // Visualize
  // Green channel = average (consistent motion)
  // Red channel = max (any motion)
  vec3 vis = vec3(maxDiff * 0.5, avgDiff, avgDiff * 0.3);

  // Apply heatmap to average
  vec3 heat = heatmapVis(avgDiff);
  vis = mix(vis, heat, 0.7);

  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5) * 0.2;
  vec3 result = max(original, vis);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  /**
   * ANALYSIS-008c: Motion History Image
   */
  'analysis-motion-history': {
    name: 'analysis-motion-history',
    label: 'Motion History',
    category: 'video',
    description: 'Motion history visualization with decay simulation',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Current motion
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float motion = (diff.r + diff.g + diff.b) / 3.0;
  motion *= u_amplification * 2.0;

  // Simulate motion history by looking at surrounding pixels
  // (approximation of temporal accumulation)
  float history = 0.0;
  float decayRate = 0.9;

  for (float ring = 1.0; ring <= 4.0; ring += 1.0) {
    float weight = pow(decayRate, ring);
    float ringSum = 0.0;
    float count = 0.0;

    for (float angle = 0.0; angle < 6.28; angle += 0.785) {
      vec2 offset = vec2(cos(angle), sin(angle)) * ring * texelSize * u_blockSize;
      vec3 a = texture2D(u_textureA, v_texCoord + offset).rgb;
      vec3 b = texture2D(u_textureB, v_texCoord + offset).rgb;
      ringSum += length(a - b);
      count += 1.0;
    }

    history += (ringSum / count) * weight;
  }

  history *= u_amplification;

  // Apply threshold
  if (motion < u_threshold) motion = 0.0;
  if (history < u_threshold * 0.5) history *= 0.1;

  motion = clamp(motion, 0.0, 1.0);
  history = clamp(history, 0.0, 1.0);

  // Visualize: current motion = bright, history = fading trail
  vec3 vis = vec3(0.0);

  // History as blue-cyan trail
  vis += vec3(0.2, 0.6, 1.0) * history;

  // Current motion as bright white/yellow
  vis += vec3(1.0, 1.0, 0.8) * motion;

  vis = clamp(vis, 0.0, 1.0);

  // Dark background
  vec3 bg = mix(colorA.rgb, colorB.rgb, 0.5) * 0.15;
  vec3 result = max(bg, vis);

  gl_FragColor = vec4(result, 1.0);
}`
  }
}

export const ANALYSIS_VARIANTS = Object.keys(ANALYSIS_SHADERS)
