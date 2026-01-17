/**
 * WebGL Spectrogram Renderer
 *
 * GPU-accelerated spectrogram visualization with multiple comparison modes:
 * - Standard spectrogram (frequency vs time)
 * - Difference spectrogram (A - B)
 * - Overlay mode (A and B superimposed)
 * - Split view (A left, B right)
 * - Mel spectrogram (perceptual frequency scale)
 */

export type SpectrogramColorMap = 'viridis' | 'magma' | 'inferno' | 'plasma' | 'grayscale' | 'heat'
export type SpectrogramMode = 'single' | 'difference' | 'overlay' | 'split' | 'subtract'

interface SpectrogramConfig {
  fftSize: number
  colorMap: SpectrogramColorMap
  mode: SpectrogramMode
  minDb: number
  maxDb: number
  melScale: boolean
  showFrequencyLabels: boolean
}

// Vertex shader - simple fullscreen quad
const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// Fragment shader with all spectrogram modes
const FRAGMENT_SHADER = `
precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_spectrogramA;
uniform sampler2D u_spectrogramB;
uniform float u_minDb;
uniform float u_maxDb;
uniform int u_mode; // 0: single, 1: difference, 2: overlay, 3: split, 4: subtract
uniform int u_colorMap;
uniform float u_playhead; // 0-1 position
uniform bool u_melScale;
uniform vec2 u_resolution;

// Color maps encoded as arrays
const int NUM_COLORS = 8;

vec3 getColor(int mapIndex, float t) {
  // Clamp t to valid range
  t = clamp(t, 0.0, 1.0);

  // Viridis colormap (default)
  vec3 colors[8];

  if (mapIndex == 0) { // viridis
    colors[0] = vec3(0.267, 0.004, 0.329);
    colors[1] = vec3(0.282, 0.140, 0.458);
    colors[2] = vec3(0.253, 0.265, 0.530);
    colors[3] = vec3(0.191, 0.407, 0.556);
    colors[4] = vec3(0.127, 0.566, 0.551);
    colors[5] = vec3(0.267, 0.678, 0.480);
    colors[6] = vec3(0.478, 0.821, 0.318);
    colors[7] = vec3(0.993, 0.906, 0.144);
  } else if (mapIndex == 1) { // magma
    colors[0] = vec3(0.001, 0.000, 0.014);
    colors[1] = vec3(0.173, 0.065, 0.322);
    colors[2] = vec3(0.450, 0.104, 0.430);
    colors[3] = vec3(0.716, 0.215, 0.475);
    colors[4] = vec3(0.937, 0.391, 0.355);
    colors[5] = vec3(0.994, 0.624, 0.427);
    colors[6] = vec3(0.996, 0.843, 0.602);
    colors[7] = vec3(0.987, 0.991, 0.750);
  } else if (mapIndex == 2) { // inferno
    colors[0] = vec3(0.001, 0.000, 0.014);
    colors[1] = vec3(0.160, 0.046, 0.291);
    colors[2] = vec3(0.421, 0.050, 0.437);
    colors[3] = vec3(0.675, 0.131, 0.398);
    colors[4] = vec3(0.879, 0.322, 0.239);
    colors[5] = vec3(0.978, 0.557, 0.035);
    colors[6] = vec3(0.973, 0.800, 0.238);
    colors[7] = vec3(0.988, 0.998, 0.645);
  } else if (mapIndex == 3) { // plasma
    colors[0] = vec3(0.050, 0.030, 0.528);
    colors[1] = vec3(0.295, 0.017, 0.580);
    colors[2] = vec3(0.492, 0.014, 0.526);
    colors[3] = vec3(0.664, 0.134, 0.414);
    colors[4] = vec3(0.798, 0.280, 0.297);
    colors[5] = vec3(0.898, 0.447, 0.187);
    colors[6] = vec3(0.957, 0.637, 0.130);
    colors[7] = vec3(0.940, 0.975, 0.131);
  } else if (mapIndex == 4) { // grayscale
    colors[0] = vec3(0.0);
    colors[1] = vec3(0.14);
    colors[2] = vec3(0.28);
    colors[3] = vec3(0.42);
    colors[4] = vec3(0.57);
    colors[5] = vec3(0.71);
    colors[6] = vec3(0.85);
    colors[7] = vec3(1.0);
  } else { // heat
    colors[0] = vec3(0.0, 0.0, 0.0);
    colors[1] = vec3(0.3, 0.0, 0.3);
    colors[2] = vec3(0.5, 0.0, 0.5);
    colors[3] = vec3(0.8, 0.0, 0.2);
    colors[4] = vec3(1.0, 0.2, 0.0);
    colors[5] = vec3(1.0, 0.5, 0.0);
    colors[6] = vec3(1.0, 0.8, 0.0);
    colors[7] = vec3(1.0, 1.0, 1.0);
  }

  // Interpolate between colors
  float scaledT = t * float(NUM_COLORS - 1);
  int idx = int(floor(scaledT));
  float frac = fract(scaledT);

  // Clamp index
  idx = min(idx, NUM_COLORS - 2);

  return mix(colors[idx], colors[idx + 1], frac);
}

// Convert linear frequency to mel scale
float freqToMel(float freq) {
  return 2595.0 * log(1.0 + freq / 700.0) / log(10.0);
}

// Convert mel to linear frequency
float melToFreq(float mel) {
  return 700.0 * (pow(10.0, mel / 2595.0) - 1.0);
}

void main() {
  vec2 uv = v_texCoord;

  // Apply mel scale to y-axis if enabled
  float y = uv.y;
  if (u_melScale) {
    // Map from linear to mel scale
    float maxMel = freqToMel(22050.0); // Assume ~44.1kHz sample rate
    float mel = y * maxMel;
    y = melToFreq(mel) / 22050.0;
  }

  vec2 sampleUV = vec2(uv.x, y);

  // Sample spectrograms
  float valueA = texture2D(u_spectrogramA, sampleUV).r;
  float valueB = texture2D(u_spectrogramB, sampleUV).r;

  // Normalize to dB range
  float normalizedA = clamp((valueA - u_minDb) / (u_maxDb - u_minDb), 0.0, 1.0);
  float normalizedB = clamp((valueB - u_minDb) / (u_maxDb - u_minDb), 0.0, 1.0);

  vec3 color;

  if (u_mode == 0) {
    // Single: show only A
    color = getColor(u_colorMap, normalizedA);
  } else if (u_mode == 1) {
    // Difference: show absolute difference
    float diff = abs(normalizedA - normalizedB);
    color = getColor(u_colorMap, diff);
  } else if (u_mode == 2) {
    // Overlay: A in orange, B in cyan, overlap in white
    vec3 colorA = vec3(1.0, 0.5, 0.0) * normalizedA;
    vec3 colorB = vec3(0.0, 0.8, 1.0) * normalizedB;
    color = colorA + colorB;
  } else if (u_mode == 3) {
    // Split: left half A, right half B
    if (uv.x < 0.5) {
      color = getColor(u_colorMap, normalizedA);
    } else {
      color = getColor(u_colorMap, normalizedB);
    }
    // Draw center line
    if (abs(uv.x - 0.5) < 0.002) {
      color = vec3(1.0);
    }
  } else if (u_mode == 4) {
    // Subtract: A - B, showing positive (A louder) in red, negative (B louder) in blue
    float diff = normalizedA - normalizedB;
    if (diff > 0.0) {
      color = vec3(diff, 0.0, 0.0);
    } else {
      color = vec3(0.0, 0.0, -diff);
    }
  }

  // Draw playhead
  if (abs(uv.x - u_playhead) < 0.002) {
    color = vec3(1.0, 1.0, 1.0);
  }

  // Draw frequency grid lines (subtle)
  float gridY = fract(uv.y * 10.0);
  if (gridY < 0.01 || gridY > 0.99) {
    color = mix(color, vec3(0.3), 0.3);
  }

  gl_FragColor = vec4(color, 1.0);
}
`

