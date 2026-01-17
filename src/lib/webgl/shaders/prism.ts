/**
 * Prism/Chromatic transition shaders
 * 8 variants: rgb_split, spectral_smear, chroma_pulse, rainbow, prism_wipe, aberration, shift, dispersion
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const PRISM_SHADERS: Record<string, TransitionShader> = {
  rgb_split: {
    name: 'rgb_split',
    label: 'RGB Split',
    fragment: `${SHADER_COMMON}
void main() {
  float offset = sin(u_progress * 3.14159265) * 0.03 * u_intensity;

  // Sample RGB channels with offset
  vec4 colorA_r = texture2D(u_textureA, v_texCoord + vec2(offset, 0.0));
  vec4 colorA_g = texture2D(u_textureA, v_texCoord);
  vec4 colorA_b = texture2D(u_textureA, v_texCoord - vec2(offset, 0.0));

  vec4 colorB_r = texture2D(u_textureB, v_texCoord + vec2(offset, 0.0));
  vec4 colorB_g = texture2D(u_textureB, v_texCoord);
  vec4 colorB_b = texture2D(u_textureB, v_texCoord - vec2(offset, 0.0));

  vec4 colorA = vec4(colorA_r.r, colorA_g.g, colorA_b.b, 1.0);
  vec4 colorB = vec4(colorB_r.r, colorB_g.g, colorB_b.b, 1.0);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  spectral_smear: {
    name: 'spectral_smear',
    label: 'Spectral Smear',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;
  vec2 dir = normalize(v_texCoord - 0.5);

  vec4 result = vec4(0.0);
  float total = 0.0;

  // Sample with spectral offset
  for (float i = 0.0; i < 7.0; i++) {
    float t = i / 6.0;
    vec2 offset = dir * (t - 0.5) * intensity * 0.1;

    vec4 colorA = texture2D(u_textureA, v_texCoord + offset);
    vec4 colorB = texture2D(u_textureB, v_texCoord + offset);
    vec4 sample = mix(colorA, colorB, u_progress);

    // Apply spectral color
    vec3 spectral = hsv2rgb(vec3(t, 0.5 * intensity, 1.0));
    result.rgb += sample.rgb * spectral;
    total += 1.0;
  }

  result.rgb /= total;
  result.a = 1.0;

  gl_FragColor = result;
}`
  },

  chroma_pulse: {
    name: 'chroma_pulse',
    label: 'Chroma Pulse',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec4 base = mix(colorA, colorB, u_progress);

  // Pulsing chromatic shift
  float pulse = sin(u_progress * 3.14159265 * 4.0) * 0.5 + 0.5;
  float shift = sin(u_progress * 3.14159265) * 0.02 * u_intensity;

  vec4 shifted = vec4(
    texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(shift, 0.0)).r,
    base.g,
    texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord - vec2(shift, 0.0)).b,
    1.0
  );

  gl_FragColor = mix(base, shifted, pulse);
}`
  },

  rainbow: {
    name: 'rainbow',
    label: 'Rainbow',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec4 base = mix(colorA, colorB, u_progress);

  // Rainbow overlay
  float hue = v_texCoord.x + u_progress * 0.5;
  vec3 rainbow = hsv2rgb(vec3(hue, 0.8, 1.0));

  float intensity = sin(u_progress * 3.14159265) * u_intensity * 0.4;

  vec4 result;
  result.rgb = mix(base.rgb, rainbow, intensity);
  result.a = 1.0;

  gl_FragColor = result;
}`
  },

  prism_wipe: {
    name: 'prism_wipe',
    label: 'Prism Wipe',
    fragment: `${SHADER_COMMON}
void main() {
  float edge = u_progress * 1.5;
  float band = 0.2 * u_intensity;

  // Create prism band at transition edge
  float dist = v_texCoord.x - (edge - band);

  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  if (dist < 0.0) {
    gl_FragColor = colorB;
  } else if (dist < band) {
    // Prism refraction zone
    float t = dist / band;
    vec2 offset = vec2(t * 0.05, 0.0);

    vec4 prism;
    prism.r = texture2D(u_textureA, v_texCoord + offset * 0.5).r;
    prism.g = mix(texture2D(u_textureA, v_texCoord).g, texture2D(u_textureB, v_texCoord).g, t);
    prism.b = texture2D(u_textureB, v_texCoord - offset * 0.5).b;
    prism.a = 1.0;

    // Add rainbow fringe
    vec3 rainbow = hsv2rgb(vec3(t, 0.7, 1.0));
    prism.rgb = mix(prism.rgb, rainbow, 0.3);

    gl_FragColor = prism;
  } else {
    gl_FragColor = colorA;
  }
}`
  },

  aberration: {
    name: 'aberration',
    label: 'Aberration',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  vec2 dir = v_texCoord - center;
  float dist = length(dir);

  // Chromatic aberration increases with distance from center
  float aberration = dist * sin(u_progress * 3.14159265) * 0.05 * u_intensity;

  vec2 offsetR = dir * aberration;
  vec2 offsetB = -dir * aberration;

  vec4 colorA = vec4(
    texture2D(u_textureA, v_texCoord + offsetR).r,
    texture2D(u_textureA, v_texCoord).g,
    texture2D(u_textureA, v_texCoord + offsetB).b,
    1.0
  );

  vec4 colorB = vec4(
    texture2D(u_textureB, v_texCoord + offsetR).r,
    texture2D(u_textureB, v_texCoord).g,
    texture2D(u_textureB, v_texCoord + offsetB).b,
    1.0
  );

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  shift: {
    name: 'shift',
    label: 'Color Shift',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Shift hue during transition
  float hueShift = sin(u_progress * 3.14159265) * 0.3 * u_intensity;

  vec3 hsvA = rgb2hsv(colorA.rgb);
  vec3 hsvB = rgb2hsv(colorB.rgb);

  hsvA.x = fract(hsvA.x + hueShift);
  hsvB.x = fract(hsvB.x + hueShift);

  colorA.rgb = hsv2rgb(hsvA);
  colorB.rgb = hsv2rgb(hsvB);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  dispersion: {
    name: 'dispersion',
    label: 'Dispersion',
    fragment: `${SHADER_COMMON}
void main() {
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  vec4 result = vec4(0.0);

  // Multiple wavelength samples
  for (float i = 0.0; i < 8.0; i++) {
    float t = i / 7.0;
    float wavelength = 0.4 + t * 0.3; // Simulate different wavelengths

    // Each wavelength refracts differently
    vec2 refract = (v_texCoord - 0.5) * (1.0 + (wavelength - 0.55) * intensity * 0.2) + 0.5;

    vec4 colorA = texture2D(u_textureA, refract);
    vec4 colorB = texture2D(u_textureB, refract);
    vec4 sample = mix(colorA, colorB, u_progress);

    // Color based on wavelength
    vec3 waveColor;
    if (t < 0.33) waveColor = vec3(1.0 - t * 3.0, t * 3.0, 0.0);
    else if (t < 0.66) waveColor = vec3(0.0, 1.0 - (t - 0.33) * 3.0, (t - 0.33) * 3.0);
    else waveColor = vec3((t - 0.66) * 3.0, 0.0, 1.0 - (t - 0.66) * 3.0);

    result.rgb += sample.rgb * mix(vec3(1.0), waveColor, intensity * 0.5);
  }

  result.rgb /= 8.0;
  result.a = 1.0;

  gl_FragColor = result;
}`
  }
}

export const PRISM_VARIANTS = Object.keys(PRISM_SHADERS)
