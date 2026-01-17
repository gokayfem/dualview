/**
 * Glitch transition shaders
 * 8 variants: scan_jitter, line_tear, block_drift, digital, corrupt, static, vhs, data_mosh
 */

import { SHADER_COMMON, type TransitionShader } from './common'

export const GLITCH_SHADERS: Record<string, TransitionShader> = {
  scan_jitter: {
    name: 'scan_jitter',
    label: 'Scan Jitter',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;

  // Random horizontal jitter per scanline
  float jitter = hash(vec2(floor(uv.y * 100.0), u_time)) * 2.0 - 1.0;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Apply jitter to some scanlines
  float jitterMask = step(0.8, hash(vec2(floor(uv.y * 50.0 + u_time * 10.0), 0.0)));
  uv.x += jitter * 0.1 * intensity * jitterMask;

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);

  // RGB split on jittered areas
  vec4 glitched;
  glitched.r = texture2D(u_progress < 0.5 ? u_textureA : u_textureB, uv + vec2(0.01 * intensity, 0.0)).r;
  glitched.g = mix(colorA.g, colorB.g, u_progress);
  glitched.b = texture2D(u_progress < 0.5 ? u_textureA : u_textureB, uv - vec2(0.01 * intensity, 0.0)).b;
  glitched.a = 1.0;

  vec4 clean = mix(colorA, colorB, u_progress);
  gl_FragColor = mix(clean, glitched, jitterMask * intensity);
}`
  },

  line_tear: {
    name: 'line_tear',
    label: 'Line Tear',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Create horizontal tears
  float tearY = hash(vec2(floor(u_time * 5.0), 0.0));
  float tearHeight = 0.1 + hash(vec2(floor(u_time * 3.0), 1.0)) * 0.1;

  if (abs(uv.y - tearY) < tearHeight * intensity) {
    // Offset the tear horizontally
    float offset = (hash(vec2(floor(uv.y * 100.0), u_time)) - 0.5) * 0.2 * intensity;
    uv.x = fract(uv.x + offset);

    // Color distortion in tear
    vec4 torn;
    torn.r = texture2D(u_textureA, uv + vec2(0.02, 0.0)).r;
    torn.g = texture2D(u_textureB, uv).g;
    torn.b = texture2D(u_textureA, uv - vec2(0.02, 0.0)).b;
    torn.a = 1.0;

    gl_FragColor = torn;
  } else {
    vec4 colorA = texture2D(u_textureA, uv);
    vec4 colorB = texture2D(u_textureB, uv);
    gl_FragColor = mix(colorA, colorB, u_progress);
  }
}`
  },

  block_drift: {
    name: 'block_drift',
    label: 'Block Drift',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Create drifting blocks
  vec2 blockCoord = floor(uv * 10.0);
  float blockRand = hash(blockCoord + floor(u_time * 2.0));

  if (blockRand > 0.8) {
    // This block drifts
    vec2 drift = vec2(
      hash(blockCoord + vec2(1.0, 0.0)) - 0.5,
      hash(blockCoord + vec2(0.0, 1.0)) - 0.5
    ) * 0.2 * intensity;

    uv += drift;
  }

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);

  // Some blocks show different source
  float sourceMask = step(0.5 + (u_progress - 0.5) * 0.5, hash(blockCoord));
  gl_FragColor = mix(
    mix(colorA, colorB, u_progress),
    sourceMask > 0.5 ? colorB : colorA,
    step(0.9, blockRand) * intensity
  );
}`
  },

  digital: {
    name: 'digital',
    label: 'Digital',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Digital corruption effect
  vec2 blockSize = vec2(32.0, 16.0) / u_resolution;
  vec2 block = floor(uv / blockSize);
  float corruption = hash(block + floor(u_time * 5.0));

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);
  vec4 clean = mix(colorA, colorB, u_progress);

  if (corruption > 1.0 - intensity * 0.3) {
    // Corrupted block
    vec2 corruptUV = uv + (hash(block) - 0.5) * 0.1 * intensity;

    // Choose random color channel configuration
    float config = floor(hash(block + vec2(1.0, 0.0)) * 4.0);
    vec4 corrupt;
    if (config < 1.0) {
      corrupt = vec4(colorA.r, colorB.g, colorA.b, 1.0);
    } else if (config < 2.0) {
      corrupt = vec4(colorB.r, colorA.g, colorB.b, 1.0);
    } else if (config < 3.0) {
      corrupt = texture2D(u_textureA, corruptUV);
    } else {
      corrupt = texture2D(u_textureB, corruptUV);
    }

    gl_FragColor = corrupt;
  } else {
    gl_FragColor = clean;
  }
}`
  },

  corrupt: {
    name: 'corrupt',
    label: 'Corrupt',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Data corruption simulation
  float corruptLine = step(0.95, hash(vec2(floor(uv.y * 200.0), u_time)));

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);

  if (corruptLine > 0.5 && intensity > 0.1) {
    // Corrupt this line
    float shift = hash(vec2(floor(uv.y * 200.0), u_time + 1.0)) * 0.5 * intensity;
    vec2 shiftedUV = vec2(fract(uv.x + shift), uv.y);

    // Mix random channels
    vec4 corrupt;
    corrupt.r = texture2D(u_textureA, shiftedUV).r;
    corrupt.g = texture2D(u_textureB, vec2(uv.x, shiftedUV.y)).g;
    corrupt.b = texture2D(u_textureA, vec2(shiftedUV.x, uv.y)).b;
    corrupt.a = 1.0;

    gl_FragColor = corrupt;
  } else {
    gl_FragColor = mix(colorA, colorB, u_progress);
  }
}`
  },

  static_noise: {
    name: 'static_noise',
    label: 'Static',
    fragment: `${SHADER_COMMON}
