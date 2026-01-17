/**
 * Waveform Monitor Shader (SCOPE-001)
 * Displays luminance distribution across horizontal axis
 * X-axis = horizontal image position
 * Y-axis = luminance level (0-100 IRE)
 */

import { SCOPE_COMMON } from './common'

export const WAVEFORM_SHADER = `
${SCOPE_COMMON}

// Number of samples per column for waveform (must be constant for WebGL 1.0)
#define SAMPLES_PER_COLUMN 128.0

void main() {
  vec2 uv = v_texCoord;
  vec3 color = vec3(0.0);

  // Background color - very dark gray
  vec3 bgColor = vec3(0.05);
  color = bgColor;

  // Draw graticule (IRE scale markers)
  float graticuleAlpha = 0.25;
  vec3 graticuleColor = vec3(0.3);

  // IRE levels: 0, 25, 50, 75, 100
  float lineWidth = 0.002;
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.0, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.25, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.5, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.75, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 1.0, lineWidth) * graticuleAlpha);

  // Vertical lines at 25%, 50%, 75% of image
  color = mix(color, graticuleColor, graticuleVLine(uv, 0.25, lineWidth) * graticuleAlpha * 0.5);
  color = mix(color, graticuleColor, graticuleVLine(uv, 0.5, lineWidth) * graticuleAlpha * 0.5);
  color = mix(color, graticuleColor, graticuleVLine(uv, 0.75, lineWidth) * graticuleAlpha * 0.5);

  // Sample source texture and accumulate luminance values
  vec3 waveformColor = vec3(0.0);

  // For each pixel in this column, sample the source and check if it maps to this Y level
  float columnX = uv.x;
  float expectedY = uv.y;

  // Sample multiple Y positions from the source texture at this X coordinate
  float accum = 0.0;
  for (float i = 0.0; i < SAMPLES_PER_COLUMN; i += 1.0) {
    float sampleY = i / SAMPLES_PER_COLUMN;
    vec2 sampleUV = vec2(columnX, sampleY);

    // Get the pixel color at this position
    vec4 pixel = texture2D(u_sourceTexture, sampleUV);
    float luma = luminance(pixel.rgb);

    // Check if this luminance value maps near our Y position
    float dist = abs(luma - expectedY);
    float contribution = smoothstep(0.015, 0.0, dist);

    accum += contribution;
  }

  // Normalize and apply intensity
  accum = accum / SAMPLES_PER_COLUMN * 8.0; // Scale up for visibility
  accum *= u_intensity;

  // Waveform color - green is traditional for luma waveform
  waveformColor = vec3(0.2, 1.0, 0.3) * accum;

  // Add waveform to output
  color = color + waveformColor;

  // Clamp output
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`

// RGB Parade mode shader (SCOPE-001 toggle + SCOPE-003)
export const WAVEFORM_PARADE_SHADER = `
${SCOPE_COMMON}

#define SAMPLES_PER_COLUMN 128.0

void main() {
  vec2 uv = v_texCoord;
  vec3 color = vec3(0.05); // Dark background

  // Draw graticule
  float graticuleAlpha = 0.25;
  vec3 graticuleColor = vec3(0.3);
  float lineWidth = 0.002;

  // IRE levels
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.0, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.25, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.5, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.75, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 1.0, lineWidth) * graticuleAlpha);

  // Divide into 3 sections for R, G, B
  // Section boundaries
  float section1 = 1.0 / 3.0;
  float section2 = 2.0 / 3.0;

  // Draw section dividers
  color = mix(color, graticuleColor, graticuleVLine(uv, section1, lineWidth * 2.0) * 0.5);
  color = mix(color, graticuleColor, graticuleVLine(uv, section2, lineWidth * 2.0) * 0.5);

  // Determine which channel we're rendering
  int channel = 0;
  float localX = uv.x;

  if (uv.x < section1) {
    channel = 0; // Red
    localX = uv.x * 3.0;
  } else if (uv.x < section2) {
    channel = 1; // Green
    localX = (uv.x - section1) * 3.0;
  } else {
    channel = 2; // Blue
    localX = (uv.x - section2) * 3.0;
  }

  float expectedY = uv.y;
  float accum = 0.0;

  // Sample source texture
  for (float i = 0.0; i < SAMPLES_PER_COLUMN; i += 1.0) {
    float sampleY = i / SAMPLES_PER_COLUMN;
    vec2 sampleUV = vec2(localX, sampleY);
    vec4 pixel = texture2D(u_sourceTexture, sampleUV);

    // Get the relevant channel value
    float channelValue;
    if (channel == 0) {
      channelValue = pixel.r;
    } else if (channel == 1) {
      channelValue = pixel.g;
    } else {
      channelValue = pixel.b;
    }

    float dist = abs(channelValue - expectedY);
    float contribution = smoothstep(0.015, 0.0, dist);
    accum += contribution;
  }

  // Normalize and scale
  accum = accum / SAMPLES_PER_COLUMN * 8.0;
  accum *= u_intensity;

  // Color by channel
  vec3 channelColor;
  if (channel == 0) {
    channelColor = vec3(1.0, 0.2, 0.2); // Red
  } else if (channel == 1) {
    channelColor = vec3(0.2, 1.0, 0.2); // Green
  } else {
    channelColor = vec3(0.3, 0.5, 1.0); // Blue
  }

  color = color + channelColor * accum;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`
