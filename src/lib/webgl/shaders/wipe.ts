/**
 * Wipe transition shaders
 * 12 variants: left, right, up, down, radial, radial_ccw, spiral, clock, clock_ccw, iris, blinds_h, blinds_v
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const WIPE_SHADERS: Record<string, TransitionShader> = {
  left: {
    name: 'left',
    label: 'Left',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float edge = u_progress * (1.0 + 0.1 * u_intensity);
  float softness = 0.02 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, v_texCoord.x);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  right: {
    name: 'right',
    label: 'Right',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float edge = (1.0 - u_progress) * (1.0 + 0.1 * u_intensity);
  float softness = 0.02 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, 1.0 - v_texCoord.x);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  up: {
    name: 'up',
    label: 'Up',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float edge = u_progress * (1.0 + 0.1 * u_intensity);
  float softness = 0.02 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, v_texCoord.y);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  down: {
    name: 'down',
    label: 'Down',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float edge = (1.0 - u_progress) * (1.0 + 0.1 * u_intensity);
  float softness = 0.02 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, 1.0 - v_texCoord.y);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  radial: {
    name: 'radial',
    label: 'Radial',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 center = vec2(0.5);
  float angle = atan(v_texCoord.y - center.y, v_texCoord.x - center.x);
  float normalizedAngle = (angle + 3.14159265) / (2.0 * 3.14159265);

  float edge = u_progress;
  float softness = 0.02 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, normalizedAngle);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  radial_ccw: {
    name: 'radial_ccw',
    label: 'Radial CCW',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 center = vec2(0.5);
  float angle = atan(v_texCoord.y - center.y, v_texCoord.x - center.x);
  float normalizedAngle = 1.0 - (angle + 3.14159265) / (2.0 * 3.14159265);

  float edge = u_progress;
  float softness = 0.02 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, normalizedAngle);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  spiral: {
    name: 'spiral',
    label: 'Spiral',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 center = vec2(0.5);
  vec2 delta = v_texCoord - center;
  float dist = length(delta);
  float angle = atan(delta.y, delta.x);

  float spiralAngle = angle + dist * 10.0 * u_intensity;
  float normalizedAngle = fract((spiralAngle + 3.14159265) / (2.0 * 3.14159265));

  float edge = u_progress;
  float softness = 0.03;
  float mask = smoothstep(edge - softness, edge + softness, normalizedAngle);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  clock: {
    name: 'clock',
    label: 'Clock',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 center = vec2(0.5);
  float angle = atan(v_texCoord.x - center.x, center.y - v_texCoord.y);
  float normalizedAngle = (angle + 3.14159265) / (2.0 * 3.14159265);

  float edge = u_progress;
  float softness = 0.01 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, normalizedAngle);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  clock_ccw: {
    name: 'clock_ccw',
    label: 'Clock CCW',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 center = vec2(0.5);
  float angle = atan(v_texCoord.x - center.x, center.y - v_texCoord.y);
  float normalizedAngle = 1.0 - (angle + 3.14159265) / (2.0 * 3.14159265);

  float edge = u_progress;
  float softness = 0.01 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, normalizedAngle);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  iris: {
    name: 'iris',
    label: 'Iris',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 center = vec2(0.5);
  float dist = length(v_texCoord - center);
  float maxDist = length(vec2(0.5));

  float edge = u_progress * maxDist * 1.2;
  float softness = 0.02 * u_intensity;
  float mask = smoothstep(edge - softness, edge + softness, dist);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  blinds_h: {
    name: 'blinds_h',
    label: 'Blinds H',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float numBlinds = 10.0 * u_intensity;
  float blindPos = fract(v_texCoord.y * numBlinds);

  float edge = u_progress * 1.1;
  float softness = 0.02;
  float mask = smoothstep(edge - softness, edge + softness, blindPos);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  blinds_v: {
    name: 'blinds_v',
    label: 'Blinds V',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float numBlinds = 10.0 * u_intensity;
  float blindPos = fract(v_texCoord.x * numBlinds);

  float edge = u_progress * 1.1;
  float softness = 0.02;
  float mask = smoothstep(edge - softness, edge + softness, blindPos);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  }
}

export const WIPE_VARIANTS = Object.keys(WIPE_SHADERS)