void main() {
  vec4 colorA = texture2D(u_textureA, v_texCoord);
  vec4 colorB = texture2D(u_textureB, v_texCoord);

  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // TV static noise
  float staticNoise = hash(v_texCoord * 500.0 + u_time * 100.0);

  // Occasional static bursts
  float burst = step(0.9, hash(vec2(floor(u_time * 10.0), 0.0)));

  vec4 base = mix(colorA, colorB, u_progress);
  vec3 staticColor = vec3(staticNoise);

  gl_FragColor = vec4(mix(base.rgb, staticColor, intensity * (0.2 + burst * 0.5)), 1.0);
}`
  },

  vhs: {
    name: 'vhs',
    label: 'VHS',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // VHS tracking distortion
  float tracking = sin(uv.y * 50.0 + u_time * 5.0) * 0.002 * intensity;
  tracking += sin(uv.y * 200.0 + u_time * 20.0) * 0.001 * intensity;
  uv.x += tracking;

  // VHS color bleeding
  vec4 colorA, colorB;
  colorA.r = texture2D(u_textureA, uv + vec2(0.003 * intensity, 0.0)).r;
  colorA.g = texture2D(u_textureA, uv).g;
  colorA.b = texture2D(u_textureA, uv - vec2(0.003 * intensity, 0.0)).b;
  colorA.a = 1.0;

  colorB.r = texture2D(u_textureB, uv + vec2(0.003 * intensity, 0.0)).r;
  colorB.g = texture2D(u_textureB, uv).g;
  colorB.b = texture2D(u_textureB, uv - vec2(0.003 * intensity, 0.0)).b;
  colorB.a = 1.0;

  // VHS noise lines
  float noiseLine = step(0.98, hash(vec2(floor(uv.y * 300.0), u_time)));
  vec4 result = mix(colorA, colorB, u_progress);

  // Add noise on lines
  result.rgb = mix(result.rgb, vec3(hash(uv + u_time)), noiseLine * intensity);

  // Slight desaturation (VHS look)
  float gray = dot(result.rgb, vec3(0.299, 0.587, 0.114));
  result.rgb = mix(result.rgb, vec3(gray), 0.2 * intensity);

  gl_FragColor = result;
}`
  },

  data_mosh: {
    name: 'data_mosh',
    label: 'Data Mosh',
    fragment: `${SHADER_COMMON}
void main() {
  vec2 uv = v_texCoord;
  float intensity = sin(u_progress * 3.14159265) * u_intensity;

  // Datamoshing - blocks from one frame appear in another
  vec2 blockSize = vec2(64.0, 64.0) / u_resolution;
  vec2 block = floor(uv / blockSize);
  float moshChance = hash(block + floor(u_time));

  vec4 colorA = texture2D(u_textureA, uv);
  vec4 colorB = texture2D(u_textureB, uv);

  if (moshChance > 1.0 - intensity * 0.4) {
    // This block is moshed
    vec2 sourceBlock = block + vec2(
      floor((hash(block + vec2(1.0, 0.0)) - 0.5) * 4.0),
      floor((hash(block + vec2(0.0, 1.0)) - 0.5) * 4.0)
    );
    vec2 moshUV = (sourceBlock + fract(uv / blockSize)) * blockSize;
    moshUV = clamp(moshUV, 0.0, 1.0);

    // Randomly pick source
    if (hash(block + vec2(2.0, 0.0)) > 0.5) {
      gl_FragColor = texture2D(u_textureA, moshUV);
    } else {
      gl_FragColor = texture2D(u_textureB, moshUV);
    }
  } else {
    gl_FragColor = mix(colorA, colorB, u_progress);
  }
}`
  }
}

export const GLITCH_VARIANTS = Object.keys(GLITCH_SHADERS)
