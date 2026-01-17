/**
 * WebGL Scopes Renderer
 * SCOPE-001: Waveform Monitor
 * SCOPE-002: Vectorscope Display
 * SCOPE-003: RGB Parade
 *
 * GPU-accelerated rendering of professional video scopes
 */

import {
  SCOPE_VERTEX_SHADER,
  WAVEFORM_SHADER,
  WAVEFORM_PARADE_SHADER,
  VECTORSCOPE_SHADER,
  RGB_PARADE_SHADER,
  type ScopeShaderType
} from './scope-shaders'

export interface ScopeUniforms {
  intensity?: number        // 0.5-3.0
  zoom?: number             // 1-4 (vectorscope only)
  showSkinTone?: boolean    // Vectorscope skin tone line
  isolatedChannel?: number  // 0=all, 1=R, 2=G, 3=B (parade only)
}

export class ScopesRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private programs: Map<ScopeShaderType, WebGLProgram> = new Map()

  private sourceTexture: WebGLTexture | null = null
  private positionBuffer: WebGLBuffer | null = null
  private texCoordBuffer: WebGLBuffer | null = null

  private width: number = 0
  private height: number = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.initGL()
  }

  private initGL(): void {
    const gl = this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false
    })

    if (!gl) {
      console.error('[ScopesRenderer] WebGL not supported')
      return
    }

    this.gl = gl
    this.width = this.canvas.width || 320
    this.height = this.canvas.height || 200

    if (this.width <= 0) this.width = 320
    if (this.height <= 0) this.height = 200

    gl.viewport(0, 0, this.width, this.height)

    // Create source texture
    this.sourceTexture = this.createTexture()

    // Initialize texture with placeholder
    const placeholder = new Uint8Array([128, 128, 128, 255])
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder)

    // Create geometry buffers
    this.createBuffers()
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

  private createBuffers(): void {
    const gl = this.gl
    if (!gl) return

    // Full-screen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ])

    this.positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    // Texture coordinates
    const texCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0
    ])

    this.texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)
  }

  private compileShader(source: string, type: number): WebGLShader | null {
    const gl = this.gl
    if (!gl) return null

    const shader = gl.createShader(type)
    if (!shader) return null

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const errorLog = gl.getShaderInfoLog(shader)
      console.error('[ScopesRenderer] Shader compile error:', errorLog)
      gl.deleteShader(shader)
      return null
    }

    return shader
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const gl = this.gl
    if (!gl) return null

    const vertexShader = this.compileShader(vertexSource, gl.VERTEX_SHADER)
    const fragmentShader = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER)

    if (!vertexShader || !fragmentShader) return null

    const program = gl.createProgram()
    if (!program) return null

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[ScopesRenderer] Program link error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }

    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    return program
  }

  /**
   * Get or compile shader program for scope type
   */
  private getProgram(type: ScopeShaderType): WebGLProgram | null {
    // Check cache
    const cached = this.programs.get(type)
    if (cached) return cached

    // Get shader source
    let fragmentSource: string
    switch (type) {
      case 'waveform':
        fragmentSource = WAVEFORM_SHADER
        break
      case 'waveform-parade':
        fragmentSource = WAVEFORM_PARADE_SHADER
        break
      case 'vectorscope':
        fragmentSource = VECTORSCOPE_SHADER
        break
      case 'parade':
        fragmentSource = RGB_PARADE_SHADER
        break
      default:
        fragmentSource = WAVEFORM_SHADER
    }

    // Compile program
    const program = this.createProgram(SCOPE_VERTEX_SHADER, fragmentSource)
    if (program) {
      this.programs.set(type, program)
    }
    return program
  }

  /**
   * Update source texture from video/image
   */
  updateSource(source: TexImageSource): void {
    const gl = this.gl
    if (!gl || !this.sourceTexture) return

    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  }

  /**
   * Render a specific scope type
   */
  render(type: ScopeShaderType, uniforms: ScopeUniforms = {}): void {
    const gl = this.gl
    if (!gl) return

    // Get/compile program
    const program = this.getProgram(type)
    if (!program) return

    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0.05, 0.05, 0.05, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)

    // Set up attributes
    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord')

    if (positionLoc !== -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
      gl.enableVertexAttribArray(positionLoc)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)
    }

    if (texCoordLoc !== -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
      gl.enableVertexAttribArray(texCoordLoc)
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0)
    }

    // Bind source texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_sourceTexture'), 0)

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), this.width, this.height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), uniforms.intensity ?? 1.5)
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), Date.now() / 1000.0)

    // Vectorscope-specific uniforms
    if (type === 'vectorscope') {
      gl.uniform1f(gl.getUniformLocation(program, 'u_zoom'), uniforms.zoom ?? 1.0)
      gl.uniform1i(gl.getUniformLocation(program, 'u_showSkinTone'), uniforms.showSkinTone ? 1 : 0)
    }

    // Parade-specific uniforms
    if (type === 'parade') {
      gl.uniform1i(gl.getUniformLocation(program, 'u_isolatedChannel'), uniforms.isolatedChannel ?? 0)
    }

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return

    this.width = Math.max(Math.round(width), 100)
    this.height = Math.max(Math.round(height), 100)
    this.canvas.width = this.width
    this.canvas.height = this.height

    if (this.gl) {
      this.gl.viewport(0, 0, this.width, this.height)
    }
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const gl = this.gl
    if (!gl) return

    this.programs.forEach(program => {
      gl.deleteProgram(program)
    })
    this.programs.clear()

    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture)
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer)
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer)

    this.gl = null
  }

  /**
   * Check if WebGL is supported
   */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl')
      return !!gl
    } catch {
      return false
    }
  }
}
