/**
 * Structural Analysis Shaders
 * 5 modes: ssim, edge, gradient, contrast, block
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

export const STRUCTURAL_SHADERS: Record<string, ComparisonShader> = {
  'struct-ssim': {
    name: 'struct-ssim',
    label: 'SSIM Map',
    category: 'structural',
    description: 'Local structural similarity - industry standard quality metric',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Calculate local SSIM (simplified for real-time, uses fixed 9x9 kernel)
  float ssim = ssimLocal(v_texCoord, texelSize);

  // SSIM is 0-1, where 1 is identical
  // Invert so differences show up bright
  float diff = 1.0 - ssim;

  // Apply amplification
  diff = diff * u_amplification;
  diff = clamp(diff, 0.0, 1.0);

  // Apply threshold
  if (diff < u_threshold) {
    diff = 0.0;
  }

  // Visualize with heatmap (red = different, blue = similar)
  vec3 vis = heatmapVis(diff);

  // Show original underneath if opacity < 1
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'struct-edge': {
    name: 'struct-edge',
    label: 'Edge Comparison',
    category: 'structural',
    description: 'Compare edges and contours using Sobel detection',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Get edge magnitude for both images
  float edgeA = edgeMagnitude(u_textureA, v_texCoord, texelSize);
  float edgeB = edgeMagnitude(u_textureB, v_texCoord, texelSize);

  // Calculate edge difference
  float edgeDiff = abs(edgeA - edgeB);

  // Apply amplification
  edgeDiff = edgeDiff * u_amplification * 2.0;
  edgeDiff = clamp(edgeDiff, 0.0, 1.0);

  // Apply threshold
  if (edgeDiff < u_threshold) {
    edgeDiff = 0.0;
  }

  // Create visualization showing edges from both
  // Red channel: edges only in A
  // Green channel: edges in both
  // Blue channel: edges only in B
  float edgeAOnly = max(0.0, edgeA - edgeB) * u_amplification;
  float edgeBoth = min(edgeA, edgeB) * u_amplification;
  float edgeBOnly = max(0.0, edgeB - edgeA) * u_amplification;

  vec3 vis = vec3(
    clamp(edgeAOnly, 0.0, 1.0),
    clamp(edgeBoth, 0.0, 1.0),
    clamp(edgeBOnly, 0.0, 1.0)
  );

  // Show original underneath if opacity < 1
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'struct-gradient': {
    name: 'struct-gradient',
    label: 'Gradient Difference',
    category: 'structural',
    description: 'Compare gradient magnitude and direction',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Get gradient (magnitude and direction) for both
  vec2 gradA = gradient(u_textureA, v_texCoord, texelSize);
  vec2 gradB = gradient(u_textureB, v_texCoord, texelSize);

  // Magnitude difference
  float magDiff = abs(gradA.x - gradB.x);

  // Direction difference (handle wrap-around at PI/-PI)
  float dirDiff = abs(gradA.y - gradB.y);
  dirDiff = min(dirDiff, 6.28318 - dirDiff); // 2*PI wrap
  dirDiff = dirDiff / 3.14159; // Normalize to 0-1

  // Combined difference (weighted)
  float combined = magDiff * 0.7 + dirDiff * 0.3;

  // Apply amplification
  combined = combined * u_amplification * 2.0;
  combined = clamp(combined, 0.0, 1.0);

  // Apply threshold
  if (combined < u_threshold) {
    combined = 0.0;
  }

  // Visualize: magnitude diff as brightness, direction diff as hue
  vec3 vis = heatmapVis(combined);

  // Show original underneath if opacity < 1
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'struct-contrast': {
    name: 'struct-contrast',
    label: 'Local Contrast',
    category: 'structural',
    description: 'Compare local contrast and detail levels',
    fragment: `${COMPARISON_COMMON}

#define CONTRAST_KERNEL_SIZE 49.0

// Calculate local contrast (standard deviation in neighborhood) - fixed 7x7 kernel
float localContrast(sampler2D tex, vec2 uv, vec2 texelSize) {
  float sum = 0.0;
  float sumSq = 0.0;

  for (float y = -3.0; y <= 3.0; y += 1.0) {
    for (float x = -3.0; x <= 3.0; x += 1.0) {
      float lum = luminance(texture2D(tex, uv + vec2(x, y) * texelSize).rgb);
      sum += lum;
      sumSq += lum * lum;
    }
  }

  float mean = sum / CONTRAST_KERNEL_SIZE;
  float variance = (sumSq / CONTRAST_KERNEL_SIZE) - (mean * mean);
  return sqrt(max(0.0, variance));
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Calculate local contrast for both images
  float contrastA = localContrast(u_textureA, v_texCoord, texelSize);
  float contrastB = localContrast(u_textureB, v_texCoord, texelSize);

  // Contrast difference
  float diff = abs(contrastA - contrastB);

  // Apply amplification
  diff = diff * u_amplification * 5.0;
  diff = clamp(diff, 0.0, 1.0);

  // Apply threshold
  if (diff < u_threshold) {
    diff = 0.0;
  }

  // Visualize with color coding
  // Red: A has more contrast, Blue: B has more contrast
  float direction = sign(contrastA - contrastB);
  vec3 vis;
  if (direction > 0.0) {
    vis = vec3(diff, 0.0, 0.0); // A sharper - red
  } else if (direction < 0.0) {
    vis = vec3(0.0, 0.0, diff); // B sharper - blue
  } else {
    vis = vec3(0.0, diff, 0.0); // Same - green
  }

  // Show original underneath if opacity < 1
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'struct-block': {
    name: 'struct-block',
    label: 'Block Difference',
    category: 'structural',
    description: 'Grid-based comparison for compression artifact detection',
    fragment: `${COMPARISON_COMMON}

void main() {
  // Block size from uniform (typically 8 or 16 for JPEG/video compression)
  float blockSize = max(4.0, u_blockSize);

  // Calculate block coordinates
  vec2 blockCoord = floor(v_texCoord * u_resolution / blockSize);
  vec2 blockUV = (blockCoord + 0.5) * blockSize / u_resolution;

  // Sample both images at block center
  vec4 colorA = texture2D(u_textureA, blockUV);
  vec4 colorB = texture2D(u_textureB, blockUV);

  // Calculate block average difference
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float diffMag = (diff.r + diff.g + diff.b) / 3.0;

  // Apply amplification
  diffMag = diffMag * u_amplification;
  diffMag = clamp(diffMag, 0.0, 1.0);

  // Apply threshold
  if (diffMag < u_threshold) {
    diffMag = 0.0;
  }

  // Draw block grid
  vec2 blockLocal = fract(v_texCoord * u_resolution / blockSize);
  float gridLine = step(0.95, max(blockLocal.x, blockLocal.y));

  // Visualize
  vec3 vis = heatmapVis(diffMag);

  // Add grid overlay
  vis = mix(vis, vec3(0.3), gridLine * 0.5);

  // Show original underneath if opacity < 1
  vec4 origA = sampleTextureA(v_texCoord);
  vec4 origB = sampleTextureB(v_texCoord);
  vec3 original = mix(origA.rgb, origB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  }
}

export const STRUCTURAL_VARIANTS = Object.keys(STRUCTURAL_SHADERS)
