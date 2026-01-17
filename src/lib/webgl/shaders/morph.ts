/**
 * Morph transition shaders
 * 8 variants: smooth, warp, liquify, twist, bulge, wave, ripple, melt
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const MORPH_SHADERS: Record<string, TransitionShader> = {
  smooth: {
    name: 'smooth',
    label: 'Smooth',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Smooth morphing based on luminance
  float lumA = luminance(colorA.rgb);
  float lumB = luminance(colorB.rgb);

  float morphProgress = easeInOutCubic(u_progress);

  // Areas with similar luminance morph together
  float lumDiff = abs(lumA - lumB);
  float morphMask = smoothstep(0.0, 0.5, morphProgress + lumDiff * 0.3 * u_intensity);

  gl_FragColor = mix(colorA, colorB, morphMask);
}`
  },

  warp: {
    name: 'warp',
    label: 'Warp',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);

  // Warp distortion
  vec2 center = vec2(0.5);
  vec2 delta = v_texCoord - center;
  float dist = length(delta);

  float warpAmount = sin(p * 3.14159265) * u_intensity;
  float warp = 1.0 + sin(dist * 10.0 - p * 5.0) * warpAmount * 0.1;

  vec2 warpedUV = center + delta * warp;

  vec4 colorA = texture2D(u_textureA, warpedUV);
  vec4 colorB = texture2D(u_textureB, warpedUV);

  gl_FragColor = mix(colorA, colorB, p);
}`
  },

  liquify: {
    name: 'liquify',
    label: 'Liquify',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float p = u_progress;

  // Liquify effect using noise
  float n = snoise(uv * 5.0 + p * 2.0);
  float intensity = sin(p * 3.14159265) * u_intensity;

  vec2 offset = vec2(
    snoise(uv * 3.0 + vec2(p, 0.0)),
    snoise(uv * 3.0 + vec2(0.0, p))
  ) * intensity * 0.1;

  vec2 liquidUV = uv + offset;

  vec4 colorA = texture2D(u_textureA, liquidUV);
  vec4 colorB = texture2D(u_textureB, liquidUV);

  gl_FragColor = mix(colorA, colorB, p);
}`
  },

  twist: {
    name: 'twist',
    label: 'Twist',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  vec2 delta = v_texCoord - center;
  float dist = length(delta);

  float p = easeInOutCubic(u_progress);
  float twistAmount = sin(p * 3.14159265) * u_intensity * 3.0;

  // Twist decreases with distance from center
  float twist = twistAmount * (1.0 - dist);

  vec2 twistedUV = rotate2D(delta, twist) + center;

  vec4 colorA = texture2D(u_textureA, twistedUV);
  vec4 colorB = texture2D(u_textureB, twistedUV);

  gl_FragColor = mix(colorA, colorB, p);
}`
  },

  bulge: {
    name: 'bulge',
    label: 'Bulge',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  vec2 delta = v_texCoord - center;
  float dist = length(delta);

  float p = easeInOutCubic(u_progress);
  float bulgeAmount = sin(p * 3.14159265) * u_intensity;

  // Bulge effect - magnifies center
  float bulge = 1.0 - bulgeAmount * (1.0 - dist * 2.0);
  bulge = max(bulge, 0.1);

  vec2 bulgedUV = center + delta / bulge;

  vec4 colorA = texture2D(u_textureA, bulgedUV);
  vec4 colorB = texture2D(u_textureB, bulgedUV);

  gl_FragColor = mix(colorA, colorB, p);
}`
  },

  wave: {
    name: 'wave',
    label: 'Wave',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float p = u_progress;

  float intensity = sin(p * 3.14159265) * u_intensity;

  // Horizontal and vertical waves
  float waveX = sin(uv.y * 20.0 + p * 10.0) * intensity * 0.03;
  float waveY = sin(uv.x * 20.0 + p * 10.0) * intensity * 0.03;

  vec2 wavedUV = uv + vec2(waveX, waveY);

  vec4 colorA = texture2D(u_textureA, wavedUV);
  vec4 colorB = texture2D(u_textureB, wavedUV);

  gl_FragColor = mix(colorA, colorB, p);
}`
  },

  ripple: {
    name: 'ripple',
    label: 'Ripple',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  vec2 delta = v_texCoord - center;
  float dist = length(delta);

  float p = easeInOutCubic(u_progress);
  float intensity = sin(p * 3.14159265) * u_intensity;

  // Ripple waves emanating from center
  float ripple = sin(dist * 30.0 - p * 15.0) * intensity * 0.02;
  ripple *= (1.0 - dist); // Fade at edges

  vec2 rippleUV = v_texCoord + normalize(delta) * ripple;

  vec4 colorA = texture2D(u_textureA, rippleUV);
  vec4 colorB = texture2D(u_textureB, rippleUV);

  gl_FragColor = mix(colorA, colorB, p);
}`
  },

  melt: {
    name: 'melt',
    label: 'Melt',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float p = u_progress;

  // Melting effect - pixels drip down
  float meltProgress = p * 2.0;
  float meltNoise = noise(vec2(uv.x * 10.0, 0.0)) * 0.5 + 0.5;

  float meltLine = meltProgress - meltNoise * u_intensity;
  float inMeltZone = step(uv.y, meltLine);

  // Dripping distortion
  float drip = 0.0;
  if (inMeltZone > 0.5 && meltLine < 1.0) {
    float dripNoise = noise(vec2(uv.x * 20.0, p * 5.0));
    drip = (meltLine - uv.y) * dripNoise * 0.3 * u_intensity;
  }

  vec2 meltUV = vec2(uv.x, uv.y + drip);

  vec4 colorA = texture2D(u_textureA, meltUV);
  vec4 colorB = texture2D(u_textureB, meltUV);

  // Mix based on melt line
  float mask = smoothstep(meltLine - 0.05, meltLine + 0.05, uv.y);
  gl_FragColor = mix(colorB, colorA, mask);
}`
  }
}

export const MORPH_VARIANTS = Object.keys(MORPH_SHADERS)
