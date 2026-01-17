/**
 * WebGL Goniometer/Vectorscope Renderer
 *
 * Professional stereo field visualization:
 * - Goniometer (Lissajous display): Shows L/R relationship
 * - Vectorscope: Polar representation of stereo field
 * - Phase correlation meter: -1 (out of phase) to +1 (in phase)
 *
 * Used in professional audio tools like:
 * - iZotope Insight 2
 * - Waves PAZ Analyzer
 * - TC Electronic LM6
 */

export type GoniometerMode = 'lissajous' | 'polar' | 'split'
export type GoniometerColorMode = 'intensity' | 'frequency' | 'level'

interface GoniometerConfig {
  mode: GoniometerMode
  colorMode: GoniometerColorMode
  zoom: number
  decay: number
  showGrid: boolean
  showCorrelation: boolean
  brightness: number
}

// Vertex shader for point rendering
const VERTEX_SHADER = `
attribute vec2 a_position;
attribute float a_intensity;
attribute float a_frequency;

varying float v_intensity;
varying float v_frequency;

uniform float u_zoom;
uniform vec2 u_resolution;
uniform int u_mode;

void main() {
  v_intensity = a_intensity;
  v_frequency = a_frequency;

  vec2 pos = a_position;

  if (u_mode == 0) {
    // Lissajous: L on X, R on Y, rotated 45 degrees
    // Mid = (L+R)/2 on vertical, Side = (L-R)/2 on horizontal
    float mid = (pos.x + pos.y) * 0.5;
    float side = (pos.x - pos.y) * 0.5;
    pos = vec2(side, mid) * u_zoom;
  } else if (u_mode == 1) {
    // Polar: Convert to angle/magnitude
    float mag = length(pos) * u_zoom;
    float angle = atan(pos.y, pos.x);
    pos = vec2(cos(angle), sin(angle)) * mag;
  }

  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = 2.0;
}
`

// Fragment shader for point rendering
const POINT_FRAGMENT_SHADER = `
precision highp float;

varying float v_intensity;
varying float v_frequency;

uniform int u_colorMode;
uniform float u_brightness;

vec3 frequencyToColor(float freq) {
  // Map frequency to hue (low = red, mid = green, high = blue)
  float hue = freq * 0.7; // 0 to 0.7 (red to blue)

  // HSL to RGB conversion
  float h = hue * 6.0;
  float x = 1.0 - abs(mod(h, 2.0) - 1.0);

  vec3 rgb;
  if (h < 1.0) rgb = vec3(1.0, x, 0.0);
  else if (h < 2.0) rgb = vec3(x, 1.0, 0.0);
  else if (h < 3.0) rgb = vec3(0.0, 1.0, x);
  else if (h < 4.0) rgb = vec3(0.0, x, 1.0);
  else rgb = vec3(x, 0.0, 1.0);

  return rgb;
}

void main() {
  vec3 color;

  if (u_colorMode == 0) {
    // Intensity: Green with intensity-based brightness
    color = vec3(0.2, 0.8, 0.3) * v_intensity;
  } else if (u_colorMode == 1) {
    // Frequency: Color-coded by frequency
    color = frequencyToColor(v_frequency) * v_intensity;
  } else {
    // Level: Yellow to red based on level
    float t = v_intensity;
    color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), t);
  }

  gl_FragColor = vec4(color * u_brightness, v_intensity * 0.8);
}
`

// Grid overlay shader
const GRID_VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const GRID_FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform int u_mode;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 pos = uv * 2.0 - 1.0;

  float alpha = 0.0;

  // Center crosshair
  if (abs(pos.x) < 0.005 || abs(pos.y) < 0.005) {
    alpha = 0.5;
  }

  // Diagonal lines for Lissajous (L and R axes)
  if (u_mode == 0) {
    float diag1 = abs(pos.x + pos.y);
    float diag2 = abs(pos.x - pos.y);
    if (diag1 < 0.01 || diag2 < 0.01) {
      alpha = 0.3;
    }
  }

  // Circles for polar mode
  if (u_mode == 1) {
    float dist = length(pos);
    float ring1 = abs(dist - 0.33);
    float ring2 = abs(dist - 0.66);
    float ring3 = abs(dist - 1.0);
    if (ring1 < 0.005 || ring2 < 0.005 || ring3 < 0.005) {
      alpha = 0.3;
    }
  }

  // Outer boundary
  float boundary = max(abs(pos.x), abs(pos.y));
  if (boundary > 0.98) {
    alpha = 0.6;
  }

  gl_FragColor = vec4(0.5, 0.5, 0.5, alpha);
}
`

// Correlation meter shader
const CORRELATION_FRAGMENT_SHADER = `
precision highp float;

