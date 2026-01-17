/**
 * Dissolve transition shaders
 * 8 variants: powder, ink, cellular, bokeh, fractal, smoke, sand, sparkle
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const DISSOLVE_SHADERS: Record<string, TransitionShader> = {
  powder: {
    name: 'powder',
    label: 'Powder',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float n = fbm(v_texCoord * 8.0 * u_intensity, 4);
  float threshold = u_progress * 1.2;
  float edge = smoothstep(threshold - 0.1, threshold, n);

  gl_FragColor = mix(colorB, colorA, edge);
}`
  },

  ink: {
    name: 'ink',
    label: 'Ink',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 uv = v_texCoord;
  float n = snoise(uv * 5.0 + u_time * 0.5) * 0.5 + 0.5;
  n += snoise(uv * 10.0 - u_time * 0.3) * 0.25;
  n = pow(n, 1.5 * u_intensity);

  float threshold = u_progress * 1.3;
  float mask = smoothstep(threshold - 0.15, threshold, n);

  // Ink bleeding edge
  vec3 inkEdge = vec3(0.0, 0.0, 0.1);
  float edgeWidth = 0.05;
  float edgeMask = smoothstep(threshold - edgeWidth, threshold, n) -
                   smoothstep(threshold, threshold + edgeWidth * 0.5, n);

  vec4 result = mix(colorB, colorA, mask);
  result.rgb = mix(result.rgb, inkEdge, edgeMask * 0.5);

  gl_FragColor = result;
}`
  },

  cellular: {
    name: 'cellular',
    label: 'Cellular',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 cell = voronoi(v_texCoord * 10.0 * u_intensity);
  float n = cell.x + cell.y * 0.5;

  float threshold = u_progress * 1.4;
  float mask = smoothstep(threshold - 0.2, threshold, n);

  // Cell edge highlight
  float edge = smoothstep(0.0, 0.1, cell.x);

  gl_FragColor = mix(colorB, colorA, mask * edge);
}`
  },

  bokeh: {
    name: 'bokeh',
    label: 'Bokeh',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float n = 0.0;
  for (float i = 0.0; i < 6.0; i++) {
    vec2 offset = vec2(
      sin(i * 1.047 + u_time) * (0.1 + i * 0.05),
      cos(i * 1.047 + u_time) * (0.1 + i * 0.05)
    );
    float circle = 1.0 - smoothstep(0.0, 0.15, length(v_texCoord - 0.5 + offset));
    n += circle * (0.3 + hash(vec2(i, 0.0)) * 0.7);
  }

  n = n / 3.0 * u_intensity;
  float threshold = u_progress * 1.5;
  float mask = smoothstep(threshold - 0.3, threshold, n + noise(v_texCoord * 5.0) * 0.3);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  fractal: {
    name: 'fractal',
    label: 'Fractal',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float n = fbm(v_texCoord * 4.0 * u_intensity, 6);
  n += fbm(v_texCoord * 8.0 + vec2(n), 4) * 0.5;
  n += fbm(v_texCoord * 16.0 + vec2(n), 3) * 0.25;

  float threshold = u_progress * 1.8;
  float mask = smoothstep(threshold - 0.2, threshold, n);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  smoke: {
    name: 'smoke',
    label: 'Smoke',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  vec2 uv = v_texCoord;
  float t = u_time * 0.3;

  // Turbulent smoke
  float n = 0.0;
  n += snoise(uv * 3.0 + vec2(0.0, t)) * 0.5;
  n += snoise(uv * 6.0 + vec2(t * 0.5, 0.0)) * 0.25;
  n += snoise(uv * 12.0 - vec2(t * 0.3, t * 0.2)) * 0.125;
  n = n * 0.5 + 0.5;
  n = pow(n, 0.8 * u_intensity);

  float threshold = u_progress * 1.3;
  float mask = smoothstep(threshold - 0.25, threshold + 0.05, n);

  // Smoke wisps at edge
  float wisps = smoothstep(threshold - 0.1, threshold, n) -
                smoothstep(threshold, threshold + 0.15, n);

  vec4 result = mix(colorB, colorA, mask);
  result.rgb += wisps * 0.2;

  gl_FragColor = result;
}`
  },

  sand: {
    name: 'sand',
    label: 'Sand',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  // Sand grain pattern
  float grain = hash(floor(v_texCoord * 200.0));
  float n = noise(v_texCoord * 15.0 * u_intensity);
  n += grain * 0.3;

  // Gravity effect - sand falls from top
  float gravity = v_texCoord.y * 0.5;
  n += gravity;

  float threshold = u_progress * 1.5;
  float mask = smoothstep(threshold - 0.1, threshold, n);

  gl_FragColor = mix(colorB, colorA, mask);
}`
  },

  sparkle: {
    name: 'sparkle',
    label: 'Sparkle',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float n = noise(v_texCoord * 10.0 * u_intensity);

  // Sparkle points
  float sparkle = 0.0;
  for (float i = 0.0; i < 20.0; i++) {
    vec2 pos = vec2(hash(vec2(i, 0.0)), hash(vec2(0.0, i)));
    float dist = length(v_texCoord - pos);
    float pulse = sin(u_time * 5.0 + i) * 0.5 + 0.5;
    sparkle += (1.0 - smoothstep(0.0, 0.03, dist)) * pulse;
  }

  float threshold = u_progress * 1.2;
  float baseMask = smoothstep(threshold - 0.15, threshold, n);
  float mask = max(baseMask, sparkle * step(0.5, u_progress));

  vec4 result = mix(colorB, colorA, mask);
  result.rgb += sparkle * vec3(1.0, 0.9, 0.7) * 0.5 * (1.0 - abs(u_progress - 0.5) * 2.0);

  gl_FragColor = result;
}`
  }
}

export const DISSOLVE_VARIANTS = Object.keys(DISSOLVE_SHADERS)
