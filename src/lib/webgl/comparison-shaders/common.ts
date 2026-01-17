/**
 * Common GLSL utilities for comparison shaders
 * Includes color space conversions, edge detection, SSIM, and visualization functions
 */

// Vertex shader (same for all comparison modes)
export const COMPARISON_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`

// Common uniforms and precision
export const COMPARISON_HEADER = `
precision highp float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
uniform vec2 u_resolution;
uniform vec2 u_textureASize;  // Original dimensions of texture A
uniform vec2 u_textureBSize;  // Original dimensions of texture B
uniform float u_amplification;
uniform float u_threshold;
uniform float u_opacity;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_blockSize;
uniform float u_loupeSize;
uniform float u_loupeZoom;
uniform float u_checkerSize;

varying vec2 v_texCoord;

// Aspect-ratio-correct UV calculation (letterbox/pillarbox)
// Returns UV coordinates that maintain aspect ratio, with out-of-bounds check
vec2 getAspectCorrectUV(vec2 uv, vec2 textureSize, vec2 canvasSize) {
  float textureAspect = textureSize.x / textureSize.y;
  float canvasAspect = canvasSize.x / canvasSize.y;

  vec2 scale;
  vec2 offset;

  if (textureAspect > canvasAspect) {
    // Texture is wider - pillarbox (black bars top/bottom)
    scale = vec2(1.0, canvasAspect / textureAspect);
    offset = vec2(0.0, (1.0 - scale.y) * 0.5);
  } else {
    // Texture is taller - letterbox (black bars left/right)
    scale = vec2(textureAspect / canvasAspect, 1.0);
    offset = vec2((1.0 - scale.x) * 0.5, 0.0);
  }

  // Transform UV from canvas space to texture space
  return (uv - offset) / scale;
}

// Check if UV is within valid texture bounds (0-1)
bool isUVValid(vec2 uv) {
  return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
}

// Sample texture with aspect ratio correction and black for out-of-bounds
vec4 sampleTextureA(vec2 uv) {
  vec2 correctedUV = getAspectCorrectUV(uv, u_textureASize, u_resolution);
  if (!isUVValid(correctedUV)) {
    return vec4(0.0, 0.0, 0.0, 1.0);
  }
  return texture2D(u_textureA, correctedUV);
}

vec4 sampleTextureB(vec2 uv) {
  vec2 correctedUV = getAspectCorrectUV(uv, u_textureBSize, u_resolution);
  if (!isUVValid(correctedUV)) {
    return vec4(0.0, 0.0, 0.0, 1.0);
  }
  return texture2D(u_textureB, correctedUV);
}
`

// Color space conversion utilities
export const COLOR_SPACE_UTILS = `
// sRGB to Linear RGB
vec3 srgbToLinear(vec3 srgb) {
  return mix(
    srgb / 12.92,
    pow((srgb + 0.055) / 1.055, vec3(2.4)),
    step(0.04045, srgb)
  );
}

// Linear RGB to sRGB
vec3 linearToSrgb(vec3 linear) {
  return mix(
    linear * 12.92,
    1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, linear)
  );
}

// RGB to XYZ (D65 illuminant)
vec3 rgbToXyz(vec3 rgb) {
  vec3 linear = srgbToLinear(rgb);
  mat3 m = mat3(
    0.4124564, 0.3575761, 0.1804375,
    0.2126729, 0.7151522, 0.0721750,
    0.0193339, 0.1191920, 0.9503041
  );
  return m * linear;
}

// XYZ to LAB
vec3 xyzToLab(vec3 xyz) {
  // D65 white point
  vec3 n = xyz / vec3(0.95047, 1.0, 1.08883);
  vec3 v = mix(
    (7.787 * n) + (16.0 / 116.0),
    pow(n, vec3(1.0 / 3.0)),
    step(0.008856, n)
  );
  return vec3(
    (116.0 * v.y) - 16.0,  // L: 0-100
    500.0 * (v.x - v.y),    // a: -128 to 128
    200.0 * (v.y - v.z)     // b: -128 to 128
  );
}

// RGB to LAB
vec3 rgbToLab(vec3 rgb) {
  return xyzToLab(rgbToXyz(rgb));
}

