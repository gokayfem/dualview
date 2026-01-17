/**
 * WEBGL-012: Perceptual Importance Weighting Shaders
 * Saliency detection, edge-based weighting, and weighted SSIM
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

/**
 * Saliency-based importance map
 * Combines edge detection, color contrast, and center bias for visual importance
 */
const WEIGHT_SALIENCY: ComparisonShader = {
  name: 'weight-saliency',
  label: 'Saliency Map',
  category: 'weighting',
  description: 'Visual saliency-based importance weighting combining edges, color contrast, and center bias',
  fragment: `${COMPARISON_COMMON}

// Compute saliency for a single pixel
float computeSaliency(vec2 uv) {
  vec2 texel = 1.0 / u_resolution;

  // Sample center pixel
  vec3 center = texture2D(u_textureA, uv).rgb;

  // Edge detection using Sobel
  float sobelX = 0.0;
  float sobelY = 0.0;

  // 3x3 Sobel kernel
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      vec3 sample = texture2D(u_textureA, uv + offset).rgb;
      float lum = dot(sample, vec3(0.299, 0.587, 0.114));

      // Sobel weights
      float wx = float(x) * (y == 0 ? 2.0 : 1.0);
      float wy = float(y) * (x == 0 ? 2.0 : 1.0);

      sobelX += lum * wx;
      sobelY += lum * wy;
    }
  }
  float edgeMagnitude = sqrt(sobelX * sobelX + sobelY * sobelY);

  // Color contrast (local variance in color)
  float colorContrast = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      vec3 sample = texture2D(u_textureA, uv + offset).rgb;
      colorContrast += length(sample - center);
    }
  }
  colorContrast /= 8.0;

  // Center bias (Gaussian falloff from center)
  vec2 centerDist = uv - vec2(0.5);
  float centerBias = exp(-dot(centerDist, centerDist) * 2.0);

  // Combine factors with weighting
  float saliency = edgeMagnitude * 0.5 + colorContrast * 0.3 + centerBias * 0.2;

  return clamp(saliency * u_amplification, 0.0, 1.0);
}

void main() {
  float saliency = computeSaliency(v_texCoord);

  // Visualize as heatmap
  vec3 color = heatmap(saliency);

  gl_FragColor = vec4(color, 1.0);
}
`
}

/**
 * Edge-based importance weighting
 * Higher weight for edges and high-frequency detail
 */
const WEIGHT_EDGE: ComparisonShader = {
  name: 'weight-edge',
  label: 'Edge Importance',
  category: 'weighting',
  description: 'Edge-based importance weighting for detail-sensitive comparison',
  fragment: `${COMPARISON_COMMON}

void main() {
  vec2 texel = 1.0 / u_resolution;

  // Multi-scale edge detection
  float edgeSum = 0.0;

  // Scale 1: Fine detail
  {
    float gx = 0.0, gy = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y)) * texel;
        float lum = getLuminance(texture2D(u_textureA, v_texCoord + offset).rgb);
        gx += lum * float(x) * (y == 0 ? 2.0 : 1.0);
        gy += lum * float(y) * (x == 0 ? 2.0 : 1.0);
      }
    }
    edgeSum += sqrt(gx * gx + gy * gy) * 0.5;
  }

  // Scale 2: Medium detail
  {
    float gx = 0.0, gy = 0.0;
    for (int y = -2; y <= 2; y += 2) {
      for (int x = -2; x <= 2; x += 2) {
        vec2 offset = vec2(float(x), float(y)) * texel;
        float lum = getLuminance(texture2D(u_textureA, v_texCoord + offset).rgb);
        gx += lum * float(x / 2) * (y == 0 ? 2.0 : 1.0);
        gy += lum * float(y / 2) * (x == 0 ? 2.0 : 1.0);
      }
    }
    edgeSum += sqrt(gx * gx + gy * gy) * 0.3;
  }

  // Apply threshold and amplification
  float weight = clamp(edgeSum * u_amplification, 0.0, 1.0);

  // Get difference between A and B
  vec3 colorA = texture2D(u_textureA, v_texCoord).rgb;
  vec3 colorB = texture2D(u_textureB, v_texCoord).rgb;
  vec3 diff = abs(colorA - colorB);
  float diffMag = length(diff);

  // Weighted difference
  float weightedDiff = diffMag * weight;

  // Visualize: show weight map with weighted difference overlay
  vec3 weightColor = vec3(weight);
  vec3 diffColor = heatmap(weightedDiff * u_amplification);

  // Mix based on threshold (show weight map below threshold, diff above)
  vec3 finalColor = mix(weightColor, diffColor, step(u_threshold, weight));

  gl_FragColor = vec4(finalColor, 1.0);
}
`
}

