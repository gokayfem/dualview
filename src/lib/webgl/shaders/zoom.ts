/**
 * Zoom transition shaders
 * 8 variants: zoom_in, zoom_out, zoom_push, zoom_pull, zoom_blur, zoom_rotate, zoom_bounce, zoom_spiral
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const ZOOM_SHADERS: Record<string, TransitionShader> = {
  zoom_in: {
    name: 'zoom_in',
    label: 'Zoom In',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);

  float scale = 1.0 + u_progress * 2.0 * u_intensity;
  vec2 zoomedUV = (v_texCoord - 0.5) / scale + 0.5;

  vec4 colorB = texture2D(u_textureB, zoomedUV);

  float mask = smoothstep(0.0, 0.3, u_progress);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  zoom_out: {
    name: 'zoom_out',
    label: 'Zoom Out',
    fragment: `${SHADER_COMMON}
void main() {
  float scale = 1.0 + (1.0 - u_progress) * 2.0 * u_intensity;
  vec2 zoomedUV = (v_texCoord - 0.5) / scale + 0.5;

  vec4 colorA = texture2D(u_textureA, zoomedUV);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float mask = smoothstep(0.0, 0.3, u_progress);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  zoom_push: {
    name: 'zoom_push',
    label: 'Zoom Push',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);

  // A zooms in and fades
  float scaleA = 1.0 + p * 1.5 * u_intensity;
  vec2 uvA = (v_texCoord - 0.5) / scaleA + 0.5;
  vec4 colorA = texture2D(u_textureA, uvA);

  // B starts zoomed out and scales to normal
  float scaleB = 2.0 - p * 1.0;
  vec2 uvB = (v_texCoord - 0.5) / scaleB + 0.5;
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.3, 0.7, p);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  zoom_pull: {
    name: 'zoom_pull',
    label: 'Zoom Pull',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);

  // A scales down
  float scaleA = 1.0 - p * 0.5 * u_intensity;
  vec2 uvA = (v_texCoord - 0.5) / scaleA + 0.5;
  vec4 colorA = texture2D(u_textureA, uvA);

  // B starts small and grows
  float scaleB = 0.1 + p * 0.9;
  vec2 uvB = (v_texCoord - 0.5) / scaleB + 0.5;
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.2, 0.8, p);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  zoom_blur: {
    name: 'zoom_blur',
    label: 'Zoom Blur',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  vec2 dir = v_texCoord - center;

  float blurAmount = abs(u_progress - 0.5) * 2.0 * 0.1 * u_intensity;

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  // Radial blur samples
  for (float i = 0.0; i < 8.0; i++) {
    float t = i / 7.0;
    vec2 offset = dir * blurAmount * t;
    colorA += texture2D(u_textureA, v_texCoord - offset);
    colorB += texture2D(u_textureB, v_texCoord + offset);
  }
  colorA /= 8.0;
  colorB /= 8.0;

  float mask = smoothstep(0.0, 1.0, u_progress);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  zoom_rotate: {
    name: 'zoom_rotate',
    label: 'Zoom Rotate',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);
  vec2 center = vec2(0.5);

  // Rotate and zoom A
  float angleA = p * 3.14159265 * 0.5 * u_intensity;
  float scaleA = 1.0 + p * 0.5;
  vec2 uvA = rotate2D(v_texCoord - center, angleA) / scaleA + center;
  vec4 colorA = texture2D(u_textureA, uvA);

  // Rotate and zoom B (opposite direction)
  float angleB = (1.0 - p) * 3.14159265 * 0.5 * u_intensity;
  float scaleB = 1.0 + (1.0 - p) * 0.5;
  vec2 uvB = rotate2D(v_texCoord - center, -angleB) / scaleB + center;
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.3, 0.7, p);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  zoom_bounce: {
    name: 'zoom_bounce',
    label: 'Zoom Bounce',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeOutBounce(u_progress);

  // A shrinks with bounce
  float scaleA = 1.0 - p * 0.8 * u_intensity;
  vec2 uvA = (v_texCoord - 0.5) / max(scaleA, 0.01) + 0.5;
  vec4 colorA = texture2D(u_textureA, uvA);

  // B grows with bounce
  float scaleB = 0.2 + p * 0.8;
  vec2 uvB = (v_texCoord - 0.5) / scaleB + 0.5;
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.0, 0.5, u_progress);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  zoom_spiral: {
    name: 'zoom_spiral',
    label: 'Zoom Spiral',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);
  vec2 center = vec2(0.5);
  vec2 delta = v_texCoord - center;
  float dist = length(delta);

  // Spiral zoom for A
  float angleA = dist * 10.0 * p * u_intensity;
  float scaleA = 1.0 + p * dist * 2.0;
  vec2 uvA = rotate2D(delta, angleA) / scaleA + center;
  vec4 colorA = texture2D(u_textureA, uvA);

  // Inverse spiral for B
  float angleB = dist * 10.0 * (1.0 - p) * u_intensity;
  float scaleB = 1.0 + (1.0 - p) * dist * 2.0;
  vec2 uvB = rotate2D(delta, -angleB) / scaleB + center;
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.3, 0.7, p);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  }
}

export const ZOOM_VARIANTS = Object.keys(ZOOM_SHADERS)