export class WebGLSpectrogramRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private textureA: WebGLTexture | null = null
  private textureB: WebGLTexture | null = null

  private config: SpectrogramConfig = {
    fftSize: 2048,
    colorMap: 'viridis',
    mode: 'single',
    minDb: -90,
    maxDb: 0,
    melScale: false,
    showFrequencyLabels: true
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.initWebGL()
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext('webgl', {
      antialias: false,
      preserveDrawingBuffer: true
    })

    if (!gl) {
      console.error('WebGL not supported')
      return
    }

    this.gl = gl

    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)

    if (!vertexShader || !fragmentShader) return

    // Create program
    const program = gl.createProgram()
    if (!program) return

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      return
    }

    this.program = program

    // Create fullscreen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ])

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    // Create textures
    this.textureA = this.createTexture()
    this.textureB = this.createTexture()
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl
    if (!gl) return null

    const shader = gl.createShader(type)
    if (!shader) return null

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }

    return shader
  }

  private createTexture(): WebGLTexture | null {
    const gl = this.gl
    if (!gl) return null

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    return texture
  }

  /**
   * Generate spectrogram from audio buffer using FFT
   */
  async generateSpectrogram(audioBuffer: AudioBuffer): Promise<Float32Array> {
    const fftSize = this.config.fftSize
    const hopSize = fftSize / 4
    const channelData = audioBuffer.getChannelData(0)

    // Mix to mono if stereo
    if (audioBuffer.numberOfChannels > 1) {
      const rightChannel = audioBuffer.getChannelData(1)
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = (channelData[i] + rightChannel[i]) / 2
      }
    }

    const numFrames = Math.floor((channelData.length - fftSize) / hopSize)
    const numBins = fftSize / 2

    const spectrogram = new Float32Array(numFrames * numBins)

    // Use OfflineAudioContext for FFT
    const offlineCtx = new OfflineAudioContext(1, channelData.length, audioBuffer.sampleRate)
    const source = offlineCtx.createBufferSource()
    const tempBuffer = offlineCtx.createBuffer(1, channelData.length, audioBuffer.sampleRate)
    tempBuffer.copyToChannel(channelData, 0)
    source.buffer = tempBuffer

    const analyser = offlineCtx.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0

    source.connect(analyser)
    analyser.connect(offlineCtx.destination)
    source.start()

    // We can't use the online analyser for offline processing,
    // so let's use a manual FFT approach with Hann window

    const window = new Float32Array(fftSize)
    for (let i = 0; i < fftSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
    }

    for (let frame = 0; frame < numFrames; frame++) {
      const offset = frame * hopSize

      // Apply window to real samples
      const real = new Float32Array(fftSize)
      for (let i = 0; i < fftSize; i++) {
        const sample = channelData[offset + i] || 0
        real[i] = sample * window[i]
      }

      // Simple DFT for lower frequencies (approximation)
      for (let k = 0; k < numBins; k++) {
        let sumReal = 0
        let sumImag = 0

        // Only compute for visible frequencies
        const step = Math.max(1, Math.floor(fftSize / 256))
        for (let n = 0; n < fftSize; n += step) {
          const angle = (2 * Math.PI * k * n) / fftSize
          sumReal += real[n] * Math.cos(angle) * step
          sumImag -= real[n] * Math.sin(angle) * step
        }

        const magnitude = Math.sqrt(sumReal * sumReal + sumImag * sumImag) / fftSize
        const db = magnitude > 0 ? 20 * Math.log10(magnitude) : -100

        spectrogram[frame * numBins + k] = db
      }
    }

    return spectrogram
  }

  /**
   * Set spectrogram data for track A
   */
  setSpectrogramA(data: Float32Array, width: number, height: number): void {
    this.uploadTexture(this.textureA, data, width, height)
  }

  /**
   * Set spectrogram data for track B
   */
  setSpectrogramB(data: Float32Array, width: number, height: number): void {
    this.uploadTexture(this.textureB, data, width, height)
  }

  private uploadTexture(texture: WebGLTexture | null, data: Float32Array, width: number, height: number): void {
    const gl = this.gl
    if (!gl || !texture) return

    gl.bindTexture(gl.TEXTURE_2D, texture)

    // Normalize data to 0-1 range for texture
    const normalizedData = new Float32Array(data.length)
    for (let i = 0; i < data.length; i++) {
      normalizedData[i] = (data[i] - this.config.minDb) / (this.config.maxDb - this.config.minDb)
    }

    // Upload as luminance texture
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      width,
      height,
      0,
      gl.LUMINANCE,
      gl.FLOAT,
      normalizedData
    )
  }

  /**
   * Render the spectrogram
   */
  render(playheadPosition: number = 0): void {
    const gl = this.gl
    const program = this.program
    if (!gl || !program) return

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)

    // Bind textures
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textureA)
    gl.uniform1i(gl.getUniformLocation(program, 'u_spectrogramA'), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.textureB)
    gl.uniform1i(gl.getUniformLocation(program, 'u_spectrogramB'), 1)

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(program, 'u_minDb'), this.config.minDb)
    gl.uniform1f(gl.getUniformLocation(program, 'u_maxDb'), this.config.maxDb)
    gl.uniform1i(gl.getUniformLocation(program, 'u_mode'), this.getModeIndex())
    gl.uniform1i(gl.getUniformLocation(program, 'u_colorMap'), this.getColorMapIndex())
    gl.uniform1f(gl.getUniformLocation(program, 'u_playhead'), playheadPosition)
    gl.uniform1i(gl.getUniformLocation(program, 'u_melScale'), this.config.melScale ? 1 : 0)
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), this.canvas.width, this.canvas.height)

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private getModeIndex(): number {
    const modes: SpectrogramMode[] = ['single', 'difference', 'overlay', 'split', 'subtract']
    return modes.indexOf(this.config.mode)
  }

  private getColorMapIndex(): number {
    const maps: SpectrogramColorMap[] = ['viridis', 'magma', 'inferno', 'plasma', 'grayscale', 'heat']
    return maps.indexOf(this.config.colorMap)
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<SpectrogramConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): SpectrogramConfig {
    return { ...this.config }
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    if (this.gl) {
      this.gl.viewport(0, 0, width, height)
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    const gl = this.gl
    if (!gl) return

    if (this.textureA) gl.deleteTexture(this.textureA)
    if (this.textureB) gl.deleteTexture(this.textureB)
    if (this.program) gl.deleteProgram(this.program)
  }

  /**
   * Check if WebGL is supported
   */
  static isSupported(): boolean {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  }
}
