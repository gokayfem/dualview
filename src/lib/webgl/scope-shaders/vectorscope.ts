/**
 * Vectorscope Display Shader (SCOPE-002)
 * Circular display showing hue (angle) and saturation (radius)
 * Color targets at R, Y, G, C, B, M positions
 * Includes skin tone indicator line at ~123 degrees
 */

import { SCOPE_COMMON } from './common'

export const VECTORSCOPE_SHADER = `
${SCOPE_COMMON}

uniform float u_zoom;           // 1-4x magnification
uniform bool u_showSkinTone;    // Show skin tone indicator line

// Color target positions (in UV coordinates)
// Standard vectorscope targets at SMPTE color bar positions
// Positions are in Cb/Cr (U/V) space normalized to -0.5 to 0.5

#define SAMPLES_X 64.0
#define SAMPLES_Y 64.0

// Convert UV polar coordinates to cartesian for display
// Vectorscope uses U (Cb) as X-axis and V (Cr) as Y-axis
vec2 uvToDisplay(float u, float v, float zoom) {
  // UV ranges are approximately -0.5 to 0.5
  // Map to display coordinates (0-1) with center at 0.5
  return vec2(u * zoom + 0.5, v * zoom + 0.5);
}

void main() {
  vec2 uv = v_texCoord;
  vec3 color = vec3(0.05); // Dark background

  // Center of the vectorscope
  vec2 center = vec2(0.5, 0.5);
  vec2 fromCenter = uv - center;
  float distFromCenter = length(fromCenter);

  // Draw graticule (saturation rings)
  float graticuleAlpha = 0.3;
  vec3 graticuleColor = vec3(0.25);
  float lineWidth = 0.003;

  // Saturation rings at 25%, 50%, 75%, 100%
  // At 1x zoom, 100% saturation reaches edge (0.5 from center)
  float maxRadius = 0.5 / u_zoom;

  color = mix(color, graticuleColor, graticuleCircle(uv, center, maxRadius * 0.25, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleCircle(uv, center, maxRadius * 0.5, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleCircle(uv, center, maxRadius * 0.75, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleCircle(uv, center, maxRadius, lineWidth) * graticuleAlpha);

  // Draw crosshairs
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.5, lineWidth) * graticuleAlpha * 0.5);
  color = mix(color, graticuleColor, graticuleVLine(uv, 0.5, lineWidth) * graticuleAlpha * 0.5);

  // Color target positions (approximate SMPTE color bar positions)
  // These are the Cb/Cr values for standard colors
  // Red:     Cb=-0.169, Cr=0.500
  // Yellow:  Cb=-0.331, Cr=0.331
  // Green:   Cb=-0.169, Cr=-0.169
  // Cyan:    Cb=0.169, Cr=-0.500
  // Blue:    Cb=0.331, Cr=-0.331
  // Magenta: Cb=0.169, Cr=0.169

  vec3 targetColor = vec3(0.5);
  float targetSize = 0.015;

  // Draw color targets (small boxes)
  // Note: Vectorscope typically shows V (Cr) on Y-axis, U (Cb) on X-axis

  // Red target
  vec2 redPos = center + vec2(-0.169, 0.500) * maxRadius * 2.0;
  float redDist = length(uv - redPos);
  if (redDist < targetSize) {
    color = mix(color, vec3(1.0, 0.2, 0.2), 0.8);
  }

  // Yellow target
  vec2 yellowPos = center + vec2(-0.331, 0.331) * maxRadius * 2.0;
  float yellowDist = length(uv - yellowPos);
  if (yellowDist < targetSize) {
    color = mix(color, vec3(1.0, 1.0, 0.2), 0.8);
  }

  // Green target
  vec2 greenPos = center + vec2(-0.169, -0.169) * maxRadius * 2.0;
  float greenDist = length(uv - greenPos);
  if (greenDist < targetSize) {
    color = mix(color, vec3(0.2, 1.0, 0.2), 0.8);
  }

  // Cyan target
  vec2 cyanPos = center + vec2(0.169, -0.500) * maxRadius * 2.0;
  float cyanDist = length(uv - cyanPos);
  if (cyanDist < targetSize) {
    color = mix(color, vec3(0.2, 1.0, 1.0), 0.8);
  }

  // Blue target
  vec2 bluePos = center + vec2(0.331, -0.331) * maxRadius * 2.0;
  float blueDist = length(uv - bluePos);
  if (blueDist < targetSize) {
    color = mix(color, vec3(0.3, 0.4, 1.0), 0.8);
  }

  // Magenta target
  vec2 magentaPos = center + vec2(0.169, 0.169) * maxRadius * 2.0;
  float magentaDist = length(uv - magentaPos);
  if (magentaDist < targetSize) {
    color = mix(color, vec3(1.0, 0.2, 1.0), 0.8);
  }

  // Skin tone line (approximately 123 degrees, which is in the orange-flesh region)
  // In vectorscope coordinates, this is roughly a line from center toward I (skin tone) axis
  if (u_showSkinTone) {
    float skinToneAngle = radians(123.0);
    vec2 skinToneDir = vec2(cos(skinToneAngle), sin(skinToneAngle));
    vec2 skinToneEnd = center + skinToneDir * maxRadius;

    // Draw the skin tone line
    vec3 skinToneColor = vec3(0.8, 0.6, 0.4);
    float skinToneLine = graticuleLine(uv, center, skinToneEnd, lineWidth * 1.5);
    color = mix(color, skinToneColor, skinToneLine * 0.6);
  }

  // Sample source texture and plot chrominance values
  vec3 chromaAccum = vec3(0.0);

  for (float y = 0.0; y < SAMPLES_Y; y += 1.0) {
    for (float x = 0.0; x < SAMPLES_X; x += 1.0) {
      vec2 sampleUV = vec2(x / SAMPLES_X, y / SAMPLES_Y);
      vec4 pixel = texture2D(u_sourceTexture, sampleUV);

      // Convert to YUV
      vec3 yuv = rgbToYuv(pixel.rgb);

      // Map U and V to display position
      // U (Cb) is on X-axis, V (Cr) is on Y-axis
      vec2 chromaPos = center + vec2(yuv.y, yuv.z) * u_zoom;

      // Check if this position is near our current UV
      float dist = length(uv - chromaPos);
      float contribution = smoothstep(0.008, 0.0, dist);

      // Color the point based on the original pixel color (desaturated)
      chromaAccum += pixel.rgb * contribution;
    }
  }

  // Normalize and apply intensity
  float totalSamples = SAMPLES_X * SAMPLES_Y;
  chromaAccum = chromaAccum / totalSamples * 1000.0;
  chromaAccum *= u_intensity;

  // Add chrominance display to output
  color = color + chromaAccum;

  // Ensure we stay in bounds
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`
