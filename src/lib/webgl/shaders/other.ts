/**
 * Other/Unique transition shaders
 * 12 variants: kaleidoscope, liquid_metal, neon_dreams, aurora, matrix, film_burn, tv_static, dreamy, comic, sketch, negative, solarize
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const OTHER_SHADERS: Record<string, TransitionShader> = {
  kaleidoscope: {
    name: 'kaleidoscope',
    label: 'Kaleidoscope',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord - 0.5;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Kaleidoscope effect
  float angle = atan(uv.y, uv.x);
  float segments = 6.0;
  angle = mod(angle, 3.14159265 * 2.0 / segments);
  angle = abs(angle - 3.14159265 / segments);

  float dist = length(uv);
  vec2 kaleidoUV = vec2(cos(angle), sin(angle)) * dist + 0.5;

  // Add rotation during transition
  float rotAngle = u_progress * 3.14159265 * 2.0 * intensity;
  kaleidoUV = rotate2D(kaleidoUV - 0.5, rotAngle) + 0.5;

  vec4 colorA = texture2D(u_textureA, kaleidoUV);
  vec4 colorB = texture2D(u_textureB, kaleidoUV);

  gl_FragColor = mix(colorA, colorB, u_progress);
}`
  },

  liquid_metal: {
    name: 'liquid_metal',
    label: 'Liquid Metal',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float p = u_progress;
  float intensity = sin(p * 3.14159265) * u_intensity;

  // Liquid metal flow
  float n = snoise(uv * 3.0 + p * 2.0);
  n += snoise(uv * 6.0 - p) * 0.5;

  vec2 offset = vec2(
    snoise(uv * 4.0 + vec2(p, 0.0)),
    snoise(uv * 4.0 + vec2(0.0, p))
  ) * intensity * 0.05;

  vec2 metalUV = uv + offset;

  vec4 colorA = texture2D(u_textureA, metalUV);
  vec4 colorB = texture2D(u_textureB, metalUV);
  vec4 base = mix(colorA, colorB, p);

  // Metallic highlights
  float highlight = pow(n * 0.5 + 0.5, 3.0);
  vec3 metalColor = mix(base.rgb, vec3(0.8, 0.85, 0.9), highlight * intensity * 0.5);

  gl_FragColor = vec4(metalColor, 1.0);
}`
  },

  neon_dreams: {
    name: 'neon_dreams',
    label: 'Neon Dreams',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  vec4 base = mix(colorA, colorB, u_progress);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Neon glow effect
  vec3 hsv = rgb2hsv(base.rgb);

  // Boost saturation and shift hue
  hsv.x = fract(hsv.x + sin(u_progress * 3.14159265 * 2.0) * 0.1);
  hsv.y = min(hsv.y * (1.0 + intensity), 1.0);
  hsv.z = min(hsv.z * (1.0 + intensity * 0.3), 1.0);

  vec3 neon = hsv2rgb(hsv);

  // Add glow
  float glow = luminance(base.rgb) * intensity;
  neon += glow * vec3(1.0, 0.2, 0.8) * 0.3;

  gl_FragColor = vec4(neon, 1.0);
}`
  },

  aurora: {
    name: 'aurora',
    label: 'Aurora',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  vec4 base = mix(colorA, colorB, u_progress);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Aurora borealis overlay
  float n = snoise(vec2(v_texCoord.x * 3.0, v_texCoord.y * 0.5 + u_time * 0.3));
  n += snoise(vec2(v_texCoord.x * 5.0 + u_time * 0.2, v_texCoord.y)) * 0.5;

  // Aurora colors
  vec3 aurora = hsv2rgb(vec3(
    0.3 + n * 0.2 + u_progress * 0.1,
    0.8,
    1.0
  ));

  // Vertical gradient (aurora appears in upper part)
  float auroraHeight = 1.0 - v_texCoord.y;
  auroraHeight = pow(auroraHeight, 2.0);

  // Combine
  float auroraMask = auroraHeight * (n * 0.5 + 0.5) * intensity;
  vec3 result = mix(base.rgb, base.rgb + aurora * 0.4, auroraMask);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  matrix: {
    name: 'matrix',
    label: 'Matrix',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Matrix rain effect
  vec2 cell = floor(v_texCoord * vec2(40.0, 1.0));
  float rainSpeed = hash(vec2(cell.x, 0.0)) * 2.0 + 1.0;
  float rainPhase = hash(vec2(cell.x, 1.0));

  float rain = fract(v_texCoord.y + u_time * rainSpeed * 0.5 + rainPhase);
  rain = pow(rain, 3.0);

  // Green matrix color
  vec3 matrixColor = vec3(0.0, 1.0, 0.3);

  vec4 base = mix(colorA, colorB, u_progress);

  // Apply matrix overlay
  vec3 result = mix(base.rgb, base.rgb * matrixColor + matrixColor * 0.2, rain * intensity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  film_burn: {
    name: 'film_burn',
    label: 'Film Burn',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Film burn from edges
  float edge = min(v_texCoord.x, min(v_texCoord.y, min(1.0 - v_texCoord.x, 1.0 - v_texCoord.y)));
  float burn = 1.0 - smoothstep(0.0, 0.15 * intensity, edge);

  // Burn noise
  float n = noise(v_texCoord * 10.0 + u_time);
  burn *= (0.5 + n * 0.5);

  // Burn colors
  vec3 burnColor = mix(vec3(0.0), vec3(1.0, 0.5, 0.0), burn);
  burnColor = mix(burnColor, vec3(1.0, 1.0, 0.8), burn * burn);

  vec4 base = mix(colorA, colorB, u_progress);
  vec3 result = mix(base.rgb, burnColor, burn * intensity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  tv_static: {
    name: 'tv_static',
    label: 'TV Static',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // TV static noise
  float staticNoise = hash(v_texCoord * 300.0 + u_time * 50.0);

  // Scanlines
  float scanline = sin(v_texCoord.y * 400.0) * 0.5 + 0.5;

  // Channel switching at midpoint
  vec4 base;
  if (abs(u_progress - 0.5) < 0.1 * u_intensity) {
    // Heavy static during switch
    base = vec4(staticNoise);
  } else {
    base = mix(colorA, colorB, u_progress);
    // Light static overlay
    base.rgb = mix(base.rgb, vec3(staticNoise), intensity * 0.2);
  }

  // Apply scanlines
  base.rgb *= 0.95 + scanline * 0.05 * intensity;

  gl_FragColor = base;
}`
  },

  comic: {
    name: 'comic',
    label: 'Comic',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  vec4 base = mix(colorA, colorB, u_progress);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Posterize colors
  float levels = 4.0 + (1.0 - intensity) * 12.0;
  vec3 posterized = floor(base.rgb * levels) / levels;

  // Edge detection for outlines
  vec2 texel = 1.0 / u_resolution;
  vec4 h = vec4(0.0);
  h += texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(-texel.x, 0.0)) * -1.0;
  h += texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(texel.x, 0.0)) * 1.0;
  vec4 v_edge = vec4(0.0);
  v_edge += texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(0.0, -texel.y)) * -1.0;
  v_edge += texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(0.0, texel.y)) * 1.0;

  float edge = length(h.rgb) + length(v_edge.rgb);
  edge = smoothstep(0.1, 0.3, edge);

  // Combine posterized color with outlines
  vec3 result = mix(posterized, vec3(0.0), edge * intensity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  sketch: {
    name: 'sketch',
    label: 'Sketch',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  vec4 base = mix(colorA, colorB, u_progress);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Convert to grayscale
  float gray = luminance(base.rgb);

  // Edge detection (Sobel)
  vec2 texel = 1.0 / u_resolution;
  float tl = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(-texel.x, -texel.y)).rgb);
  float t = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(0.0, -texel.y)).rgb);
  float tr = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(texel.x, -texel.y)).rgb);
  float l = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(-texel.x, 0.0)).rgb);
  float r = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(texel.x, 0.0)).rgb);
  float bl = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(-texel.x, texel.y)).rgb);
  float b = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(0.0, texel.y)).rgb);
  float br = luminance(texture2D(u_progress < 0.5 ? u_textureA : u_textureB, v_texCoord + vec2(texel.x, texel.y)).rgb);

  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
  float edge = sqrt(gx*gx + gy*gy);

  // Paper texture
  float paper = noise(v_texCoord * 200.0) * 0.1 + 0.95;

  // Sketch result
  float sketch = 1.0 - edge * 3.0;
  sketch = max(sketch, 0.0) * paper;

  vec3 result = mix(base.rgb, vec3(sketch), intensity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  negative: {
    name: 'negative',
    label: 'Negative',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Invert during transition
  vec4 negA = vec4(1.0 - colorA.rgb, 1.0);
  vec4 negB = vec4(1.0 - colorB.rgb, 1.0);

  // Mix between normal and negative
  vec4 mixedA = mix(colorA, negA, intensity);
  vec4 mixedB = mix(colorB, negB, intensity);

  gl_FragColor = mix(mixedA, mixedB, u_progress);
}`
  },

  solarize: {
    name: 'solarize',
    label: 'Solarize',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);
  vec4 base = mix(colorA, colorB, u_progress);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Solarization threshold
  float threshold = 0.5;

  vec3 solarized;
  solarized.r = base.r > threshold ? 1.0 - base.r : base.r;
  solarized.g = base.g > threshold ? 1.0 - base.g : base.g;
  solarized.b = base.b > threshold ? 1.0 - base.b : base.b;

  // Boost contrast
  solarized = (solarized - 0.5) * (1.0 + intensity) + 0.5;

  vec3 result = mix(base.rgb, solarized, intensity);

  gl_FragColor = vec4(result, 1.0);
}`
  },

  crossfade: {
    name: 'crossfade',
    label: 'Crossfade',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float p = easeInOutCubic(u_progress);
  gl_FragColor = mix(colorA, colorB, p);
}`
  }
}

export const OTHER_VARIANTS = Object.keys(OTHER_SHADERS)
