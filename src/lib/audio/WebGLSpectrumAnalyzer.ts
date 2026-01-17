/**
 * WebGL Spectrum Analyzer
 *
 * Real-time frequency spectrum visualization with comparison modes:
 * - Single spectrum (A or B)
 * - Overlay (A and B superimposed)
 * - Difference (|A - B|)
 * - Split (A left half, B right half)
 *
 * Features:
 * - Linear or logarithmic frequency scale
 * - Peak hold with decay
 * - Octave band smoothing
 * - RTA (Real-Time Analyzer) mode
 */

export type SpectrumMode = 'single' | 'overlay' | 'difference' | 'split' | 'subtract'
export type SpectrumScale = 'linear' | 'logarithmic' | 'mel' | 'bark'
export type SpectrumStyle = 'bars' | 'line' | 'filled' | 'gradient'

interface SpectrumConfig {
  mode: SpectrumMode
  scale: SpectrumScale
  style: SpectrumStyle
  minDb: number
  maxDb: number
  smoothing: number
  peakHold: boolean
  peakDecay: number
  octaveBands: number // 0 = full resolution, 3 = 1/3 octave, 1 = octave
  colorA: [number, number, number]
  colorB: [number, number, number]
}

// Vertex shader for spectrum bars/lines
const VERTEX_SHADER = `
attribute vec2 a_position;
attribute float a_height;
attribute float a_colorMix;

varying float v_height;
varying float v_colorMix;
varying vec2 v_position;

uniform vec2 u_resolution;

void main() {
  v_height = a_height;
  v_colorMix = a_colorMix;
  v_position = a_position;

  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = 2.0;
}
`

// Fragment shader for spectrum visualization
const FRAGMENT_SHADER = `
precision highp float;

varying float v_height;
varying float v_colorMix;
varying vec2 v_position;

uniform int u_style;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec2 u_resolution;
uniform float u_barWidth;

void main() {
  vec3 color;

  // Mix colors based on source
  if (v_colorMix < 0.5) {
    color = u_colorA;
  } else {
    color = u_colorB;
  }

  // Apply gradient based on height
  float gradient = v_height;
  color = mix(color * 0.3, color, gradient);

  // Add highlight at peaks
  if (v_height > 0.8) {
    color = mix(color, vec3(1.0), (v_height - 0.8) * 2.5);
  }

  gl_FragColor = vec4(color, 1.0);
}
`

