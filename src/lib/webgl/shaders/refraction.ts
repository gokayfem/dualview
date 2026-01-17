/**
 * Refraction transition shaders
 * 8 variants: micro_lens, glass_ripple, heat_haze, water, crystal, diamond, frosted, bubble
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const REFRACTION_SHADERS: Record<string, TransitionShader> = {
  micro_lens: {
    name: 'micro_lens',
    label: 'Micro Lens',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Micro lens array
  float lensGrid = 20.0;
  vec2 cell = floor(uv * lensGrid);
  vec2 cellUV = fract(uv * lensGrid) - 0.5;

  // Lens distortion
  float dist = length(cellUV);
  float lens = 1.0 - dist * 2.0;
  lens = max(lens, 0.0);

  vec2 refract = cellUV * lens * intensity * 0.3;
  vec2 lensUV = uv + refract;

  vec4 colorA = texture2D(u_textureA, lensUV);
  vec4 colorB = texture2D(u_textureB, lensUV);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  glass_ripple: {
    name: 'glass_ripple',
    label: 'Glass Ripple',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float p = u_progress;
  float intensity = sin(p * 3.14159265) * u_intensity;

  // Rippling glass effect
  vec2 center = vec2(0.5);
  float dist = length(uv - center);

  float ripple = sin(dist * 30.0 - p * 10.0) * intensity * 0.02;
  ripple *= exp(-dist * 3.0); // Fade with distance

  vec2 refractUV = uv + normalize(uv - center) * ripple;

  vec4 colorA = texture2D(u_textureA, refractUV);
  vec4 colorB = texture2D(u_textureB, refractUV);

  gl_FragColor = mix(colorA, colorB, p);
}`
  },

  heat_haze: {
    name: 'heat_haze',
    label: 'Heat Haze',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Rising heat distortion
  float haze = snoise(vec2(uv.x * 10.0, uv.y * 5.0 - u_time * 2.0));
  haze += snoise(vec2(uv.x * 20.0, uv.y * 10.0 - u_time * 3.0)) * 0.5;

  // Stronger at bottom, fades upward
  float heightFade = 1.0 - uv.y;
  vec2 offset = vec2(haze * 0.02, haze * 0.01) * intensity * heightFade;

  vec2 hazeUV = uv + offset;

  vec4 colorA = texture2D(u_textureA, hazeUV);
  vec4 colorB = texture2D(u_textureB, hazeUV);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  water: {
    name: 'water',
    label: 'Water',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float p = u_progress;
  float intensity = sin(p * 3.14159265) * u_intensity;

  // Water surface refraction
  float wave1 = sin(uv.x * 15.0 + u_time * 2.0) * cos(uv.y * 10.0 + u_time * 1.5);
  float wave2 = sin(uv.x * 25.0 - u_time * 1.5) * cos(uv.y * 20.0 + u_time);

  vec2 offset = vec2(wave1, wave2) * intensity * 0.02;

  vec2 waterUV = uv + offset;

  vec4 colorA = texture2D(u_textureA, waterUV);
  vec4 colorB = texture2D(u_textureB, waterUV);

  // Slight color tint for underwater feel
  vec4 result = mix(colorA, colorB, p);
  result.rgb = mix(result.rgb, result.rgb * vec3(0.9, 0.95, 1.0), intensity * 0.3);

  gl_FragColor = result;
}`
  },

  crystal: {
    name: 'crystal',
    label: 'Crystal',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Crystal facet refraction
  vec2 cell = voronoi(uv * 8.0);
  float facet = cell.y;

  // Each facet refracts differently
  vec2 offset = vec2(
    hash(vec2(facet, 0.0)) - 0.5,
    hash(vec2(0.0, facet)) - 0.5
  ) * intensity * 0.05;

  vec2 crystalUV = uv + offset;

  vec4 colorA = texture2D(u_textureA, crystalUV);
  vec4 colorB = texture2D(u_textureB, crystalUV);

  // Add subtle rainbow refraction at facet edges
  float edge = smoothstep(0.0, 0.1, cell.x);
  vec3 rainbow = hsv2rgb(vec3(facet, 0.5 * intensity, 1.0));

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb = mix(result.rgb * rainbow, result.rgb, edge);

  gl_FragColor = result;
}`
  },

  diamond: {
    name: 'diamond',
    label: 'Diamond',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Diamond pattern refraction
  vec2 diamond = abs(fract(uv * 5.0) - 0.5);
  float pattern = max(diamond.x, diamond.y);

  vec2 offset = (uv - 0.5) * pattern * intensity * 0.1;

  vec2 diamondUV = uv + offset;

  vec4 colorA = texture2D(u_textureA, diamondUV);
  vec4 colorB = texture2D(u_textureB, diamondUV);

  // Sparkle at diamond edges
  float sparkle = pow(1.0 - pattern, 10.0) * intensity;

  vec4 result = mix(colorA, colorB, u_progress);
  result.rgb += sparkle * vec3(1.0, 0.95, 0.9);

  gl_FragColor = result;
}`
  },

  frosted: {
    name: 'frosted',
    label: 'Frosted',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Frosted glass effect
  vec4 colorA = vec4(0.0);
  vec4 colorB = vec4(0.0);

  // Multiple offset samples for frosted look
  for (float i = 0.0; i < 8.0; i++) {
    float angle = i * 3.14159265 * 0.25;
    float n = noise(uv * 50.0 + vec2(i * 10.0, 0.0));
    vec2 offset = vec2(cos(angle), sin(angle)) * n * intensity * 0.02;

    colorA += texture2D(u_textureA, uv + offset);
    colorB += texture2D(u_textureB, uv + offset);
  }
  colorA /= 8.0;
  colorB /= 8.0;

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  bubble: {
    name: 'bubble',
    label: 'Bubble',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Multiple bubbles
  vec2 totalOffset = vec2(0.0);

  for (float i = 0.0; i < 5.0; i++) {
    vec2 bubbleCenter = vec2(
      hash(vec2(i, 0.0)),
      hash(vec2(0.0, i))
    );
    float bubbleSize = 0.1 + hash(vec2(i, i)) * 0.2;

    vec2 delta = uv - bubbleCenter;
    float dist = length(delta);

    if (dist < bubbleSize) {
      // Inside bubble - apply lens distortion
      float lens = sqrt(1.0 - pow(dist / bubbleSize, 2.0));
      totalOffset += delta * lens * 0.2 * intensity;
    }
  }

  vec2 bubbleUV = uv + totalOffset;

  vec4 colorA = texture2D(u_textureA, bubbleUV);
  vec4 colorB = texture2D(u_textureB, bubbleUV);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  }
}

export const REFRACTION_VARIANTS = Object.keys(REFRACTION_SHADERS)