uniform float u_correlation;
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Meter is horizontal bar at bottom
  if (uv.y > 0.15) {
    discard;
  }

  // Background
  vec3 bgColor = vec3(0.1);

  // Scale position to -1 to 1
  float x = uv.x * 2.0 - 1.0;

  // Draw tick marks
  float alpha = 0.0;
  for (float i = -1.0; i <= 1.0; i += 0.25) {
    if (abs(x - i) < 0.01) {
      alpha = 0.5;
    }
  }

  // Draw meter fill
  float normalized = u_correlation * 0.5 + 0.5; // -1..1 to 0..1
  float meterPos = uv.x;

  vec3 color = bgColor;

  if (uv.y > 0.03 && uv.y < 0.12) {
    // In phase (positive) - green
    if (u_correlation >= 0.0 && meterPos >= 0.5 && meterPos <= normalized) {
      color = vec3(0.2, 0.8, 0.3);
    }
    // Out of phase (negative) - red
    else if (u_correlation < 0.0 && meterPos <= 0.5 && meterPos >= normalized) {
      color = vec3(0.9, 0.2, 0.2);
    }
    // Background track
    else {
      color = vec3(0.2);
    }
  }

  // Center line
  if (abs(x) < 0.008) {
    color = vec3(0.8);
  }

  gl_FragColor = vec4(color, 1.0);
}
`

export class WebGLGoniometerRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private pointProgram: WebGLProgram | null = null
  private gridProgram: WebGLProgram | null = null
  private correlationProgram: WebGLProgram | null = null

  private positionBuffer: WebGLBuffer | null = null
  private intensityBuffer: WebGLBuffer | null = null
  private frequencyBuffer: WebGLBuffer | null = null

  private config: GoniometerConfig = {
    mode: 'lissajous',
    colorMode: 'intensity',
    zoom: 1.0,
    decay: 0.95,
    showGrid: true,
    showCorrelation: true,
    brightness: 1.0
  }

  // Ring buffer for audio samples
  private bufferSize = 4096
  private positions: Float32Array
  private intensities: Float32Array
  private frequencies: Float32Array
  private writeIndex = 0
  private correlation = 0

  // Decay buffer for persistence effect
  private decayBuffer: Float32Array

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.positions = new Float32Array(this.bufferSize * 2)
    this.intensities = new Float32Array(this.bufferSize)
    this.frequencies = new Float32Array(this.bufferSize)
    this.decayBuffer = new Float32Array(this.bufferSize)
    this.initWebGL()
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext('webgl', {
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true
    })

    if (!gl) {
      console.error('WebGL not supported')
      return
    }

    this.gl = gl
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // Create point program
    this.pointProgram = this.createProgram(VERTEX_SHADER, POINT_FRAGMENT_SHADER)

    // Create grid program
    this.gridProgram = this.createProgram(GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER)

    // Create correlation program
    this.correlationProgram = this.createProgram(GRID_VERTEX_SHADER, CORRELATION_FRAGMENT_SHADER)

    // Create buffers
    this.positionBuffer = gl.createBuffer()
    this.intensityBuffer = gl.createBuffer()
    this.frequencyBuffer = gl.createBuffer()

    // Initialize position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW)
  }

  private createProgram(vertexSrc: string, fragmentSrc: string): WebGLProgram | null {
    const gl = this.gl
    if (!gl) return null

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSrc)
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSrc)
    if (!vertexShader || !fragmentShader) return null

    const program = gl.createProgram()
    if (!program) return null

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      return null
    }

    return program
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

  /**
   * Feed audio samples to the goniometer
   * @param left Left channel samples
   * @param right Right channel samples
   * @param sampleRate Sample rate for frequency estimation
   */
  feedSamples(left: Float32Array, right: Float32Array, _sampleRate: number = 44100): void {
    const numSamples = Math.min(left.length, right.length)

    // Calculate correlation for this block
    let sumLR = 0, sumLL = 0, sumRR = 0
    for (let i = 0; i < numSamples; i++) {
      sumLR += left[i] * right[i]
      sumLL += left[i] * left[i]
      sumRR += right[i] * right[i]
    }
    const denom = Math.sqrt(sumLL * sumRR)
    const blockCorrelation = denom > 0 ? sumLR / denom : 0

    // Smooth correlation
    this.correlation = this.correlation * 0.9 + blockCorrelation * 0.1

    // Downsample if needed
    const step = Math.max(1, Math.floor(numSamples / 512))

    for (let i = 0; i < numSamples; i += step) {
      const idx = this.writeIndex % this.bufferSize
      this.positions[idx * 2] = left[i]
      this.positions[idx * 2 + 1] = right[i]

      // Intensity based on level
      const level = Math.sqrt(left[i] * left[i] + right[i] * right[i])
      this.intensities[idx] = Math.min(1.0, level * 2)

      // Rough frequency estimation (zero-crossing rate)
      // This is a simplified approximation
      const freqNorm = Math.abs(left[i] - (this.positions[((idx - 1 + this.bufferSize) % this.bufferSize) * 2] || 0))
      this.frequencies[idx] = Math.min(1.0, freqNorm * 10)

      this.writeIndex++
    }
  }

  /**
   * Process audio buffer and update visualization
   */
  processAudioBuffer(audioBuffer: AudioBuffer, currentTime: number, windowSize: number = 0.1): void {
    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.floor(currentTime * sampleRate)
    const numSamples = Math.floor(windowSize * sampleRate)

    const left = audioBuffer.getChannelData(0)
    const right = audioBuffer.numberOfChannels > 1
      ? audioBuffer.getChannelData(1)
      : left

    const leftSlice = left.slice(startSample, startSample + numSamples)
    const rightSlice = right.slice(startSample, startSample + numSamples)

    this.feedSamples(leftSlice, rightSlice, sampleRate)
  }

  /**
   * Get current correlation value
   */
  getCorrelation(): number {
    return this.correlation
  }

  /**
   * Clear the display
   */
  clear(): void {
    this.positions.fill(0)
    this.intensities.fill(0)
    this.frequencies.fill(0)
    this.writeIndex = 0
    this.correlation = 0
  }

  /**
   * Render the goniometer
   */
  render(): void {
    const gl = this.gl
    if (!gl || !this.pointProgram) return

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0.05, 0.05, 0.05, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Apply decay to intensities
    for (let i = 0; i < this.bufferSize; i++) {
      this.decayBuffer[i] = this.decayBuffer[i] * this.config.decay
      if (this.intensities[i] > this.decayBuffer[i]) {
        this.decayBuffer[i] = this.intensities[i]
      }
    }

    // Render grid if enabled
    if (this.config.showGrid && this.gridProgram) {
      this.renderGrid()
    }

    // Render points
    gl.useProgram(this.pointProgram)

    // Update buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.decayBuffer, gl.DYNAMIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.frequencyBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.frequencies, gl.DYNAMIC_DRAW)

    // Set attributes
    const posLoc = gl.getAttribLocation(this.pointProgram, 'a_position')
    const intLoc = gl.getAttribLocation(this.pointProgram, 'a_intensity')
    const freqLoc = gl.getAttribLocation(this.pointProgram, 'a_frequency')

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.intensityBuffer)
    gl.enableVertexAttribArray(intLoc)
    gl.vertexAttribPointer(intLoc, 1, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.frequencyBuffer)
    gl.enableVertexAttribArray(freqLoc)
    gl.vertexAttribPointer(freqLoc, 1, gl.FLOAT, false, 0, 0)

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(this.pointProgram, 'u_zoom'), this.config.zoom)
    gl.uniform2f(gl.getUniformLocation(this.pointProgram, 'u_resolution'), this.canvas.width, this.canvas.height)
    gl.uniform1i(gl.getUniformLocation(this.pointProgram, 'u_mode'), this.getModeIndex())
    gl.uniform1i(gl.getUniformLocation(this.pointProgram, 'u_colorMode'), this.getColorModeIndex())
    gl.uniform1f(gl.getUniformLocation(this.pointProgram, 'u_brightness'), this.config.brightness)

    // Draw points
    gl.drawArrays(gl.POINTS, 0, this.bufferSize)

    // Render correlation meter if enabled
    if (this.config.showCorrelation && this.correlationProgram) {
      this.renderCorrelationMeter()
    }
  }

  private renderGrid(): void {
    const gl = this.gl
    if (!gl || !this.gridProgram) return

    gl.useProgram(this.gridProgram)

    // Fullscreen quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(this.gridProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.uniform2f(gl.getUniformLocation(this.gridProgram, 'u_resolution'), this.canvas.width, this.canvas.height)
    gl.uniform1i(gl.getUniformLocation(this.gridProgram, 'u_mode'), this.getModeIndex())

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.deleteBuffer(buffer)
  }

  private renderCorrelationMeter(): void {
    const gl = this.gl
    if (!gl || !this.correlationProgram) return

    gl.useProgram(this.correlationProgram)

    // Fullscreen quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(this.correlationProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.uniform2f(gl.getUniformLocation(this.correlationProgram, 'u_resolution'), this.canvas.width, this.canvas.height)
    gl.uniform1f(gl.getUniformLocation(this.correlationProgram, 'u_correlation'), this.correlation)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.deleteBuffer(buffer)
  }

  private getModeIndex(): number {
    const modes: GoniometerMode[] = ['lissajous', 'polar', 'split']
    return modes.indexOf(this.config.mode)
  }

  private getColorModeIndex(): number {
    const modes: GoniometerColorMode[] = ['intensity', 'frequency', 'level']
    return modes.indexOf(this.config.colorMode)
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<GoniometerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): GoniometerConfig {
    return { ...this.config }
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    const gl = this.gl
    if (!gl) return

    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer)
    if (this.intensityBuffer) gl.deleteBuffer(this.intensityBuffer)
    if (this.frequencyBuffer) gl.deleteBuffer(this.frequencyBuffer)
    if (this.pointProgram) gl.deleteProgram(this.pointProgram)
    if (this.gridProgram) gl.deleteProgram(this.gridProgram)
    if (this.correlationProgram) gl.deleteProgram(this.correlationProgram)
  }

  /**
   * Check if WebGL is supported
   */
  static isSupported(): boolean {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  }
}
