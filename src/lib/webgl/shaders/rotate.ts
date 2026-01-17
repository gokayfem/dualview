/**
 * Rotate transition shaders
 * 8 variants: cw, ccw, flip_h, flip_v, spin_3d, swirl, cube, fold
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const ROTATE_SHADERS: Record<string, TransitionShader> = {
  cw: {
    name: 'cw',
    label: 'Clockwise',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);
  vec2 center = vec2(0.5);

  float angleA = p * 3.14159265 * 0.5 * u_intensity;
  vec2 uvA = rotate2D(v_texCoord - center, angleA) + center;
  vec4 colorA = texture2D(u_textureA, uvA);

  float angleB = (p - 1.0) * 3.14159265 * 0.5 * u_intensity;
  vec2 uvB = rotate2D(v_texCoord - center, angleB) + center;
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.3, 0.7, p);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  ccw: {
    name: 'ccw',
    label: 'Counter-CW',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);
  vec2 center = vec2(0.5);

  float angleA = -p * 3.14159265 * 0.5 * u_intensity;
  vec2 uvA = rotate2D(v_texCoord - center, angleA) + center;
  vec4 colorA = texture2D(u_textureA, uvA);

  float angleB = -(p - 1.0) * 3.14159265 * 0.5 * u_intensity;
  vec2 uvB = rotate2D(v_texCoord - center, angleB) + center;
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.3, 0.7, p);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  flip_h: {
    name: 'flip_h',
    label: 'Flip H',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);

  // Horizontal flip effect (simulated 3D)
  float flipA = cos(p * 3.14159265 * 0.5);
  float flipB = cos((1.0 - p) * 3.14159265 * 0.5);

  vec2 uvA = vec2((v_texCoord.x - 0.5) / max(flipA, 0.01) + 0.5, v_texCoord.y);
  vec2 uvB = vec2((v_texCoord.x - 0.5) / max(flipB, 0.01) + 0.5, v_texCoord.y);

  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);

  // Darken as it flips
  colorA.rgb *= flipA;
  colorB.rgb *= flipB;

  float mask = step(0.5, p);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  flip_v: {
    name: 'flip_v',
    label: 'Flip V',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);

  // Vertical flip effect (simulated 3D)
  float flipA = cos(p * 3.14159265 * 0.5);
  float flipB = cos((1.0 - p) * 3.14159265 * 0.5);

  vec2 uvA = vec2(v_texCoord.x, (v_texCoord.y - 0.5) / max(flipA, 0.01) + 0.5);
  vec2 uvB = vec2(v_texCoord.x, (v_texCoord.y - 0.5) / max(flipB, 0.01) + 0.5);

  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);

  colorA.rgb *= flipA;
  colorB.rgb *= flipB;

  float mask = step(0.5, p);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  spin_3d: {
    name: 'spin_3d',
    label: 'Spin 3D',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);
  vec2 center = vec2(0.5);

  // 3D spin effect
  float angle = p * 3.14159265 * 2.0 * u_intensity;
  float scale = 1.0 - sin(p * 3.14159265) * 0.3;

  vec2 uvA = rotate2D(v_texCoord - center, angle) / scale + center;
  vec2 uvB = rotate2D(v_texCoord - center, angle - 3.14159265) / scale + center;

  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);

  // Fade based on which side is "visible"
  float visibility = cos(angle);
  float mask = smoothstep(-0.1, 0.1, -visibility);

  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  swirl: {
    name: 'swirl',
    label: 'Swirl',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 center = vec2(0.5);
  vec2 delta = v_texCoord - center;
  float dist = length(delta);

  float swirlAmount = (1.0 - dist * 2.0) * u_progress * 5.0 * u_intensity;
  float swirlAmountB = (1.0 - dist * 2.0) * (1.0 - u_progress) * 5.0 * u_intensity;

  vec2 uvA = rotate2D(delta, swirlAmount) + center;
  vec2 uvB = rotate2D(delta, -swirlAmountB) + center;

  vec4 colorA = texture2D(u_textureA, uvA);
  vec4 colorB = texture2D(u_textureB, uvB);

  float mask = smoothstep(0.0, 1.0, u_progress);
  gl_FragColor = mix(colorA, colorB, mask);
}`
  },

  cube: {
    name: 'cube',
    label: 'Cube',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);

  // Cube rotation effect
  float cubeAngle = p * 3.14159265 * 0.5;

  // Calculate which face is visible
  float faceA = cos(cubeAngle);
  float faceB = sin(cubeAngle);

  // Perspective transform for A (rotating away)
  vec2 uvA = v_texCoord;
  uvA.x = (uvA.x - 0.5) / max(faceA, 0.001) * (1.0 - p * 0.5) + 0.5 + p * 0.5;

  // Perspective transform for B (rotating in)
  vec2 uvB = v_texCoord;
  uvB.x = (uvB.x - 0.5) / max(faceB, 0.001) * (0.5 + p * 0.5) + 0.5 - (1.0 - p) * 0.5;

  vec4 colorA = texture2D(u_textureA, uvA) * faceA;
  vec4 colorB = texture2D(u_textureB, uvB) * faceB;

  // Show A when rotating away, B when rotating in
  float showA = step(v_texCoord.x, 1.0 - p);
  gl_FragColor = mix(colorB, colorA, showA);
}`
  },

  fold: {
    name: 'fold',
    label: 'Fold',
    fragment: `${SHADER_COMMON}
void main() {
  float p = easeInOutCubic(u_progress);

  // Page fold effect
  float foldX = p;
  float foldAngle = p * 3.14159265 * 0.5;

  vec2 uv = v_texCoord;

  if (uv.x > 1.0 - foldX) {
    // Folding part
    float foldProgress = (uv.x - (1.0 - foldX)) / foldX;
    float shadow = 1.0 - foldProgress * 0.3;

    // Flip and compress the folding part
    vec2 uvFold = vec2(1.0 - (uv.x - (1.0 - foldX)) * 2.0, uv.y);
    uvFold.x = clamp(uvFold.x, 0.0, 1.0);

    vec4 colorA = texture2D(u_textureA, uvFold) * shadow;
    vec4 colorB = texture2D(u_textureB, uv);

    gl_FragColor = mix(colorB, colorA, step(foldProgress, 0.5));
  } else {
    // Non-folding part shows B
    vec4 colorA = texture2D(u_textureA, uv);
    vec4 colorB = texture2D(u_textureB, uv);

    gl_FragColor = mix(colorA, colorB, p);
  }
}`
  }
}

export const ROTATE_VARIANTS = Object.keys(ROTATE_SHADERS)
