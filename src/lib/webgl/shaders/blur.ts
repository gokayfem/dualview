/**
 * Blur transition shaders
 * 8 variants: gaussian, motion, radial, dreamy, bokeh_blur, directional, spin, focus
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const BLUR_SHADERS: Record<string, TransitionShader> = {
  gaussian: {
    name: 'gaussian',
    label: 'Gaussian',
    fragment: `${SHADER_COMMON}
void main() {
  float blurSize = abs(u_progress - 0.5) * 2.0 * 0.02 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);
  float total = 0.0;

  // 9-tap gaussian blur
  for (float x = -2.0; x <= 2.0; x++) {
    for (float y = -2.0; y <= 2.0; y++) {
      float weight = exp(-(x*x + y*y) / 4.0);
      vec2 offset = vec2(x, y) * blurSize;
      colorA += texture2D(u_textureA, v_texCoord + offset) * weight;
      colorB += texture2D(u_textureB, v_texCoord + offset) * weight;
      total += weight;
    }
  }
  colorA /= total;
  colorB /= total;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  motion: {
    name: 'motion',
    label: 'Motion',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 dir = vec2(1.0, 0.0); // Horizontal motion
  float blurSize = abs(u_progress - 0.5) * 2.0 * 0.05 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  // Motion blur samples
  for (float i = -4.0; i <= 4.0; i++) {
    float weight = 1.0 - abs(i) / 5.0;
    vec2 offset = dir * i * blurSize;
    colorA += texture2D(u_textureA, v_texCoord + offset) * weight;
    colorB += texture2D(u_textureB, v_texCoord + offset) * weight;
  }
  colorA /= 5.0;
  colorB /= 5.0;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  radial: {
    name: 'radial',
    label: 'Radial',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  vec2 dir = normalize(v_texCoord - center);
  float dist = length(v_texCoord - center);

  float blurSize = abs(u_progress - 0.5) * 2.0 * 0.1 * u_intensity * dist;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  for (float i = 0.0; i < 8.0; i++) {
    float t = i / 7.0;
    vec2 offset = dir * blurSize * (t - 0.5);
    colorA += texture2D(u_textureA, v_texCoord + offset);
    colorB += texture2D(u_textureB, v_texCoord + offset);
  }
  colorA /= 8.0;
  colorB /= 8.0;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  dreamy: {
    name: 'dreamy',
    label: 'Dreamy',
    fragment: `${SHADER_COMMON}
void main() {
  float blurSize = abs(u_progress - 0.5) * 2.0 * 0.015 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  // Soft dreamy blur with glow
  for (float i = 0.0; i < 6.0; i++) {
    float angle = i * 3.14159265 / 3.0;
    vec2 offset = vec2(cos(angle), sin(angle)) * blurSize;
    colorA += texture2D(u_textureA, v_texCoord + offset);
    colorB += texture2D(u_textureB, v_texCoord + offset);
  }
  colorA /= 6.0;
  colorB /= 6.0;

  // Add glow/bloom effect
  vec4 originalA = texture2D(u_textureA, v_texCoord);
  vec4 originalB = texture2D(u_textureB, v_texCoord);

  colorA = mix(originalA, colorA, 0.7) + colorA * 0.3;
  colorB = mix(originalB, colorB, 0.7) + colorB * 0.3;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  bokeh_blur: {
    name: 'bokeh_blur',
    label: 'Bokeh',
    fragment: `${SHADER_COMMON}
void main() {
  float blurSize = abs(u_progress - 0.5) * 2.0 * 0.03 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);
  float total = 0.0;

  // Hexagonal bokeh pattern
  for (float i = 0.0; i < 6.0; i++) {
    float angle = i * 3.14159265 / 3.0;
    for (float r = 1.0; r <= 3.0; r++) {
      vec2 offset = vec2(cos(angle), sin(angle)) * blurSize * r;
      float weight = 1.0 / r;
      colorA += texture2D(u_textureA, v_texCoord + offset) * weight;
      colorB += texture2D(u_textureB, v_texCoord + offset) * weight;
      total += weight;
    }
  }

  // Center sample
  colorA += texture2D(u_textureA, v_texCoord);
  colorB += texture2D(u_textureB, v_texCoord);
  total += 1.0;

  colorA /= total;
  colorB /= total;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  directional: {
    name: 'directional',
    label: 'Directional',
    fragment: `${SHADER_COMMON}
void main() {
  // Diagonal blur direction
  vec2 dir = normalize(vec2(1.0, 1.0));
  float blurSize = abs(u_progress - 0.5) * 2.0 * 0.04 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  for (float i = -5.0; i <= 5.0; i++) {
    float weight = 1.0 - abs(i) / 6.0;
    vec2 offset = dir * i * blurSize;
    colorA += texture2D(u_textureA, v_texCoord + offset) * weight;
    colorB += texture2D(u_textureB, v_texCoord + offset) * weight;
  }
  colorA /= 6.0;
  colorB /= 6.0;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  spin: {
    name: 'spin',
    label: 'Spin',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  float dist = length(v_texCoord - center);
  float spinAmount = abs(u_progress - 0.5) * 2.0 * 0.5 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  // Rotational blur
  for (float i = 0.0; i < 8.0; i++) {
    float angle = (i - 3.5) / 8.0 * spinAmount * dist;
    vec2 rotatedUV = rotate2D(v_texCoord - center, angle) + center;
    colorA += texture2D(u_textureA, rotatedUV);
    colorB += texture2D(u_textureB, rotatedUV);
  }
  colorA /= 8.0;
  colorB /= 8.0;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  focus: {
    name: 'focus',
    label: 'Focus',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  float dist = length(v_texCoord - center);

  // Blur increases with distance from center
  float blurSize = dist * abs(u_progress - 0.5) * 2.0 * 0.03 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  for (float x = -1.0; x <= 1.0; x++) {
    for (float y = -1.0; y <= 1.0; y++) {
      vec2 offset = vec2(x, y) * blurSize;
      colorA += texture2D(u_textureA, v_texCoord + offset);
      colorB += texture2D(u_textureB, v_texCoord + offset);
    }
  }
  colorA /= 9.0;
  colorB /= 9.0;

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  }
}

export const BLUR_VARIANTS = Object.keys(BLUR_SHADERS)
