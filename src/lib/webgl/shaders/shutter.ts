/**
 * Shutter transition shaders
 * 8 variants: directional_smear, frame_echo, time_ghost, trail, streak, motion_lines, afterimage, persistence
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const SHUTTER_SHADERS: Record<string, TransitionShader> = {
  directional_smear: {
    name: 'directional_smear',
    label: 'Dir. Smear',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Smear in transition direction
  vec2 smearDir = vec2(1.0, 0.0);

  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  for (float i = 0.0; i < 10.0; i++) {
    float t = i / 9.0;
    vec2 offset = smearDir * t * intensity * 0.1;
    float weight = 1.0 - t * 0.5;

    colorA += texture2D(u_textureA, uv - offset) * weight;
    colorB += texture2D(u_textureB, uv + offset) * weight;
  }

  colorA /= 5.5;
  colorB /= 5.5;

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  frame_echo: {
    name: 'frame_echo',
    label: 'Frame Echo',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Echo/ghost frames at offset positions
  vec4 echo = vec4(0.0);
  for (float i = 1.0; i <= 4.0; i++) {
    vec2 offset = vec2(i * 0.02 * intensity, i * 0.01 * intensity);
    float alpha = 1.0 / (i + 1.0);

    if (u_progress < 0.5) {
      echo += texture2D(u_textureA, v_texCoord - offset) * alpha;
    } else {
      echo += texture2D(u_textureB, v_texCoord + offset) * alpha;
    }
  }
  echo /= 2.0;

  vec4 base = mix(colorA, colorB, u_progress);
  gl_FragColor = mix(base, base + echo * 0.3, intensity);
}`
  },

  time_ghost: {
    name: 'time_ghost',
    label: 'Time Ghost',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Semi-transparent ghost of other frame
  float ghostAlpha = intensity * 0.5;

  vec4 result;
  if (u_progress < 0.5) {
    // Ghost of B appearing
    result = colorA + colorB * ghostAlpha * u_progress * 2.0;
  } else {
    // Ghost of A fading
    result = colorB + colorA * ghostAlpha * (1.0 - u_progress) * 2.0;
  }

  gl_FragColor = result;
}`
  },

  trail: {
    name: 'trail',
    label: 'Trail',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Motion trail effect
  vec2 trailDir = vec2(0.0, -1.0); // Trailing downward

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);

  vec4 trail = vec4(0.0);
  float totalWeight = 0.0;

  for (float i = 0.0; i < 8.0; i++) {
    float t = i / 7.0;
    vec2 offset = trailDir * t * intensity * 0.15;
    float weight = pow(1.0 - t, 2.0);

    vec4 sampleA = texture2D(u_textureA, uv + offset);
    vec4 sampleB = texture2D(u_textureB, uv + offset);

    trail += mix(sampleA, sampleB, u_progress) * weight;
    totalWeight += weight;
  }

  trail /= totalWeight;

  vec4 base = mix(colorA, colorB, u_progress);
  gl_FragColor = mix(base, trail, intensity * 0.7);
}`
  },

  streak: {
    name: 'streak',
    label: 'Streak',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);
  vec4 base = mix(colorA, colorB, u_progress);

  // Bright areas create streaks
  float brightness = luminance(base.rgb);

  if (brightness > 0.7) {
    vec4 streak = vec4(0.0);
    for (float i = 1.0; i <= 6.0; i++) {
      vec2 offset = vec2(i * 0.01 * intensity, 0.0);
      streak += mix(
        texture2D(u_textureA, uv + offset),
        texture2D(u_textureB, uv + offset),
        u_progress
      ) / i;
    }
    streak /= 3.0;

    float streakMask = (brightness - 0.7) / 0.3 * intensity;
    base = mix(base, base + streak * 0.5, streakMask);
  }

  gl_FragColor = base;
}`
  },

  motion_lines: {
    name: 'motion_lines',
    label: 'Motion Lines',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);
  vec4 base = mix(colorA, colorB, u_progress);

  // Speed lines radiating from center
  vec2 center = vec2(0.5);
  vec2 dir = normalize(uv - center);
  float dist = length(uv - center);

  // Angle-based line pattern
  float angle = atan(dir.y, dir.x);
  float lines = sin(angle * 30.0) * 0.5 + 0.5;
  lines = pow(lines, 4.0);

  // Lines appear in transition zone
  float lineIntensity = lines * intensity * dist * 2.0;

  gl_FragColor = base + vec4(lineIntensity * 0.3);
}`
  },

  afterimage: {
    name: 'afterimage',
    label: 'Afterimage',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);

  // Complementary color afterimage
  vec3 afterA = vec3(1.0) - colorA.rgb;
  vec3 afterB = vec3(1.0) - colorB.rgb;

  vec4 result;
  if (u_progress < 0.5) {
    // Show A with growing B afterimage
    float afterIntensity = u_progress * 2.0 * intensity * 0.3;
    result = vec4(colorA.rgb + afterB * afterIntensity, 1.0);
  } else {
    // Show B with fading A afterimage
    float afterIntensity = (1.0 - u_progress) * 2.0 * intensity * 0.3;
    result = vec4(colorB.rgb + afterA * afterIntensity, 1.0);
  }

  gl_FragColor = result;
}`
  },

  persistence: {
    name: 'persistence',
    label: 'Persistence',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);

  // Phosphor persistence effect (like old CRTs)
  float p = u_progress;

  // A persists as it fades
  float persistA = max(0.0, 1.0 - p * 2.0);
  persistA = pow(persistA, 0.5) * intensity;

  // B persists as it appears
  float persistB = max(0.0, p * 2.0 - 1.0);
  persistB = pow(persistB, 0.5) * intensity;

  // Phosphor color decay (green phosphor style)
  vec3 decayColor = vec3(0.2, 1.0, 0.3);

  vec4 result = mix(colorA, colorB, p);
  result.rgb += colorA.rgb * decayColor * persistA * 0.3;
  result.rgb += colorB.rgb * decayColor * persistB * 0.3;

  gl_FragColor = result;
}`
  }
}

export const SHUTTER_VARIANTS = Object.keys(SHUTTER_SHADERS)