/**
 * Weighted SSIM visualization
 * SSIM weighted by perceptual importance
 */
const WEIGHT_SSIM: ComparisonShader = {
  name: 'weight-ssim',
  label: 'Weighted SSIM',
  category: 'weighting',
  description: 'Structural similarity weighted by visual importance',
  fragment: `${COMPARISON_COMMON}

// Compute importance weight at pixel
float getImportanceWeight(vec2 uv) {
  vec2 texel = 1.0 / u_resolution;

  // Edge magnitude
  float gx = 0.0, gy = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      float lum = getLuminance(texture2D(u_textureA, uv + offset).rgb);
      gx += lum * float(x) * (y == 0 ? 2.0 : 1.0);
      gy += lum * float(y) * (x == 0 ? 2.0 : 1.0);
    }
  }
  float edgeMag = sqrt(gx * gx + gy * gy);

  // Center bias
  vec2 centerDist = uv - vec2(0.5);
  float centerBias = exp(-dot(centerDist, centerDist) * 2.0);

  // Combine with configurable weights (using threshold and opacity as weight params)
  float edgeWeight = u_threshold * 10.0; // Scale threshold to reasonable range
  float centerWeight = u_opacity;

  return clamp(edgeMag * edgeWeight + centerBias * centerWeight, 0.0, 1.0);
}

void main() {
  vec2 texel = 1.0 / u_resolution;
  int radius = 4;

  // Compute local SSIM
  float muA = 0.0, muB = 0.0;
  float sigmaA2 = 0.0, sigmaB2 = 0.0, sigmaAB = 0.0;
  float count = 0.0;

  // First pass: compute means
  for (int y = -4; y <= 4; y++) {
    for (int x = -4; x <= 4; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      float lumA = getLuminance(texture2D(u_textureA, v_texCoord + offset).rgb);
      float lumB = getLuminance(texture2D(u_textureB, v_texCoord + offset).rgb);
      muA += lumA;
      muB += lumB;
      count += 1.0;
    }
  }
  muA /= count;
  muB /= count;

  // Second pass: compute variances and covariance
  for (int y = -4; y <= 4; y++) {
    for (int x = -4; x <= 4; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      float lumA = getLuminance(texture2D(u_textureA, v_texCoord + offset).rgb);
      float lumB = getLuminance(texture2D(u_textureB, v_texCoord + offset).rgb);
      float dA = lumA - muA;
      float dB = lumB - muB;
      sigmaA2 += dA * dA;
      sigmaB2 += dB * dB;
      sigmaAB += dA * dB;
    }
  }
  sigmaA2 /= count;
  sigmaB2 /= count;
  sigmaAB /= count;

  // SSIM formula constants
  float C1 = 0.0001;
  float C2 = 0.0009;

  float ssim = ((2.0 * muA * muB + C1) * (2.0 * sigmaAB + C2)) /
               ((muA * muA + muB * muB + C1) * (sigmaA2 + sigmaB2 + C2));

  // Get importance weight
  float weight = getImportanceWeight(v_texCoord);

  // Weighted SSIM error (1 - SSIM, weighted)
  float ssimError = (1.0 - ssim) * weight;

  // Visualize
  // Top half: weighted SSIM error
  // Bottom half: importance weight map
  vec3 color;
  if (v_texCoord.y < 0.5) {
    // Show importance weights
    color = vec3(weight);
  } else {
    // Show weighted SSIM error as heatmap
    color = heatmap(ssimError * u_amplification);
  }

  // Full visualization: blend SSIM with weight indication
  float ssimVis = 1.0 - ssim;
  vec3 ssimColor = heatmap(ssimVis * u_amplification);

  // Tint by importance weight
  color = mix(ssimColor * 0.5, ssimColor, weight);

  gl_FragColor = vec4(color, 1.0);
}
`
}

// Export all weighting shaders
export const WEIGHTING_SHADERS: Record<string, ComparisonShader> = {
  'weight-saliency': WEIGHT_SALIENCY,
  'weight-edge': WEIGHT_EDGE,
  'weight-ssim': WEIGHT_SSIM
}

export const WEIGHTING_VARIANTS = [
  'weight-saliency',
  'weight-edge',
  'weight-ssim'
]