// Grid overlay shader
const GRID_FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_minDb;
uniform float u_maxDb;
uniform int u_scale;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  float alpha = 0.0;
  vec3 color = vec3(0.3);

  // Horizontal grid lines (dB levels)
  float dbRange = u_maxDb - u_minDb;
  for (float db = -60.0; db <= 0.0; db += 6.0) {
    float y = (db - u_minDb) / dbRange;
    if (abs(uv.y - y) < 0.002) {
      alpha = 0.3;
      if (db == -12.0 || db == -24.0 || db == -48.0) {
        alpha = 0.5;
      }
    }
  }

  // Vertical grid lines (frequency)
  if (u_scale == 1) { // Logarithmic
    // Standard frequencies: 100Hz, 1kHz, 10kHz
    float freqMarkers[9];
    freqMarkers[0] = 0.1;
    freqMarkers[1] = 0.15;
    freqMarkers[2] = 0.25;
    freqMarkers[3] = 0.35;
    freqMarkers[4] = 0.5;
    freqMarkers[5] = 0.65;
    freqMarkers[6] = 0.75;
    freqMarkers[7] = 0.85;
    freqMarkers[8] = 0.95;

    for (int i = 0; i < 9; i++) {
      if (abs(uv.x - freqMarkers[i]) < 0.002) {
        alpha = 0.3;
      }
    }
  } else {
    // Linear scale markers
    for (float x = 0.1; x < 1.0; x += 0.1) {
      if (abs(uv.x - x) < 0.001) {
        alpha = 0.2;
      }
    }
  }

  gl_FragColor = vec4(color, alpha);
}
`

export class WebGLSpectrumAnalyzer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private spectrumProgram: WebGLProgram | null = null
  private gridProgram: WebGLProgram | null = null

  private positionBuffer: WebGLBuffer | null = null
  private heightBuffer: WebGLBuffer | null = null
  private colorBuffer: WebGLBuffer | null = null

  private config: SpectrumConfig = {
    mode: 'overlay',
    scale: 'logarithmic',
    style: 'filled',
    minDb: -90,
    maxDb: 0,
    smoothing: 0.8,
    peakHold: true,
    peakDecay: 0.97,
    octaveBands: 0,
    colorA: [1.0, 0.5, 0.0], // Orange
    colorB: [0.0, 0.8, 1.0]  // Cyan
  }

  // Spectrum data
  private numBins = 512
  private spectrumA: Float32Array
  private spectrumB: Float32Array
  private peaksA: Float32Array
  private peaksB: Float32Array
  private smoothedA: Float32Array
  private smoothedB: Float32Array

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.spectrumA = new Float32Array(this.numBins)
    this.spectrumB = new Float32Array(this.numBins)
    this.peaksA = new Float32Array(this.numBins)
    this.peaksB = new Float32Array(this.numBins)
    this.smoothedA = new Float32Array(this.numBins)
    this.smoothedB = new Float32Array(this.numBins)
    this.initWebGL()
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext('webgl', {
      antialias: true,
      preserveDrawingBuffer: true
    })

    if (!gl) {
      console.error('WebGL not supported')
      return
    }

    this.gl = gl
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // Create spectrum program
    this.spectrumProgram = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER)

    // Create grid program
    const gridVertexShader = `
      attribute vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
    `
    this.gridProgram = this.createProgram(gridVertexShader, GRID_FRAGMENT_SHADER)

    // Create buffers
    this.positionBuffer = gl.createBuffer()
    this.heightBuffer = gl.createBuffer()
    this.colorBuffer = gl.createBuffer()
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
   * Set spectrum data for track A
   */
  setSpectrumA(data: Float32Array | Uint8Array): void {
    const numBins = Math.min(data.length, this.numBins)

    for (let i = 0; i < numBins; i++) {
      // Convert to dB if needed
      let value: number
      if (data instanceof Uint8Array) {
        // AnalyserNode data is 0-255
        value = (data[i] / 255) * (this.config.maxDb - this.config.minDb) + this.config.minDb
      } else {
        value = data[i]
      }

      // Apply smoothing
      this.smoothedA[i] = this.smoothedA[i] * this.config.smoothing +
                          value * (1 - this.config.smoothing)
      this.spectrumA[i] = this.smoothedA[i]

      // Update peaks
      if (this.spectrumA[i] > this.peaksA[i]) {
        this.peaksA[i] = this.spectrumA[i]
      } else {
        this.peaksA[i] *= this.config.peakDecay
      }
    }
  }

  /**
   * Set spectrum data for track B
   */
  setSpectrumB(data: Float32Array | Uint8Array): void {
    const numBins = Math.min(data.length, this.numBins)

    for (let i = 0; i < numBins; i++) {
      let value: number
      if (data instanceof Uint8Array) {
        value = (data[i] / 255) * (this.config.maxDb - this.config.minDb) + this.config.minDb
      } else {
        value = data[i]
      }

      this.smoothedB[i] = this.smoothedB[i] * this.config.smoothing +
                          value * (1 - this.config.smoothing)
      this.spectrumB[i] = this.smoothedB[i]

      if (this.spectrumB[i] > this.peaksB[i]) {
        this.peaksB[i] = this.spectrumB[i]
      } else {
        this.peaksB[i] *= this.config.peakDecay
      }
    }
  }

  /**
   * Convert linear bin index to screen X position based on frequency scale
   */
  private binToX(bin: number, numBins: number): number {
    const normalizedBin = bin / numBins

    switch (this.config.scale) {
      case 'logarithmic':
        // Log scale: more resolution in low frequencies
        return Math.log10(1 + normalizedBin * 9) / Math.log10(10)

      case 'mel':
        // Mel scale: perceptual frequency scale
        const freq = normalizedBin * 22050 // Assuming 44.1kHz
        const mel = 2595 * Math.log10(1 + freq / 700)
        return mel / 2595 / Math.log10(1 + 22050 / 700)

      case 'bark':
        // Bark scale: critical band scale
        const f = normalizedBin * 22050
        const bark = 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan(Math.pow(f / 7500, 2))
        return bark / 24.0

      default: // linear
        return normalizedBin
    }
  }

  /**
   * Render the spectrum
   */
  render(): void {
    const gl = this.gl
    if (!gl || !this.spectrumProgram) return

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0.05, 0.05, 0.05, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Render grid
    if (this.gridProgram) {
      this.renderGrid()
    }

    // Build geometry based on mode
    const positions: number[] = []
    const heights: number[] = []
    const colors: number[] = []

    const dbRange = this.config.maxDb - this.config.minDb

    switch (this.config.mode) {
      case 'single':
        this.buildSingleSpectrum(positions, heights, colors, this.spectrumA, 0.0, dbRange)
        break

      case 'overlay':
        this.buildSingleSpectrum(positions, heights, colors, this.spectrumA, 0.0, dbRange)
        this.buildSingleSpectrum(positions, heights, colors, this.spectrumB, 1.0, dbRange)
        break

      case 'difference':
        this.buildDifferenceSpectrum(positions, heights, colors, dbRange)
        break

      case 'split':
        this.buildSplitSpectrum(positions, heights, colors, dbRange)
        break

      case 'subtract':
        this.buildSubtractSpectrum(positions, heights, colors, dbRange)
        break
    }

    // Upload and render
    gl.useProgram(this.spectrumProgram)

    // Position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW)
    const posLoc = gl.getAttribLocation(this.spectrumProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // Height buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.heightBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(heights), gl.DYNAMIC_DRAW)
    const heightLoc = gl.getAttribLocation(this.spectrumProgram, 'a_height')
    gl.enableVertexAttribArray(heightLoc)
    gl.vertexAttribPointer(heightLoc, 1, gl.FLOAT, false, 0, 0)

    // Color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW)
    const colorLoc = gl.getAttribLocation(this.spectrumProgram, 'a_colorMix')
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)

    // Set uniforms
    gl.uniform1i(gl.getUniformLocation(this.spectrumProgram, 'u_style'), this.getStyleIndex())
    gl.uniform3fv(gl.getUniformLocation(this.spectrumProgram, 'u_colorA'), this.config.colorA)
    gl.uniform3fv(gl.getUniformLocation(this.spectrumProgram, 'u_colorB'), this.config.colorB)
    gl.uniform2f(gl.getUniformLocation(this.spectrumProgram, 'u_resolution'), this.canvas.width, this.canvas.height)
    gl.uniform1f(gl.getUniformLocation(this.spectrumProgram, 'u_barWidth'), 2.0 / this.numBins)

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2)

    // Draw peaks if enabled
    if (this.config.peakHold) {
      this.renderPeaks()
    }
  }

  private buildSingleSpectrum(
    positions: number[],
    heights: number[],
    colors: number[],
    spectrum: Float32Array,
    colorMix: number,
    dbRange: number
  ): void {
    const barWidth = 2.0 / this.numBins * 0.8

    for (let i = 0; i < this.numBins; i++) {
      const x = this.binToX(i, this.numBins) * 2 - 1
      const height = Math.max(0, (spectrum[i] - this.config.minDb) / dbRange)
      const y = height * 2 - 1

      // Two triangles per bar
      // Triangle 1
      positions.push(x, -1)
      positions.push(x + barWidth, -1)
      positions.push(x, y)

      // Triangle 2
      positions.push(x + barWidth, -1)
      positions.push(x + barWidth, y)
      positions.push(x, y)

      // Heights and colors for each vertex
      for (let v = 0; v < 6; v++) {
        heights.push(height)
        colors.push(colorMix)
      }
    }
  }

  private buildDifferenceSpectrum(
    positions: number[],
    heights: number[],
    colors: number[],
    dbRange: number
  ): void {
    const barWidth = 2.0 / this.numBins * 0.8

    for (let i = 0; i < this.numBins; i++) {
      const x = this.binToX(i, this.numBins) * 2 - 1
      const heightA = Math.max(0, (this.spectrumA[i] - this.config.minDb) / dbRange)
      const heightB = Math.max(0, (this.spectrumB[i] - this.config.minDb) / dbRange)
      const diff = Math.abs(heightA - heightB)
      const y = diff * 2 - 1

      positions.push(x, -1)
      positions.push(x + barWidth, -1)
      positions.push(x, y)
      positions.push(x + barWidth, -1)
      positions.push(x + barWidth, y)
      positions.push(x, y)

      // Color based on which is louder
      const colorMix = heightA > heightB ? 0.0 : 1.0
      for (let v = 0; v < 6; v++) {
        heights.push(diff)
        colors.push(colorMix)
      }
    }
  }

  private buildSplitSpectrum(
    positions: number[],
    heights: number[],
    colors: number[],
    dbRange: number
  ): void {
    const halfBins = Math.floor(this.numBins / 2)
    const barWidth = 1.0 / halfBins * 0.8

    // Left half: A
    for (let i = 0; i < halfBins; i++) {
      const srcBin = Math.floor(i / halfBins * this.numBins)
      const x = (i / halfBins) - 1
      const height = Math.max(0, (this.spectrumA[srcBin] - this.config.minDb) / dbRange)
      const y = height * 2 - 1

      positions.push(x, -1)
      positions.push(x + barWidth, -1)
      positions.push(x, y)
      positions.push(x + barWidth, -1)
      positions.push(x + barWidth, y)
      positions.push(x, y)

      for (let v = 0; v < 6; v++) {
        heights.push(height)
        colors.push(0.0)
      }
    }

    // Right half: B
    for (let i = 0; i < halfBins; i++) {
      const srcBin = Math.floor(i / halfBins * this.numBins)
      const x = i / halfBins
      const height = Math.max(0, (this.spectrumB[srcBin] - this.config.minDb) / dbRange)
      const y = height * 2 - 1

      positions.push(x, -1)
      positions.push(x + barWidth, -1)
      positions.push(x, y)
      positions.push(x + barWidth, -1)
      positions.push(x + barWidth, y)
      positions.push(x, y)

      for (let v = 0; v < 6; v++) {
        heights.push(height)
        colors.push(1.0)
      }
    }
  }

  private buildSubtractSpectrum(
    positions: number[],
    heights: number[],
    colors: number[],
    dbRange: number
  ): void {
    const barWidth = 2.0 / this.numBins * 0.8

    for (let i = 0; i < this.numBins; i++) {
      const x = this.binToX(i, this.numBins) * 2 - 1
      const heightA = Math.max(0, (this.spectrumA[i] - this.config.minDb) / dbRange)
      const heightB = Math.max(0, (this.spectrumB[i] - this.config.minDb) / dbRange)
      const diff = heightA - heightB

      // Draw from center
      const centerY = 0
      const y = centerY + diff

      positions.push(x, centerY)
      positions.push(x + barWidth, centerY)
      positions.push(x, y)
      positions.push(x + barWidth, centerY)
      positions.push(x + barWidth, y)
      positions.push(x, y)

      const colorMix = diff > 0 ? 0.0 : 1.0
      for (let v = 0; v < 6; v++) {
        heights.push(Math.abs(diff))
        colors.push(colorMix)
      }
    }
  }

  private renderPeaks(): void {
    const gl = this.gl
    if (!gl || !this.spectrumProgram) return

    // Draw peak lines
    const positions: number[] = []
    const heights: number[] = []
    const colors: number[] = []

    const dbRange = this.config.maxDb - this.config.minDb
    const barWidth = 2.0 / this.numBins

    const addPeaks = (peaks: Float32Array, colorMix: number) => {
      for (let i = 0; i < this.numBins; i++) {
        const x = this.binToX(i, this.numBins) * 2 - 1
        const height = Math.max(0, (peaks[i] - this.config.minDb) / dbRange)
        const y = height * 2 - 1

        // Thin line for peak
        positions.push(x, y - 0.02)
        positions.push(x + barWidth, y - 0.02)
        positions.push(x, y + 0.02)
        positions.push(x + barWidth, y - 0.02)
        positions.push(x + barWidth, y + 0.02)
        positions.push(x, y + 0.02)

        for (let v = 0; v < 6; v++) {
          heights.push(1.0)
          colors.push(colorMix)
        }
      }
    }

    if (this.config.mode === 'single' || this.config.mode === 'overlay') {
      addPeaks(this.peaksA, 0.0)
      if (this.config.mode === 'overlay') {
        addPeaks(this.peaksB, 1.0)
      }
    }

    if (positions.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.heightBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(heights), gl.DYNAMIC_DRAW)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW)

      gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2)
    }
  }

  private renderGrid(): void {
    const gl = this.gl
    if (!gl || !this.gridProgram) return

    gl.useProgram(this.gridProgram)

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(this.gridProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.uniform2f(gl.getUniformLocation(this.gridProgram, 'u_resolution'), this.canvas.width, this.canvas.height)
    gl.uniform1f(gl.getUniformLocation(this.gridProgram, 'u_minDb'), this.config.minDb)
    gl.uniform1f(gl.getUniformLocation(this.gridProgram, 'u_maxDb'), this.config.maxDb)
    gl.uniform1i(gl.getUniformLocation(this.gridProgram, 'u_scale'), this.getScaleIndex())

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.deleteBuffer(buffer)
  }

  private getStyleIndex(): number {
    const styles: SpectrumStyle[] = ['bars', 'line', 'filled', 'gradient']
    return styles.indexOf(this.config.style)
  }

  private getScaleIndex(): number {
    const scales: SpectrumScale[] = ['linear', 'logarithmic', 'mel', 'bark']
    return scales.indexOf(this.config.scale)
  }

  /**
   * Clear all spectrum data
   */
  clear(): void {
    this.spectrumA.fill(this.config.minDb)
    this.spectrumB.fill(this.config.minDb)
    this.peaksA.fill(this.config.minDb)
    this.peaksB.fill(this.config.minDb)
    this.smoothedA.fill(this.config.minDb)
    this.smoothedB.fill(this.config.minDb)
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<SpectrumConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): SpectrumConfig {
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
    if (this.heightBuffer) gl.deleteBuffer(this.heightBuffer)
    if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer)
    if (this.spectrumProgram) gl.deleteProgram(this.spectrumProgram)
    if (this.gridProgram) gl.deleteProgram(this.gridProgram)
  }

  /**
   * Check if WebGL is supported
   */
  static isSupported(): boolean {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  }
}
