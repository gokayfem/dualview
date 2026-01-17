/**
 * Video-Specific Shaders
 * 4 modes: temporal difference, motion vectors, flicker detection, frame blend
 * Note: Some of these work best with video content and may need frame history
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

export const VIDEO_SHADERS: Record<string, ComparisonShader> = {
  'video-temporal': {
    name: 'video-temporal',
    label: 'Temporal Difference',
    category: 'video',
    description: 'Frame-to-frame change visualization between A and B',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // For video, A and B represent different frames or sources
  // Calculate temporal difference
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float motion = (diff.r + diff.g + diff.b) / 3.0;

  // Apply amplification
  motion = motion * u_amplification;
  motion = clamp(motion, 0.0, 1.0);

  // Apply threshold (filter out noise)
  if (motion < u_threshold) {
    motion = 0.0;
  }

  // Visualize motion areas
  // White for high motion, transparent for static areas
  vec3 motionVis = vec3(motion);

  // Overlay on mixed original
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);

  // Color code: static = original, motion = highlighted
  vec3 result = mix(original, vec3(1.0, 0.5, 0.0), motion * u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'video-motion': {
    name: 'video-motion',
    label: 'Motion Vectors',
    category: 'video',
    description: 'Approximate optical flow visualization',
    fragment: `${COMPARISON_COMMON}

#define BLOCK_SIZE 8.0
#define SEARCH_RANGE 4.0

// Simple block matching for motion estimation - fixed loop bounds for WebGL 1.0
vec2 estimateMotion(vec2 uv, vec2 texelSize) {
  vec2 bestOffset = vec2(0.0);
  float bestMatch = 1000.0;

  // Get reference block from A (8x8 block)
  vec3 refBlock = vec3(0.0);
  for (float by = 0.0; by < 8.0; by += 1.0) {
    for (float bx = 0.0; bx < 8.0; bx += 1.0) {
      vec2 offset = vec2(bx, by) * texelSize;
      refBlock += texture2D(u_textureA, uv + offset).rgb;
    }
  }
  refBlock /= 64.0;

  // Search in B for best match (search range -4 to +4)
  for (float sy = -4.0; sy <= 4.0; sy += 1.0) {
    for (float sx = -4.0; sx <= 4.0; sx += 1.0) {
      vec2 searchOffset = vec2(sx, sy) * texelSize;

      vec3 searchBlock = vec3(0.0);
      for (float by = 0.0; by < 8.0; by += 1.0) {
        for (float bx = 0.0; bx < 8.0; bx += 1.0) {
          vec2 offset = vec2(bx, by) * texelSize;
          searchBlock += texture2D(u_textureB, uv + searchOffset + offset).rgb;
        }
      }
      searchBlock /= 64.0;

      float diff = length(refBlock - searchBlock);
      if (diff < bestMatch) {
        bestMatch = diff;
        bestOffset = vec2(sx, sy);
      }
    }
  }

  return bestOffset;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Estimate motion at this pixel
  vec2 motion = estimateMotion(v_texCoord, texelSize);

  // Normalize motion for visualization
  float motionMag = length(motion) / BLOCK_SIZE;
  float motionDir = atan(motion.y, motion.x);

  // Apply threshold
  if (motionMag < u_threshold) {
    motionMag = 0.0;
  }

  // Visualize: direction as hue, magnitude as saturation/brightness
  vec3 vis;
  if (motionMag > 0.01) {
    // Direction to hue (0-1)
    float hue = (motionDir + 3.14159) / (2.0 * 3.14159);
    vis = hueWheelVis(hue) * motionMag * u_amplification;
  } else {
    vis = vec3(0.1);
  }

  // Show original underneath if opacity < 1
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, vis, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'video-flicker': {
    name: 'video-flicker',
    label: 'Flicker Detection',
    category: 'video',
    description: 'Highlight pixels that change rapidly (potential flicker)',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Calculate luminance
  float lumA = luminance(colorA.rgb);
  float lumB = luminance(colorB.rgb);

  // Flicker is detected as rapid luminance changes
  float lumDiff = abs(lumA - lumB);

  // High-frequency changes indicate flicker
  // Weight by the absolute luminance (flicker more visible in bright areas)
  float avgLum = (lumA + lumB) / 2.0;
  float flickerIntensity = lumDiff * (0.5 + avgLum * 0.5);

  // Apply amplification
  flickerIntensity = flickerIntensity * u_amplification * 2.0;
  flickerIntensity = clamp(flickerIntensity, 0.0, 1.0);

  // Apply threshold
  if (flickerIntensity < u_threshold) {
    flickerIntensity = 0.0;
  }

  // Visualize flicker areas (pulsing red for problematic areas)
  float pulse = sin(u_time * 10.0) * 0.5 + 0.5;
  vec3 flickerColor = vec3(1.0, 0.2, 0.0) * (0.7 + pulse * 0.3);

  // Overlay flicker highlight
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, flickerColor, flickerIntensity * u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'video-blend': {
    name: 'video-blend',
    label: 'Frame Blend',
    category: 'video',
    description: 'Blend frames for motion blur analysis and smoothness check',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Simple frame blend with adjustable weighting
  // u_opacity controls the blend ratio

  // Various blend modes based on amplification setting
  vec3 result;

  float blendMode = floor(u_amplification / 25.0); // 0-3 modes

  if (blendMode < 1.0) {
    // Simple average blend
    result = mix(colorA.rgb, colorB.rgb, u_opacity);
  } else if (blendMode < 2.0) {
    // Additive blend (shows combined motion)
    result = (colorA.rgb + colorB.rgb) * 0.5;
    result = mix(colorA.rgb, result, u_opacity);
  } else if (blendMode < 3.0) {
    // Maximum blend (shows brightest of both)
    result = max(colorA.rgb, colorB.rgb);
    result = mix(colorA.rgb, result, u_opacity);
  } else {
    // Difference highlight blend
    vec3 diff = abs(colorA.rgb - colorB.rgb);
    vec3 avg = (colorA.rgb + colorB.rgb) * 0.5;
    result = avg + diff * 0.5;
    result = mix(colorA.rgb, result, u_opacity);
  }

  // Show motion trails by keeping brighter values
  // This helps visualize temporal smoothness
  float lumA = luminance(colorA.rgb);
  float lumB = luminance(colorB.rgb);
  float lumResult = luminance(result);

  // Highlight areas where motion is occurring
  float motionIndicator = abs(lumA - lumB) * u_amplification * 0.1;
  motionIndicator = clamp(motionIndicator, 0.0, 1.0);

  // Add subtle motion indicator
  result = mix(result, result + vec3(0.1, 0.05, 0.0), motionIndicator);
  result = clamp(result, 0.0, 1.0);

  gl_FragColor = vec4(result, 1.0);
}`
  }
}

export const VIDEO_VARIANTS = Object.keys(VIDEO_SHADERS)
