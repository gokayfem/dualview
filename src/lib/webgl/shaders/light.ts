/**
 * Light transition shaders
 * 8 variants: soft_leak, hard_leak, glow_veil, flare, flash, rays, burn, fade_white
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const LIGHT_SHADERS: Record<string, TransitionShader> = {
  soft_leak: {
    name: 'soft_leak',
    label: 'Soft Leak',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Soft light leak from corner
  vec2 leakCenter = vec2(0.0, 1.0);
  float dist = length(v_texCoord - leakCenter);
  float leak = 1.0 - smoothstep(0.0, 1.5 * u_intensity, dist);

  // Light color (warm orange/yellow)
  vec3 leakColor = vec3(1.0, 0.8, 0.5);

  // Animate leak intensity
  float leakIntensity = sin(u_progress * 3.14159265) * leak;

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb += leakColor * leakIntensity * 0.5;
  result.rgb = min(result.rgb, 1.0);

  gl_FragColor = result;
}`
  },

  hard_leak: {
    name: 'hard_leak',
    label: 'Hard Leak',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Hard geometric light leak
  float leak1 = step(v_texCoord.x + v_texCoord.y, u_progress * 3.0);
  float leak2 = step(v_texCoord.x * 0.5 + v_texCoord.y, u_progress * 2.0);

  vec3 leakColor1 = vec3(1.0, 0.4, 0.2);
  vec3 leakColor2 = vec3(1.0, 0.9, 0.3);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb += leakColor1 * leak1 * intensity * 0.4;
  result.rgb += leakColor2 * leak2 * intensity * 0.3;
  result.rgb = min(result.rgb, 1.0);

  gl_FragColor = result;
}`
  },

  glow_veil: {
    name: 'glow_veil',
    label: 'Glow Veil',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Glowing veil effect
  float veil = sin(u_progress * 3.14159265);
  vec3 glowColor = vec3(1.0, 0.95, 0.9);

  // Soft gradient veil
  float gradient = 1.0 - abs(v_texCoord.y - 0.5) * 2.0;
  gradient = pow(gradient, 2.0);

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb = mix(result.rgb, glowColor, veil * gradient * 0.6 * u_intensity);

  gl_FragColor = result;
}`
  },

  flare: {
    name: 'flare',
    label: 'Lens Flare',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Lens flare from center
  vec2 center = vec2(0.5);
  vec2 dir = v_texCoord - center;
  float dist = length(dir);

  // Multiple flare rings
  float flare = 0.0;
  for (float i = 1.0; i <= 4.0; i++) {
    float ringDist = i * 0.15;
    float ring = 1.0 - smoothstep(0.0, 0.05, abs(dist - ringDist));
    flare += ring * (1.0 - i / 5.0);
  }

  // Central glow
  flare += (1.0 - smoothstep(0.0, 0.2, dist)) * 2.0;

  float intensity = sin(u_progress * 3.14159265) * u_intensity;
  vec3 flareColor = vec3(1.0, 0.95, 0.8);

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb += flareColor * flare * intensity * 0.4;
  result.rgb = min(result.rgb, 1.0);

  gl_FragColor = result;
}`
  },

  flash: {
    name: 'flash',
    label: 'Flash',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Camera flash effect
  float flash = 0.0;
  if (u_progress < 0.3) {
    flash = sin(u_progress / 0.3 * 3.14159265);
  }

  flash *= u_intensity;

  vec4 result;
  if (u_progress < 0.5) {
    result = colorA;
  } else {
    result = colorB;
  }

  result.rgb = mix(result.rgb, vec3(1.0), flash);

  gl_FragColor = result;
}`
  },

  rays: {
    name: 'rays',
    label: 'Light Rays',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 center = vec2(0.5, 0.0); // Light source at top center
  vec2 dir = v_texCoord - center;
  float angle = atan(dir.y, dir.x);

  // Create rays
  float rays = 0.0;
  for (float i = 0.0; i < 12.0; i++) {
    float rayAngle = i * 3.14159265 / 6.0;
    float rayWidth = 0.1;
    rays += smoothstep(rayWidth, 0.0, abs(mod(angle - rayAngle + 3.14159265, 3.14159265 / 3.0) - 3.14159265 / 6.0));
  }

  // Fade rays with distance
  float dist = length(dir);
  rays *= (1.0 - dist * 0.5);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;
  vec3 rayColor = vec3(1.0, 0.95, 0.85);

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb += rayColor * rays * intensity * 0.3;
  result.rgb = min(result.rgb, 1.0);

  gl_FragColor = result;
}`
  },

  burn: {
    name: 'burn',
    label: 'Burn',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Film burn effect from edges
  vec2 edgeDist = min(v_texCoord, 1.0 - v_texCoord);
  float edge = min(edgeDist.x, edgeDist.y);

  float n = noise(v_texCoord * 10.0 + u_time);
  float burn = 1.0 - smoothstep(0.0, 0.3 * u_intensity, edge + n * 0.1);

  float intensity = sin(u_progress * 3.14159265);

  // Burn colors (dark to orange to white)
  vec3 burnColor = mix(
    vec3(0.1, 0.0, 0.0),
    vec3(1.0, 0.5, 0.0),
    burn
  );
  burnColor = mix(burnColor, vec3(1.0), burn * burn);

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb = mix(result.rgb, burnColor, burn * intensity * 0.8);

  gl_FragColor = result;
}`
  },

  fade_white: {
    name: 'fade_white',
    label: 'Fade White',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Fade to white then to B
  float whiteIntensity;
  vec4 result;

  if (u_progress < 0.5) {
    // Fade A to white
    whiteIntensity = easeInQuad(u_progress * 2.0) * u_intensity;
    result = vec4(mix(colorA.rgb, vec3(1.0), whiteIntensity), 1.0);
  } else {
    // Fade white to B
    whiteIntensity = easeOutQuad((1.0 - u_progress) * 2.0) * u_intensity;
    result = vec4(mix(colorB.rgb, vec3(1.0), whiteIntensity), 1.0);
  }

  gl_FragColor = result;
}`
  }
}

export const LIGHT_VARIANTS = Object.keys(LIGHT_SHADERS)
