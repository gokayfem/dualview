/**
 * WebGL Comparison Renderer
 * GPU-accelerated image/video comparison with 26 analysis modes
 */

import type { WebGLComparisonMode } from '../../types'
import { COMPARISON_VERTEX_SHADER, getComparisonShader } from './comparison-shaders'

export interface ComparisonUniforms {
  amplification?: number  // 1-100
  threshold?: number      // 0-1
  opacity?: number        // 0-1
  blockSize?: number      // 4, 8, 16, 32
  loupeSize?: number      // 100-400
  loupeZoom?: number      // 2-8
  checkerSize?: number    // 8-128
  mouseX?: number         // 0-1
  mouseY?: number         // 0-1
  textureAWidth?: number  // Original texture A width
  textureAHeight?: number // Original texture A height
  textureBWidth?: number  // Original texture B width
  textureBHeight?: number // Original texture B height
}

export class WebGLComparisonRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private programs: Map<string, WebGLProgram> = new Map()
  private currentProgram: WebGLProgram | null = null
  private currentMode: WebGLComparisonMode | null = null

  private textureA: WebGLTexture | null = null
  private textureB: WebGLTexture | null = null
  private positionBuffer: WebGLBuffer | null = null
  private texCoordBuffer: WebGLBuffer | null = null

  private width: number = 0
  private height: number = 0
  private startTime: number = Date.now()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.initGL()
  }

  private initGL(): void {
    console.log('[WebGL] initGL called, canvas:', this.canvas.width, 'x', this.canvas.height)

    const gl = this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false
    })

    if (!gl) {
      console.error('[WebGL] WebGL not supported')
      return
    }

    console.log('[WebGL] Got WebGL context')
    this.gl = gl
    this.width = this.canvas.width || 640
    this.height = this.canvas.height || 480

    // Ensure valid dimensions
    if (this.width <= 0) this.width = 640
    if (this.height <= 0) this.height = 480

    console.log('[WebGL] Dimensions set to:', this.width, 'x', this.height)

    // Set initial viewport
    gl.viewport(0, 0, this.width, this.height)

    // Create textures
    this.textureA = this.createTexture()
    this.textureB = this.createTexture()
    console.log('[WebGL] Textures created:', this.textureA, this.textureB)

    // Initialize textures with placeholder 1x1 pixel data to avoid errors
    const placeholder = new Uint8Array([128, 128, 128, 255])
    gl.bindTexture(gl.TEXTURE_2D, this.textureA)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder)
    gl.bindTexture(gl.TEXTURE_2D, this.textureB)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder)

    // Create geometry buffers
    this.createBuffers()
    console.log('[WebGL] Buffers created')
  }

  private createTexture(): WebGLTexture | null {
    const gl = this.gl
    if (!gl) return null

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    return texture
  }

  private createBuffers(): void {
    const gl = this.gl
    if (!gl) return

    // Position buffer (full-screen quad)
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ])

    this.positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    // Texture coordinate buffer
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
    if (!gl) {
      console.error('[WebGL] compileShader: No GL context')
      return null
    }

    const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'
    console.log('[WebGL] Compiling', shaderType, 'shader, source length:', source.length)

    const shader = gl.createShader(type)
    if (!shader) {
      console.error('[WebGL] Failed to create shader')
      return null
    }

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const errorLog = gl.getShaderInfoLog(shader)
      console.error(`[WebGL] ${shaderType} shader compile error:`, errorLog)
      // Log first 500 chars of source for context
      console.error('[WebGL] Shader source (first 500 chars):', source.substring(0, 500))
      gl.deleteShader(shader)
      return null
    }

    console.log('[WebGL]', shaderType, 'shader compiled OK')
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
      console.error('Program link error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }

    // Clean up shaders after linking
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    return program
  }

  /**
   * Set the comparison mode (compiles shader if needed)
   */
  setMode(mode: WebGLComparisonMode): boolean {
    console.log('[WebGL] setMode called with:', mode)

    if (!this.gl) {
      console.error('[WebGL] setMode: No GL context')
      return false
    }

    if (mode === this.currentMode && this.currentProgram) {
      console.log('[WebGL] Mode already set, reusing program')
      return true
    }

    // Check cache
    const cachedProgram = this.programs.get(mode)

    if (cachedProgram) {
      console.log('[WebGL] Using cached program for:', mode)
      this.currentProgram = cachedProgram
      this.currentMode = mode
      return true
    }

    // Get shader source
    const shader = getComparisonShader(mode)
    if (!shader) {
      console.error(`[WebGL] Unknown comparison mode: ${mode}`)
      return false
    }
    console.log('[WebGL] Got shader for mode:', mode, 'fragment length:', shader.fragment.length)

    // Compile program
    const newProgram = this.createProgram(COMPARISON_VERTEX_SHADER, shader.fragment)
    if (!newProgram) {
      console.error(`[WebGL] Failed to compile shader for ${mode}`)
      // Try fallback to simplest shader
      const debugShader = getComparisonShader('diff-debug')
      if (debugShader) {
        console.log('[WebGL] Trying fallback to diff-debug')
        const fallbackProgram = this.createProgram(COMPARISON_VERTEX_SHADER, debugShader.fragment)
        if (fallbackProgram) {
          this.programs.set('diff-debug', fallbackProgram)
          this.currentProgram = fallbackProgram
          this.currentMode = 'diff-debug'
          console.log('[WebGL] Fallback to diff-debug succeeded')
          return true
        }
      }
      return false
    }

    console.log('[WebGL] Program compiled successfully for:', mode)
    this.programs.set(mode, newProgram)
    this.currentProgram = newProgram
    this.currentMode = mode
    return true
  }

  /**
   * Update texture from image/video source
   */
  updateTexture(which: 'A' | 'B', source: TexImageSource): void {
    const gl = this.gl
    if (!gl) return

    const texture = which === 'A' ? this.textureA : this.textureB
    if (!texture) return

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  }

  private renderCount = 0

  /**
   * Render the comparison
   */
  render(uniforms: ComparisonUniforms = {}): void {
    const gl = this.gl
    if (!gl) {
      if (this.renderCount < 5) console.error('[WebGL] render: No GL context')
      return
    }

    // Check if context is lost
    if (gl.isContextLost()) {
      if (this.renderCount < 5) console.error('[WebGL] render: Context is lost!')
      return
    }

    // Try to set a default mode if none is set
    if (!this.currentProgram) {
      console.log('[WebGL] render: No program, trying to set diff-debug')
      if (!this.setMode('diff-debug')) {
        console.error('[WebGL] Cannot render - no program available')
        return
      }
    }

    // Store program in local const for TypeScript
    const program = this.currentProgram!

    // Validate program
    if (!gl.isProgram(program)) {
      if (this.renderCount < 5) console.error('[WebGL] render: Invalid program!')
      return
    }

    // Log first few renders
    if (this.renderCount < 5) {
      console.log('[WebGL] render #' + this.renderCount, 'mode:', this.currentMode, 'size:', this.width, 'x', this.height)
      this.renderCount++
    }

    // Ensure valid dimensions
    if (this.width <= 0 || this.height <= 0) {
      this.width = this.canvas.width || 640
      this.height = this.canvas.height || 480
    }

    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)

    // Set up attributes
    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord')

    if (this.renderCount < 5) {
      console.log('[WebGL] Attribute locations: position=', positionLoc, 'texCoord=', texCoordLoc)
    }

    if (positionLoc === -1) {
      if (this.renderCount < 5) console.error('[WebGL] a_position attribute not found in shader!')
      return
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    // texCoord might be optimized out in simple shaders like diff-debug
    if (texCoordLoc !== -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
      gl.enableVertexAttribArray(texCoordLoc)
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0)
    }

    // Bind textures
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textureA)
    gl.uniform1i(gl.getUniformLocation(program, 'u_textureA'), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.textureB)
    gl.uniform1i(gl.getUniformLocation(program, 'u_textureB'), 1)

    // Set uniforms
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_resolution'),
      this.width,
      this.height
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_amplification'),
      uniforms.amplification ?? 1.0
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_threshold'),
      uniforms.threshold ?? 0.0
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_opacity'),
      uniforms.opacity ?? 1.0
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_time'),
      (Date.now() - this.startTime) / 1000.0
    )

    gl.uniform2f(
      gl.getUniformLocation(program, 'u_mouse'),
      uniforms.mouseX ?? 0.5,
      uniforms.mouseY ?? 0.5
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_blockSize'),
      uniforms.blockSize ?? 16.0
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_loupeSize'),
      uniforms.loupeSize ?? 200.0
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_loupeZoom'),
      uniforms.loupeZoom ?? 4.0
    )

    gl.uniform1f(
      gl.getUniformLocation(program, 'u_checkerSize'),
      uniforms.checkerSize ?? 32.0
    )

    // Set texture dimensions for aspect ratio correction
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_textureASize'),
      uniforms.textureAWidth ?? this.width,
      uniforms.textureAHeight ?? this.height
    )

    gl.uniform2f(
      gl.getUniformLocation(program, 'u_textureBSize'),
      uniforms.textureBWidth ?? this.width,
      uniforms.textureBHeight ?? this.height
    )

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // Check for errors
    const error = gl.getError()
    if (error !== gl.NO_ERROR) {
      const errorNames: Record<number, string> = {
        [gl.INVALID_ENUM]: 'INVALID_ENUM',
        [gl.INVALID_VALUE]: 'INVALID_VALUE',
        [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
        [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION',
        [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
        [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL'
      }
      console.error('[WebGL] Error after draw:', errorNames[error] || error)
    }

    // Log successful render for first few frames
    if (this.renderCount < 5) {
      console.log('[WebGL] Render complete #' + this.renderCount, 'canvas size:', this.canvas.width, 'x', this.canvas.height)
    }
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    // Validate dimensions - don't resize to invalid values
    if (width <= 0 || height <= 0) {
      console.warn('[WebGL] resize called with invalid dimensions:', width, 'x', height)
      return
    }

    // Round to integers and enforce minimum size
    width = Math.max(Math.round(width), 100)
    height = Math.max(Math.round(height), 100)

    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height

    if (this.gl) {
      this.gl.viewport(0, 0, width, height)
    }
  }

  /**
   * Get the canvas element
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

    // Delete programs
    this.programs.forEach(program => {
      gl.deleteProgram(program)
    })
    this.programs.clear()

    // Delete textures
    if (this.textureA) gl.deleteTexture(this.textureA)
    if (this.textureB) gl.deleteTexture(this.textureB)

    // Delete buffers
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

  /**
   * Get all available modes
   */
  static getModes(): WebGLComparisonMode[] {
    return [
      // Difference
      'diff-absolute', 'diff-perceptual', 'diff-luminance',
      'diff-chroma', 'diff-threshold', 'diff-amplified',
      // Structural
      'struct-ssim', 'struct-edge', 'struct-gradient',
      'struct-contrast', 'struct-block',
      // Color
      'color-hue', 'color-saturation', 'color-false',
      'color-channels', 'color-histogram',
      // Professional
      'pro-anaglyph', 'pro-checkerboard', 'pro-onion',
      'pro-loupe', 'pro-frequency', 'pro-mask',
      // Video
      'video-temporal', 'video-motion', 'video-flicker', 'video-blend',
      // Analysis (ANALYSIS-001, 002, 003)
      'analysis-multiscale-edge', 'analysis-local-contrast',
      'analysis-gradient-direction', 'analysis-direction-histogram'
    ]
  }
}
