/**
 * Professional Tool Shaders
 * 6 modes: anaglyph, checkerboard, onion skin, loupe, frequency split, mask
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

export const PROFESSIONAL_SHADERS: Record<string, ComparisonShader> = {
  'pro-anaglyph': {
    name: 'pro-anaglyph',
    label: 'Anaglyph 3D',
    category: 'professional',
    description: 'Red/cyan stereo view for alignment checking',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Classic red-cyan anaglyph
  // Left eye (A) = red channel, Right eye (B) = green + blue channels
  float lumA = luminance(colorA.rgb);
  float lumB = luminance(colorB.rgb);

  vec3 anaglyph = vec3(
    lumA,        // Red from A
    lumB,        // Green from B
    lumB         // Blue from B
  );

  // Blend with original based on opacity
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = mix(original, anaglyph, u_opacity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'pro-checkerboard': {
    name: 'pro-checkerboard',
    label: 'Checkerboard',
    category: 'professional',
    description: 'Alternating tiles from A and B for registration alignment',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Checker size from uniform (default 32 pixels)
  float checkerSize = max(8.0, u_checkerSize);

  // Calculate checker coordinates
  vec2 checkerCoord = floor(v_texCoord * u_resolution / checkerSize);

  // Alternating pattern
  float checker = mod(checkerCoord.x + checkerCoord.y, 2.0);

  // Select A or B based on checker
  vec3 vis = mix(colorA.rgb, colorB.rgb, checker);

  // Optional: highlight checker boundaries
  vec2 checkerLocal = fract(v_texCoord * u_resolution / checkerSize);
  float boundary = step(0.95, max(checkerLocal.x, checkerLocal.y));
  boundary = max(boundary, step(checkerLocal.x, 0.05));
  boundary = max(boundary, step(checkerLocal.y, 0.05));

  // Add subtle boundary line
  vis = mix(vis, vec3(0.5), boundary * 0.3 * u_opacity);

  gl_FragColor = vec4(vis, 1.0);
}`
  },

  'pro-onion': {
    name: 'pro-onion',
    label: 'Onion Skin',
    category: 'professional',
    description: 'Semi-transparent overlay for animation/motion comparison',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Onion skin: show A as base, B as semi-transparent overlay
  // u_opacity controls the overlay opacity

  // Color coding: A in normal color, B tinted
  vec3 baseA = colorA.rgb;

  // Tint B with a color (cyan/blue) to distinguish
  vec3 tintedB = colorB.rgb * vec3(0.5, 1.0, 1.0);

  // Blend B over A
  vec3 result = mix(baseA, tintedB, u_opacity * 0.7);

  // Also show edges of B more prominently
  vec2 texelSize = 1.0 / u_resolution;
  float edgeB = edgeMagnitude(u_textureB, v_texCoord, texelSize);
  edgeB = clamp(edgeB * 3.0, 0.0, 1.0);

  // Overlay B edges in distinct color
  result = mix(result, vec3(1.0, 0.3, 0.3), edgeB * u_opacity * 0.5);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'pro-loupe': {
    name: 'pro-loupe',
    label: 'Wipe with Loupe',
    category: 'professional',
    description: 'Magnified view follows cursor for detail inspection',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Mouse position (0-1 range)
  vec2 mousePos = u_mouse;

  // Loupe parameters
  float loupeRadius = u_loupeSize / min(u_resolution.x, u_resolution.y);
  float zoom = u_loupeZoom;

  // Distance from mouse
  vec2 toMouse = v_texCoord - mousePos;
  float dist = length(toMouse);

  vec3 result;

  if (dist < loupeRadius) {
    // Inside loupe - show magnified view
    vec2 zoomedUV = mousePos + toMouse / zoom;

    // Clamp to valid UV range
    zoomedUV = clamp(zoomedUV, 0.0, 1.0);

    // Show both A and B split in loupe
    vec4 zoomedA = texture2D(u_textureA, zoomedUV);
    vec4 zoomedB = texture2D(u_textureB, zoomedUV);

    // Split loupe horizontally (A left, B right)
    if (toMouse.x < 0.0) {
      result = zoomedA.rgb;
    } else {
      result = zoomedB.rgb;
    }

    // Draw loupe border
    float borderWidth = 0.005;
    if (dist > loupeRadius - borderWidth) {
      result = vec3(1.0, 1.0, 1.0);
    }

    // Draw center divider
    if (abs(toMouse.x) < 0.002) {
      result = vec3(0.8, 0.8, 0.0);
    }
  } else {
    // Outside loupe - show wipe comparison based on mouse X
    float wipePos = mousePos.x;

    if (v_texCoord.x < wipePos) {
      result = colorA.rgb;
    } else {
      result = colorB.rgb;
    }

    // Draw wipe line
    if (abs(v_texCoord.x - wipePos) < 0.002) {
      result = vec3(1.0, 1.0, 0.0);
    }
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'pro-frequency': {
    name: 'pro-frequency',
    label: 'Frequency Split',
    category: 'professional',
    description: 'Low frequencies from A, high frequencies from B (or vice versa)',
    fragment: `${COMPARISON_COMMON}

#define BLUR_RADIUS 5.0

// Simple blur for low frequency extraction - fixed 11x11 kernel
vec3 blurFixed(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 sum = vec3(0.0);
  float count = 0.0;

  for (float y = -5.0; y <= 5.0; y += 1.0) {
    for (float x = -5.0; x <= 5.0; x += 1.0) {
      float weight = 1.0 - length(vec2(x, y)) / (BLUR_RADIUS * 1.414);
      weight = max(0.0, weight);
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb * weight;
      count += weight;
    }
  }

  return sum / count;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Extract low frequency (blur) and high frequency (original - blur)
  vec3 lowFreqA = blurFixed(u_textureA, v_texCoord, texelSize);
  vec3 lowFreqB = blurFixed(u_textureB, v_texCoord, texelSize);

  vec3 highFreqA = colorA.rgb - lowFreqA + 0.5;
  vec3 highFreqB = colorB.rgb - lowFreqB + 0.5;

  // Combine: low frequency from A, high frequency from B
  // u_opacity controls the blend direction
  vec3 result;
  if (u_opacity > 0.5) {
    // Low from A, High from B
    result = lowFreqA + (highFreqB - 0.5);
  } else {
    // Low from B, High from A
    result = lowFreqB + (highFreqA - 0.5);
  }

  result = clamp(result, 0.0, 1.0);

  // Add amplification to high frequencies for visibility
  vec3 highFreqDiff = abs(highFreqA - highFreqB) * u_amplification;
  result = mix(result, highFreqDiff, 0.3);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  'pro-mask': {
    name: 'pro-mask',
    label: 'Difference Mask',
    category: 'professional',
    description: 'Use difference as alpha mask, showing original underneath',
    fragment: `${COMPARISON_COMMON}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Calculate difference for mask
  vec3 diff = abs(colorA.rgb - colorB.rgb);
  float mask = (diff.r + diff.g + diff.b) / 3.0;

  // Apply amplification and threshold
  mask = mask * u_amplification;
  mask = smoothstep(u_threshold, u_threshold + 0.1, mask);

  // Show differences highlighted, original elsewhere
  vec3 original = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 highlighted = heatmapVis(mask);

  // Mask: show highlight where different, original where same
  vec3 result = mix(original, highlighted, mask * u_opacity);

  // Also darken non-different areas slightly to emphasize differences
  result = mix(result * 0.7, result, mask);

  gl_FragColor = vec4(result, 1.0);
}`
  }
}

export const PROFESSIONAL_VARIANTS = Object.keys(PROFESSIONAL_SHADERS)