// RGB to HSL
vec3 rgbToHsl(vec3 rgb) {
  float maxC = max(rgb.r, max(rgb.g, rgb.b));
  float minC = min(rgb.r, min(rgb.g, rgb.b));
  float l = (maxC + minC) / 2.0;

  if (maxC == minC) {
    return vec3(0.0, 0.0, l);
  }

  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);

  float h;
  if (maxC == rgb.r) {
    h = (rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6.0 : 0.0);
  } else if (maxC == rgb.g) {
    h = (rgb.b - rgb.r) / d + 2.0;
  } else {
    h = (rgb.r - rgb.g) / d + 4.0;
  }
  h /= 6.0;

  return vec3(h, s, l);
}

// RGB to YUV (for luminance/chroma separation)
vec3 rgbToYuv(vec3 rgb) {
  float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  float u = 0.492 * (rgb.b - y);
  float v = 0.877 * (rgb.r - y);
  return vec3(y, u, v);
}

// Luminance (Rec. 709)
float luminance(vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}
`

// Delta E color difference (CIE76 simplified)
export const DELTA_E_UTILS = `
// CIE76 Delta E (Euclidean distance in LAB space)
float deltaE76(vec3 lab1, vec3 lab2) {
  vec3 d = lab1 - lab2;
  return sqrt(dot(d, d));
}

// CIE94 Delta E (more perceptually uniform)
float deltaE94(vec3 lab1, vec3 lab2) {
  float dL = lab1.x - lab2.x;
  float c1 = sqrt(lab1.y * lab1.y + lab1.z * lab1.z);
  float c2 = sqrt(lab2.y * lab2.y + lab2.z * lab2.z);
  float dC = c1 - c2;
  float dA = lab1.y - lab2.y;
  float dB = lab1.z - lab2.z;
  float dH = sqrt(max(0.0, dA * dA + dB * dB - dC * dC));

  float sL = 1.0;
  float sC = 1.0 + 0.045 * c1;
  float sH = 1.0 + 0.015 * c1;

  float lTerm = dL / sL;
  float cTerm = dC / sC;
  float hTerm = dH / sH;

  return sqrt(lTerm * lTerm + cTerm * cTerm + hTerm * hTerm);
}
`

// Edge detection utilities
export const EDGE_DETECTION_UTILS = `
// Sobel edge detection
vec2 sobel(sampler2D tex, vec2 uv, vec2 texelSize) {
  float tl = luminance(texture2D(tex, uv + vec2(-texelSize.x, -texelSize.y)).rgb);
  float t  = luminance(texture2D(tex, uv + vec2(0.0, -texelSize.y)).rgb);
  float tr = luminance(texture2D(tex, uv + vec2(texelSize.x, -texelSize.y)).rgb);
  float l  = luminance(texture2D(tex, uv + vec2(-texelSize.x, 0.0)).rgb);
  float r  = luminance(texture2D(tex, uv + vec2(texelSize.x, 0.0)).rgb);
  float bl = luminance(texture2D(tex, uv + vec2(-texelSize.x, texelSize.y)).rgb);
  float b  = luminance(texture2D(tex, uv + vec2(0.0, texelSize.y)).rgb);
  float br = luminance(texture2D(tex, uv + vec2(texelSize.x, texelSize.y)).rgb);

  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

  return vec2(gx, gy);
}

// Edge magnitude
float edgeMagnitude(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec2 edge = sobel(tex, uv, texelSize);
  return length(edge);
}

// Edge direction (in radians)
float edgeDirection(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec2 edge = sobel(tex, uv, texelSize);
  return atan(edge.y, edge.x);
}

// Gradient magnitude and direction
vec2 gradient(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec2 edge = sobel(tex, uv, texelSize);
  return vec2(length(edge), atan(edge.y, edge.x));
}
`

// SSIM utilities
// Note: WebGL 1.0 requires constant loop bounds, so we use #define for radius
export const SSIM_UTILS = `
#define SSIM_RADIUS 4.0
#define SSIM_KERNEL_SIZE 81.0

// Local mean (box filter approximation) - fixed 9x9 kernel
vec3 localMean(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec3 sum = vec3(0.0);

  for (float y = -4.0; y <= 4.0; y += 1.0) {
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      sum += texture2D(tex, uv + vec2(x, y) * texelSize).rgb;
    }
  }

  return sum / SSIM_KERNEL_SIZE;
}

// Local variance - fixed 9x9 kernel
vec3 localVariance(sampler2D tex, vec2 uv, vec2 texelSize, vec3 mean) {
  vec3 sum = vec3(0.0);

  for (float y = -4.0; y <= 4.0; y += 1.0) {
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      vec3 diff = texture2D(tex, uv + vec2(x, y) * texelSize).rgb - mean;
      sum += diff * diff;
    }
  }

  return sum / SSIM_KERNEL_SIZE;
}

