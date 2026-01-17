/**
 * RGB Parade Shader (SCOPE-003)
 * Three separate waveforms for Red, Green, Blue channels
 * Side-by-side layout (R | G | B)
 * Each channel displayed in its respective color
 */

import { SCOPE_COMMON } from './common'

export const RGB_PARADE_SHADER = `
${SCOPE_COMMON}

uniform int u_isolatedChannel;  // 0 = all, 1 = R only, 2 = G only, 3 = B only

#define SAMPLES_PER_COLUMN 128.0

void main() {
  vec2 uv = v_texCoord;
  vec3 color = vec3(0.05); // Dark background

  // Draw graticule (IRE scale markers)
  float graticuleAlpha = 0.25;
  vec3 graticuleColor = vec3(0.3);
  float lineWidth = 0.002;

  // IRE levels: 0, 25, 50, 75, 100
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.0, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.25, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.5, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 0.75, lineWidth) * graticuleAlpha);
  color = mix(color, graticuleColor, graticuleHLine(uv, 1.0, lineWidth) * graticuleAlpha);

  // When showing all channels, divide into 3 sections
  // When isolating, use full width for that channel

  float section1 = 1.0 / 3.0;
  float section2 = 2.0 / 3.0;

  // Draw section dividers (only when showing all)
  if (u_isolatedChannel == 0) {
    color = mix(color, graticuleColor, graticuleVLine(uv, section1, lineWidth * 2.0) * 0.5);
    color = mix(color, graticuleColor, graticuleVLine(uv, section2, lineWidth * 2.0) * 0.5);
  }

  // Determine which channel(s) to render
  float expectedY = uv.y;

  if (u_isolatedChannel == 0) {
    // Show all three channels side by side
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

    float accum = 0.0;

    for (float i = 0.0; i < SAMPLES_PER_COLUMN; i += 1.0) {
      float sampleY = i / SAMPLES_PER_COLUMN;
      vec2 sampleUV = vec2(localX, sampleY);
      vec4 pixel = texture2D(u_sourceTexture, sampleUV);

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

    accum = accum / SAMPLES_PER_COLUMN * 8.0;
    accum *= u_intensity;

    vec3 channelColor;
    if (channel == 0) {
      channelColor = vec3(1.0, 0.2, 0.2); // Red
    } else if (channel == 1) {
      channelColor = vec3(0.2, 1.0, 0.2); // Green
    } else {
      channelColor = vec3(0.3, 0.5, 1.0); // Blue
    }

    color = color + channelColor * accum;

  } else {
    // Show single isolated channel
    int channel = u_isolatedChannel - 1; // 0=R, 1=G, 2=B

    float accum = 0.0;

    for (float i = 0.0; i < SAMPLES_PER_COLUMN; i += 1.0) {
      float sampleY = i / SAMPLES_PER_COLUMN;
      vec2 sampleUV = vec2(uv.x, sampleY);
      vec4 pixel = texture2D(u_sourceTexture, sampleUV);

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

    accum = accum / SAMPLES_PER_COLUMN * 8.0;
    accum *= u_intensity;

    vec3 channelColor;
    if (channel == 0) {
      channelColor = vec3(1.0, 0.2, 0.2); // Red
    } else if (channel == 1) {
      channelColor = vec3(0.2, 1.0, 0.2); // Green
    } else {
      channelColor = vec3(0.3, 0.5, 1.0); // Blue
    }

    color = color + channelColor * accum;
  }

  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`
