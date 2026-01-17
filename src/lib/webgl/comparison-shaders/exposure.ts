/**
 * Exposure Analysis Shaders
 * SCOPE-004: False Color Exposure Map
 * SCOPE-005: Focus Peaking Overlay
 * SCOPE-006: Zebra Stripes Overlay
 * SCOPE-007: Zone System Overlay
 */

import { COMPARISON_COMMON, type ComparisonShader } from './common'

export const EXPOSURE_SHADERS: Record<string, ComparisonShader> = {
  // SCOPE-004: False Color Exposure Map
  // Map luminance to diagnostic colors for exposure analysis
  'exposure-false-color': {
    name: 'exposure-false-color',
    label: 'False Color',
    category: 'professional',
    description: 'Map luminance to diagnostic colors (broadcast safe, cinematic, custom)',
    fragment: `${COMPARISON_COMMON}

// False color mapping based on IRE levels
// Standard broadcast safe mapping
vec3 falseColorBroadcast(float luma) {
  // Clipped highlights (>100 IRE) - Magenta
  if (luma > 0.95) return vec3(1.0, 0.0, 1.0);
  // Hot (90-100 IRE) - Red
  if (luma > 0.85) return vec3(1.0, 0.0, 0.0);
  // Bright (70-90 IRE) - Yellow
  if (luma > 0.65) return vec3(1.0, 1.0, 0.0);
  // Mid-tones (35-70 IRE) - Green (safe skin tones)
  if (luma > 0.30) return vec3(0.0, 1.0, 0.0);
  // Low (18-35 IRE) - Cyan
  if (luma > 0.15) return vec3(0.0, 1.0, 1.0);
  // Dark (5-18 IRE) - Blue
  if (luma > 0.04) return vec3(0.0, 0.0, 1.0);
  // Crushed blacks (<5 IRE) - Purple
  return vec3(0.5, 0.0, 0.5);
}

// Cinematic mapping (wider tolerances)
vec3 falseColorCinematic(float luma) {
  // Clipped highlights - Magenta
  if (luma > 0.98) return vec3(1.0, 0.0, 1.0);
  // Hot - Red
  if (luma > 0.90) return vec3(1.0, 0.2, 0.0);
  // Warm highlights - Orange
  if (luma > 0.75) return vec3(1.0, 0.5, 0.0);
  // Bright - Yellow
  if (luma > 0.60) return vec3(1.0, 1.0, 0.0);
  // Mid-high - Yellow-green
  if (luma > 0.45) return vec3(0.7, 1.0, 0.0);
  // Mid-tones - Green
  if (luma > 0.25) return vec3(0.0, 1.0, 0.0);
  // Low - Cyan
  if (luma > 0.12) return vec3(0.0, 1.0, 1.0);
  // Dark - Blue
  if (luma > 0.05) return vec3(0.0, 0.4, 1.0);
  // Crushed - Purple
  return vec3(0.4, 0.0, 0.6);
}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  // Use mouse X to blend between A and B
  float blend = step(u_mouse.x, v_texCoord.x);
  vec3 color = mix(colorA.rgb, colorB.rgb, blend);

  // Calculate luminance using Rec. 709 coefficients
  float luma = luminance(color);

  // Use amplification to select preset (1-33: broadcast, 34-66: cinematic, 67-100: custom)
  vec3 falseColor;
  if (u_amplification < 34.0) {
    falseColor = falseColorBroadcast(luma);
  } else if (u_amplification < 67.0) {
    falseColor = falseColorCinematic(luma);
  } else {
    // Custom: use threshold to adjust sensitivity
    float adjustedLuma = luma * (1.0 + (u_threshold - 0.5) * 2.0);
    adjustedLuma = clamp(adjustedLuma, 0.0, 1.0);
    falseColor = falseColorBroadcast(adjustedLuma);
  }

  // Apply opacity to blend with original
  vec3 result = mix(color, falseColor, u_opacity);

  // Draw wipe line
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - u_mouse.x) < lineWidth) {
    result = vec3(1.0, 0.84, 0.0);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  // SCOPE-004: False Color with A/B comparison side by side
  'exposure-false-color-compare': {
    name: 'exposure-false-color-compare',
    label: 'False Color Compare',
    category: 'professional',
    description: 'Compare false color exposure between A and B sources',
    fragment: `${COMPARISON_COMMON}

vec3 falseColorMap(float luma) {
  if (luma > 0.95) return vec3(1.0, 0.0, 1.0);
  if (luma > 0.85) return vec3(1.0, 0.0, 0.0);
  if (luma > 0.65) return vec3(1.0, 1.0, 0.0);
  if (luma > 0.30) return vec3(0.0, 1.0, 0.0);
  if (luma > 0.15) return vec3(0.0, 1.0, 1.0);
  if (luma > 0.04) return vec3(0.0, 0.0, 1.0);
  return vec3(0.5, 0.0, 0.5);
}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  float lumaA = luminance(colorA.rgb);
  float lumaB = luminance(colorB.rgb);

  vec3 falseA = falseColorMap(lumaA);
  vec3 falseB = falseColorMap(lumaB);

  // Split view
  vec3 result;
  if (v_texCoord.x < 0.5) {
    result = mix(colorA.rgb, falseA, u_opacity);
  } else {
    result = mix(colorB.rgb, falseB, u_opacity);
  }

  // Center divider
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - 0.5) < lineWidth) {
    result = vec3(0.5);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  // SCOPE-005: Focus Peaking Overlay
  // Highlight in-focus edges with colored overlay
  'exposure-focus-peak': {
    name: 'exposure-focus-peak',
    label: 'Focus Peaking',
    category: 'professional',
    description: 'Highlight in-focus edges with configurable color overlay (P key)',
    fragment: `${COMPARISON_COMMON}

// High-pass filter using Laplacian kernel
float laplacian(vec2 uv, vec2 texelSize) {
  float center = luminance(sampleTextureA(uv).rgb);
  float top = luminance(sampleTextureA(uv + vec2(0.0, -texelSize.y)).rgb);
  float bottom = luminance(sampleTextureA(uv + vec2(0.0, texelSize.y)).rgb);
  float left = luminance(sampleTextureA(uv + vec2(-texelSize.x, 0.0)).rgb);
  float right = luminance(sampleTextureA(uv + vec2(texelSize.x, 0.0)).rgb);

  return abs(4.0 * center - top - bottom - left - right);
}

// Calculate edge strength using Sobel operator
float edgeStrength(vec2 uv, vec2 texelSize) {
  // Get luminance values for 3x3 kernel
  float tl = luminance(sampleTextureA(uv + vec2(-texelSize.x, -texelSize.y)).rgb);
  float t  = luminance(sampleTextureA(uv + vec2(0.0, -texelSize.y)).rgb);
  float tr = luminance(sampleTextureA(uv + vec2(texelSize.x, -texelSize.y)).rgb);
  float l  = luminance(sampleTextureA(uv + vec2(-texelSize.x, 0.0)).rgb);
  float r  = luminance(sampleTextureA(uv + vec2(texelSize.x, 0.0)).rgb);
  float bl = luminance(sampleTextureA(uv + vec2(-texelSize.x, texelSize.y)).rgb);
  float b  = luminance(sampleTextureA(uv + vec2(0.0, texelSize.y)).rgb);
  float br = luminance(sampleTextureA(uv + vec2(texelSize.x, texelSize.y)).rgb);

  // Sobel operators
  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

  return sqrt(gx*gx + gy*gy);
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Use mouse X to switch between A and B
  vec4 color;
  float edge;

  if (v_texCoord.x < u_mouse.x) {
    color = sampleTextureA(v_texCoord);
    // Calculate edge for texture A
    float tl = luminance(sampleTextureA(v_texCoord + vec2(-texelSize.x, -texelSize.y)).rgb);
    float t  = luminance(sampleTextureA(v_texCoord + vec2(0.0, -texelSize.y)).rgb);
    float tr = luminance(sampleTextureA(v_texCoord + vec2(texelSize.x, -texelSize.y)).rgb);
    float l  = luminance(sampleTextureA(v_texCoord + vec2(-texelSize.x, 0.0)).rgb);
    float r  = luminance(sampleTextureA(v_texCoord + vec2(texelSize.x, 0.0)).rgb);
    float bl = luminance(sampleTextureA(v_texCoord + vec2(-texelSize.x, texelSize.y)).rgb);
    float b  = luminance(sampleTextureA(v_texCoord + vec2(0.0, texelSize.y)).rgb);
    float br = luminance(sampleTextureA(v_texCoord + vec2(texelSize.x, texelSize.y)).rgb);
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    edge = sqrt(gx*gx + gy*gy);
  } else {
    color = sampleTextureB(v_texCoord);
    // Calculate edge for texture B
    float tl = luminance(sampleTextureB(v_texCoord + vec2(-texelSize.x, -texelSize.y)).rgb);
    float t  = luminance(sampleTextureB(v_texCoord + vec2(0.0, -texelSize.y)).rgb);
    float tr = luminance(sampleTextureB(v_texCoord + vec2(texelSize.x, -texelSize.y)).rgb);
    float l  = luminance(sampleTextureB(v_texCoord + vec2(-texelSize.x, 0.0)).rgb);
    float r  = luminance(sampleTextureB(v_texCoord + vec2(texelSize.x, 0.0)).rgb);
    float bl = luminance(sampleTextureB(v_texCoord + vec2(-texelSize.x, texelSize.y)).rgb);
    float b  = luminance(sampleTextureB(v_texCoord + vec2(0.0, texelSize.y)).rgb);
    float br = luminance(sampleTextureB(v_texCoord + vec2(texelSize.x, texelSize.y)).rgb);
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    edge = sqrt(gx*gx + gy*gy);
  }

  // Sensitivity controlled by threshold (0.1 = sensitive, 0.5 = strict)
  float sensitivity = 0.05 + u_threshold * 0.45;
  float peaking = step(sensitivity, edge);

  // Amplification controls color:
  // 1-20: Red, 21-40: Green, 41-60: Blue, 61-80: Yellow, 81-100: White
  vec3 peakColor;
  if (u_amplification < 21.0) {
    peakColor = vec3(1.0, 0.0, 0.0); // Red
  } else if (u_amplification < 41.0) {
    peakColor = vec3(0.0, 1.0, 0.0); // Green
  } else if (u_amplification < 61.0) {
    peakColor = vec3(0.0, 0.5, 1.0); // Blue
  } else if (u_amplification < 81.0) {
    peakColor = vec3(1.0, 1.0, 0.0); // Yellow
  } else {
    peakColor = vec3(1.0, 1.0, 1.0); // White
  }

  // Apply peaking overlay
  vec3 result = mix(color.rgb, peakColor, peaking * u_opacity);

  // Draw wipe line
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - u_mouse.x) < lineWidth) {
    result = vec3(1.0, 0.84, 0.0);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  // SCOPE-005: Focus Peaking Compare (A vs B)
  'exposure-focus-peak-compare': {
    name: 'exposure-focus-peak-compare',
    label: 'Focus Peak Compare',
    category: 'professional',
    description: 'Compare focus peaking between A and B sources',
    fragment: `${COMPARISON_COMMON}

float calcEdge(vec4 c, vec4 t, vec4 b, vec4 l, vec4 r, vec4 tl, vec4 tr, vec4 bl, vec4 br) {
  float gx = -luminance(tl.rgb) - 2.0*luminance(l.rgb) - luminance(bl.rgb) + luminance(tr.rgb) + 2.0*luminance(r.rgb) + luminance(br.rgb);
  float gy = -luminance(tl.rgb) - 2.0*luminance(t.rgb) - luminance(tr.rgb) + luminance(bl.rgb) + 2.0*luminance(b.rgb) + luminance(br.rgb);
  return sqrt(gx*gx + gy*gy);
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Sample A
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 tA  = sampleTextureA(v_texCoord + vec2(0.0, -texelSize.y));
  vec4 bA  = sampleTextureA(v_texCoord + vec2(0.0, texelSize.y));
  vec4 lA  = sampleTextureA(v_texCoord + vec2(-texelSize.x, 0.0));
  vec4 rA  = sampleTextureA(v_texCoord + vec2(texelSize.x, 0.0));
  vec4 tlA = sampleTextureA(v_texCoord + vec2(-texelSize.x, -texelSize.y));
  vec4 trA = sampleTextureA(v_texCoord + vec2(texelSize.x, -texelSize.y));
  vec4 blA = sampleTextureA(v_texCoord + vec2(-texelSize.x, texelSize.y));
  vec4 brA = sampleTextureA(v_texCoord + vec2(texelSize.x, texelSize.y));
  float edgeA = calcEdge(colorA, tA, bA, lA, rA, tlA, trA, blA, brA);

  // Sample B
  vec4 colorB = sampleTextureB(v_texCoord);
  vec4 tB  = sampleTextureB(v_texCoord + vec2(0.0, -texelSize.y));
  vec4 bB  = sampleTextureB(v_texCoord + vec2(0.0, texelSize.y));
  vec4 lB  = sampleTextureB(v_texCoord + vec2(-texelSize.x, 0.0));
  vec4 rB  = sampleTextureB(v_texCoord + vec2(texelSize.x, 0.0));
  vec4 tlB = sampleTextureB(v_texCoord + vec2(-texelSize.x, -texelSize.y));
  vec4 trB = sampleTextureB(v_texCoord + vec2(texelSize.x, -texelSize.y));
  vec4 blB = sampleTextureB(v_texCoord + vec2(-texelSize.x, texelSize.y));
  vec4 brB = sampleTextureB(v_texCoord + vec2(texelSize.x, texelSize.y));
  float edgeB = calcEdge(colorB, tB, bB, lB, rB, tlB, trB, blB, brB);

  float sensitivity = 0.05 + u_threshold * 0.45;
  float peakA = step(sensitivity, edgeA);
  float peakB = step(sensitivity, edgeB);

  // Orange for A, Cyan for B
  vec3 peakColorA = vec3(1.0, 0.5, 0.0);
  vec3 peakColorB = vec3(0.0, 1.0, 1.0);

  // Show both peaking overlays
  vec3 base = mix(colorA.rgb, colorB.rgb, 0.5);
  vec3 result = base;
  result = mix(result, peakColorA, peakA * u_opacity * 0.7);
  result = mix(result, peakColorB, peakB * u_opacity * 0.7);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  // SCOPE-006: Zebra Stripes Overlay
  // Animated diagonal stripes over exposure zones
  'exposure-zebra': {
    name: 'exposure-zebra',
    label: 'Zebra Stripes',
    category: 'professional',
    description: 'Animated diagonal stripes over exposure zones (Z key)',
    fragment: `${COMPARISON_COMMON}

// Generate diagonal stripe pattern
float stripe(vec2 uv, float angle, float frequency, float time) {
  float x = uv.x * cos(angle) + uv.y * sin(angle);
  return step(0.5, fract(x * frequency + time * 2.0));
}

void main() {
  // Use mouse X to blend between A and B
  float blend = step(u_mouse.x, v_texCoord.x);
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 color = mix(colorA.rgb, colorB.rgb, blend);

  float luma = luminance(color);

  // Amplification controls zebra level:
  // 1-33: 90% level, 34-66: 95% level, 67-100: 100% (clip only)
  float zebraLevel;
  if (u_amplification < 34.0) {
    zebraLevel = 0.85;
  } else if (u_amplification < 67.0) {
    zebraLevel = 0.92;
  } else {
    zebraLevel = 0.98;
  }

  // Threshold controls under-exposure zebra level
  float underLevel = u_threshold * 0.15; // 0-15% for crushed blacks

  // Generate stripes
  float stripePattern = stripe(v_texCoord * u_resolution, 0.785, 0.05, u_time);

  // Over-exposure zebras (red/white stripes)
  float overExposed = step(zebraLevel, luma);

  // Under-exposure zebras (blue/black stripes) if threshold > 0
  float underExposed = underLevel > 0.0 ? step(luma, underLevel) : 0.0;

  vec3 result = color;

  // Apply over-exposure zebras
  if (overExposed > 0.5) {
    vec3 zebraColor = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), stripePattern);
    result = mix(color, zebraColor, u_opacity);
  }

  // Apply under-exposure zebras
  if (underExposed > 0.5) {
    vec3 zebraColor = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, 0.2), stripePattern);
    result = mix(color, zebraColor, u_opacity);
  }

  // Draw wipe line
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - u_mouse.x) < lineWidth) {
    result = vec3(1.0, 0.84, 0.0);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  // SCOPE-006: Zebra Stripes Compare (A vs B)
  'exposure-zebra-compare': {
    name: 'exposure-zebra-compare',
    label: 'Zebra Compare',
    category: 'professional',
    description: 'Compare zebra stripes between A and B sources',
    fragment: `${COMPARISON_COMMON}

float stripe(vec2 uv, float angle, float frequency, float time) {
  float x = uv.x * cos(angle) + uv.y * sin(angle);
  return step(0.5, fract(x * frequency + time * 2.0));
}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  float lumaA = luminance(colorA.rgb);
  float lumaB = luminance(colorB.rgb);

  float zebraLevel = 0.92;
  float underLevel = u_threshold * 0.15;

  float stripePatternA = stripe(v_texCoord * u_resolution, 0.785, 0.05, u_time);
  float stripePatternB = stripe(v_texCoord * u_resolution, -0.785, 0.05, u_time);

  // Process A
  float overA = step(zebraLevel, lumaA);
  float underA = underLevel > 0.0 ? step(lumaA, underLevel) : 0.0;
  vec3 resultA = colorA.rgb;
  if (overA > 0.5) {
    vec3 zc = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.6), stripePatternA);
    resultA = mix(colorA.rgb, zc, u_opacity);
  }
  if (underA > 0.5) {
    vec3 zc = mix(vec3(0.0, 0.0, 0.8), vec3(0.2, 0.2, 0.4), stripePatternA);
    resultA = mix(colorA.rgb, zc, u_opacity);
  }

  // Process B
  float overB = step(zebraLevel, lumaB);
  float underB = underLevel > 0.0 ? step(lumaB, underLevel) : 0.0;
  vec3 resultB = colorB.rgb;
  if (overB > 0.5) {
    vec3 zc = mix(vec3(0.0, 1.0, 0.3), vec3(0.6, 1.0, 0.8), stripePatternB);
    resultB = mix(colorB.rgb, zc, u_opacity);
  }
  if (underB > 0.5) {
    vec3 zc = mix(vec3(0.0, 0.3, 1.0), vec3(0.2, 0.4, 0.6), stripePatternB);
    resultB = mix(colorB.rgb, zc, u_opacity);
  }

  // Split view
  vec3 result = v_texCoord.x < 0.5 ? resultA : resultB;

  // Center divider
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - 0.5) < lineWidth) {
    result = vec3(0.5);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  // SCOPE-007: Zone System Overlay
  // Ansel Adams 11 zone system visualization
  'exposure-zone-system': {
    name: 'exposure-zone-system',
    label: 'Zone System',
    category: 'professional',
    description: 'Ansel Adams zone system (Zones 0-X) with color coding',
    fragment: `${COMPARISON_COMMON}

// Zone System Colors - 11 zones from pure black (0) to pure white (X)
// Zone 0: Pure black (0%)
// Zone I: Near black (4%)
// Zone II: Dark tones with detail (8%)
// Zone III: Dark shadows (12%)
// Zone IV: Shadows with detail (18%)
// Zone V: Middle gray (18% gray card)
// Zone VI: Light skin, shadows on snow (36%)
// Zone VII: Light tones with texture (54%)
// Zone VIII: Whites with texture (72%)
// Zone IX: Near white (90%)
// Zone X: Pure white (100%)

vec3 zoneColor(int zone) {
  // Color-coded zones for easy identification
  if (zone == 0) return vec3(0.0, 0.0, 0.0);       // Pure black
  if (zone == 1) return vec3(0.15, 0.0, 0.3);     // Deep purple
  if (zone == 2) return vec3(0.0, 0.0, 0.5);       // Dark blue
  if (zone == 3) return vec3(0.0, 0.3, 0.6);       // Blue
  if (zone == 4) return vec3(0.0, 0.5, 0.5);       // Teal
  if (zone == 5) return vec3(0.0, 0.6, 0.2);       // Green (middle gray)
  if (zone == 6) return vec3(0.5, 0.7, 0.0);       // Yellow-green
  if (zone == 7) return vec3(0.8, 0.7, 0.0);       // Yellow
  if (zone == 8) return vec3(1.0, 0.5, 0.0);       // Orange
  if (zone == 9) return vec3(1.0, 0.2, 0.2);       // Red-orange
  return vec3(1.0, 0.0, 0.5);                       // Magenta (clipped)
}

int getZone(float luma) {
  // Map luminance to zones (non-linear, based on stops)
  if (luma < 0.004) return 0;   // Zone 0: <0.4%
  if (luma < 0.012) return 1;   // Zone I: 0.4-1.2%
  if (luma < 0.035) return 2;   // Zone II: 1.2-3.5%
  if (luma < 0.075) return 3;   // Zone III: 3.5-7.5%
  if (luma < 0.15) return 4;    // Zone IV: 7.5-15%
  if (luma < 0.27) return 5;    // Zone V: 15-27% (middle gray ~18%)
  if (luma < 0.45) return 6;    // Zone VI: 27-45%
  if (luma < 0.65) return 7;    // Zone VII: 45-65%
  if (luma < 0.82) return 8;    // Zone VIII: 65-82%
  if (luma < 0.95) return 9;    // Zone IX: 82-95%
  return 10;                     // Zone X: >95%
}

void main() {
  // Use mouse X to blend between A and B
  float blend = step(u_mouse.x, v_texCoord.x);
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);
  vec3 color = mix(colorA.rgb, colorB.rgb, blend);

  float luma = luminance(color);
  int zone = getZone(luma);

  vec3 zc = zoneColor(zone);

  // Blend zone color with original based on opacity
  vec3 result = mix(color, zc, u_opacity);

  // Draw wipe line
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - u_mouse.x) < lineWidth) {
    result = vec3(1.0, 0.84, 0.0);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  },

  // SCOPE-007: Zone System Compare (A vs B distribution)
  'exposure-zone-compare': {
    name: 'exposure-zone-compare',
    label: 'Zone Compare',
    category: 'professional',
    description: 'Compare zone system distributions between A and B',
    fragment: `${COMPARISON_COMMON}

vec3 zoneColor(int zone) {
  if (zone == 0) return vec3(0.0, 0.0, 0.0);
  if (zone == 1) return vec3(0.15, 0.0, 0.3);
  if (zone == 2) return vec3(0.0, 0.0, 0.5);
  if (zone == 3) return vec3(0.0, 0.3, 0.6);
  if (zone == 4) return vec3(0.0, 0.5, 0.5);
  if (zone == 5) return vec3(0.0, 0.6, 0.2);
  if (zone == 6) return vec3(0.5, 0.7, 0.0);
  if (zone == 7) return vec3(0.8, 0.7, 0.0);
  if (zone == 8) return vec3(1.0, 0.5, 0.0);
  if (zone == 9) return vec3(1.0, 0.2, 0.2);
  return vec3(1.0, 0.0, 0.5);
}

int getZone(float luma) {
  if (luma < 0.004) return 0;
  if (luma < 0.012) return 1;
  if (luma < 0.035) return 2;
  if (luma < 0.075) return 3;
  if (luma < 0.15) return 4;
  if (luma < 0.27) return 5;
  if (luma < 0.45) return 6;
  if (luma < 0.65) return 7;
  if (luma < 0.82) return 8;
  if (luma < 0.95) return 9;
  return 10;
}

void main() {
  vec4 colorA = sampleTextureA(v_texCoord);
  vec4 colorB = sampleTextureB(v_texCoord);

  float lumaA = luminance(colorA.rgb);
  float lumaB = luminance(colorB.rgb);

  int zoneA = getZone(lumaA);
  int zoneB = getZone(lumaB);

  vec3 zcA = zoneColor(zoneA);
  vec3 zcB = zoneColor(zoneB);

  // Split view with zone coloring
  vec3 result;
  if (v_texCoord.x < 0.5) {
    result = mix(colorA.rgb, zcA, u_opacity);
  } else {
    result = mix(colorB.rgb, zcB, u_opacity);
  }

  // Highlight zone differences
  if (zoneA != zoneB && u_threshold > 0.1) {
    // Show outline where zones differ
    float diff = abs(float(zoneA - zoneB)) / 10.0;
    if (v_texCoord.x < 0.5) {
      result = mix(result, vec3(1.0, 0.0, 0.0), diff * u_threshold);
    } else {
      result = mix(result, vec3(0.0, 1.0, 0.0), diff * u_threshold);
    }
  }

  // Center divider
  float lineWidth = 2.0 / u_resolution.x;
  if (abs(v_texCoord.x - 0.5) < lineWidth) {
    result = vec3(0.5);
  }

  gl_FragColor = vec4(result, 1.0);
}`
  }
}

export const EXPOSURE_VARIANTS = Object.keys(EXPOSURE_SHADERS)