// Local covariance - fixed 9x9 kernel
vec3 localCovariance(sampler2D texA, sampler2D texB, vec2 uv, vec2 texelSize, vec3 meanA, vec3 meanB) {
  vec3 sum = vec3(0.0);

  for (float y = -4.0; y <= 4.0; y += 1.0) {
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      vec2 offset = vec2(x, y) * texelSize;
      vec3 diffA = texture2D(texA, uv + offset).rgb - meanA;
      vec3 diffB = texture2D(texB, uv + offset).rgb - meanB;
      sum += diffA * diffB;
    }
  }

  return sum / SSIM_KERNEL_SIZE;
}

// SSIM calculation (simplified, per-channel)
// Returns value 0-1 where 1 is identical
float ssimLocal(vec2 uv, vec2 texelSize) {
  float C1 = 0.0001; // (K1*L)^2 where K1=0.01, L=1
  float C2 = 0.0009; // (K2*L)^2 where K2=0.03, L=1

  vec3 meanA = localMean(u_textureA, uv, texelSize);
  vec3 meanB = localMean(u_textureB, uv, texelSize);

  vec3 varA = localVariance(u_textureA, uv, texelSize, meanA);
  vec3 varB = localVariance(u_textureB, uv, texelSize, meanB);

  vec3 covar = localCovariance(u_textureA, u_textureB, uv, texelSize, meanA, meanB);

  vec3 numerator = (2.0 * meanA * meanB + C1) * (2.0 * covar + C2);
  vec3 denominator = (meanA * meanA + meanB * meanB + C1) * (varA + varB + C2);

  vec3 ssim = numerator / denominator;

  // Return average across channels
  return (ssim.r + ssim.g + ssim.b) / 3.0;
}
`

// Visualization utilities
export const VISUALIZATION_UTILS = `
// Grayscale visualization
vec3 grayscaleVis(float value) {
  return vec3(value);
}

// Heat map (black -> blue -> green -> yellow -> red -> white)
vec3 heatmapVis(float value) {
  value = clamp(value, 0.0, 1.0);

  vec3 color;
  if (value < 0.25) {
    color = mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), value * 4.0);
  } else if (value < 0.5) {
    color = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), (value - 0.25) * 4.0);
  } else if (value < 0.75) {
    color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (value - 0.5) * 4.0);
  } else {
    color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (value - 0.75) * 4.0);
  }

  return color;
}

// Rainbow visualization (full spectrum)
vec3 rainbowVis(float value) {
  value = clamp(value, 0.0, 1.0);
  float h = (1.0 - value) * 0.8; // Red at high values, blue at low

  // HSV to RGB (S=1, V=1)
  float c = 1.0;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));

  vec3 rgb;
  if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
  else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
  else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
  else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
  else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);

  return rgb;
}

// Red-Green diverging (for +/- differences)
vec3 redGreenVis(float value) {
  // value -1 to 1, mapped to 0-1
  float v = value * 0.5 + 0.5;

  if (v < 0.5) {
    return mix(vec3(0.0, 0.8, 0.0), vec3(0.2, 0.2, 0.2), v * 2.0);
  } else {
    return mix(vec3(0.2, 0.2, 0.2), vec3(0.8, 0.0, 0.0), (v - 0.5) * 2.0);
  }
}

// Hue wheel visualization (for hue differences)
vec3 hueWheelVis(float hue) {
  hue = fract(hue);
  float c = 1.0;
  float x = c * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));

  vec3 rgb;
  if (hue < 1.0/6.0) rgb = vec3(c, x, 0.0);
  else if (hue < 2.0/6.0) rgb = vec3(x, c, 0.0);
  else if (hue < 3.0/6.0) rgb = vec3(0.0, c, x);
  else if (hue < 4.0/6.0) rgb = vec3(0.0, x, c);
  else if (hue < 5.0/6.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);

  return rgb;
}
`

// Combine all common utilities
export const COMPARISON_COMMON = `
${COMPARISON_HEADER}
${COLOR_SPACE_UTILS}
${DELTA_E_UTILS}
${EDGE_DETECTION_UTILS}
${SSIM_UTILS}
${VISUALIZATION_UTILS}
`

// Shader info interface
export interface ComparisonShader {
  name: string
  label: string
  category: 'difference' | 'structural' | 'color' | 'professional' | 'video' | 'weighting' | 'analysis' | 'exposure'
  description: string
  fragment: string
}
