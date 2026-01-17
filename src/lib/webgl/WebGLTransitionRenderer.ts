/**
 * WebGL Transition Renderer
 * Renders shader-based transitions between two video/image sources
 */

import type { TransitionEngine } from '../../types'
import { getShader, getAllVariants } from './shaders'

// Vertex shader - simple fullscreen quad
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

// Default fragment shader (crossfade)
const DEFAULT_FRAGMENT = `
  precision mediump float;
  uniform sampler2D u_textureA;
  uniform sampler2D u_textureB;
  uniform float u_progress;
  uniform float u_intensity;
  varying vec2 v_texCoord;

  void main() {
    vec4 colorA = texture2D(u_textureA, v_texCoord);
    vec4 colorB = texture2D(u_textureB, v_texCoord);
    gl_FragColor = mix(colorA, colorB, u_progress);
  }
`

interface ShaderProgram {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation | null>
  attributes: Record<string, number>
}

export class WebGLTransitionRenderer {
  private gl: WebGLRenderingContext
  private canvas: HTMLCanvasElement
  private programs: Map<string, ShaderProgram> = new Map()
  private textureA: WebGLTexture | null = null
  private textureB: WebGLTexture | null = null
  private positionBuffer: WebGLBuffer | null = null
  private texCoordBuffer: WebGLBuffer | null = null
  private currentProgram: ShaderProgram | null = null
  private width: number
  private height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height

    // Create offscreen canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height

    // Get WebGL context
    const gl = this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      alpha: false
    })

    if (!gl) {
      throw new Error('WebGL not supported')
    }

    this.gl = gl

    // Initialize buffers
    this.initBuffers()

    // Initialize textures
    this.textureA = this.createTexture()
    this.textureB = this.createTexture()

    // Compile default crossfade shader
    this.compileShader('crossfade', DEFAULT_FRAGMENT)
    this.setShader('crossfade')
  }

  /**
   * Check if WebGL is supported
   */
  static isSupported(): boolean {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    } catch {
      return false
    }
  }

  /**
   * Get all available variants for a transition engine
   */
  static getVariants(engine: TransitionEngine): string[] {
    return getAllVariants(engine)
  }

  /**
   * Initialize vertex and texture coordinate buffers
   */
  private initBuffers(): void {
    const gl = this.gl

    // Position buffer (fullscreen quad)
    this.positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW)

    // Texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]), gl.STATIC_DRAW)
  }

  /**
   * Create a WebGL texture
   */
  private createTexture(): WebGLTexture | null {
    const gl = this.gl
    const texture = gl.createTexture()

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    return texture
  }

  /**
   * Compile and cache a shader program
   */
  compileShader(name: string, fragmentSource: string): void {
    const gl = this.gl

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, VERTEX_SHADER)
    gl.compileShader(vertexShader)

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader))
      gl.deleteShader(vertexShader)
      return
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragmentShader, fragmentSource)
    gl.compileShader(fragmentShader)

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader))
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      return
    }

    // Create program
    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      return
    }

    // Clean up shaders (they're part of the program now)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    // Get attribute locations
    const attributes: Record<string, number> = {
      a_position: gl.getAttribLocation(program, 'a_position'),
      a_texCoord: gl.getAttribLocation(program, 'a_texCoord'),
    }

    // Get uniform locations
    const uniforms: Record<string, WebGLUniformLocation | null> = {
      u_textureA: gl.getUniformLocation(program, 'u_textureA'),
      u_textureB: gl.getUniformLocation(program, 'u_textureB'),
      u_progress: gl.getUniformLocation(program, 'u_progress'),
      u_intensity: gl.getUniformLocation(program, 'u_intensity'),
      u_resolution: gl.getUniformLocation(program, 'u_resolution'),
      u_time: gl.getUniformLocation(program, 'u_time'),
    }

    // Cache the program
    this.programs.set(name, { program, uniforms, attributes })
  }

  /**
   * Set the active shader program
   */
  setShader(name: string): boolean {
    const programInfo = this.programs.get(name)
    if (!programInfo) {
      console.warn(`Shader "${name}" not found`)
      return false
    }

    this.currentProgram = programInfo
    this.gl.useProgram(programInfo.program)
    return true
  }

  /**
   * Load and set a shader by engine and variant name
   */
  loadTransition(engine: TransitionEngine, variant: string): boolean {
    const shaderKey = `${engine}_${variant}`

    // Check if already compiled
    if (this.programs.has(shaderKey)) {
      return this.setShader(shaderKey)
    }

    // Get shader source
    const shader = getShader(engine, variant)
    if (!shader) {
      console.warn(`Shader not found: ${engine}/${variant}`)
      return false
    }

    // Compile and set
    this.compileShader(shaderKey, shader.fragment)
    return this.setShader(shaderKey)
  }

  /**
   * Update a texture from a video or image element
   */
  updateTexture(which: 'A' | 'B', source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): void {
    const gl = this.gl
    const texture = which === 'A' ? this.textureA : this.textureB

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  }

  /**
   * Render the transition
   */
  render(progress: number, intensity: number = 1.0, time: number = 0): void {
    const gl = this.gl
    const programInfo = this.currentProgram

    if (!programInfo) {
      console.warn('No shader program set')
      return
    }

    // Set viewport
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(programInfo.attributes.a_position)
    gl.vertexAttribPointer(programInfo.attributes.a_position, 2, gl.FLOAT, false, 0, 0)

    // Bind texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.enableVertexAttribArray(programInfo.attributes.a_texCoord)
    gl.vertexAttribPointer(programInfo.attributes.a_texCoord, 2, gl.FLOAT, false, 0, 0)

    // Bind textures
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textureA)
    gl.uniform1i(programInfo.uniforms.u_textureA, 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.textureB)
    gl.uniform1i(programInfo.uniforms.u_textureB, 1)

    // Set uniforms
    gl.uniform1f(programInfo.uniforms.u_progress, progress)
    gl.uniform1f(programInfo.uniforms.u_intensity, intensity)
    if (programInfo.uniforms.u_resolution) {
      gl.uniform2f(programInfo.uniforms.u_resolution, this.width, this.height)
    }
    if (programInfo.uniforms.u_time) {
      gl.uniform1f(programInfo.uniforms.u_time, time)
    }

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  /**
   * Get the canvas element for capturing frames
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const gl = this.gl

    // Delete textures
    if (this.textureA) gl.deleteTexture(this.textureA)
    if (this.textureB) gl.deleteTexture(this.textureB)

    // Delete buffers
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer)
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer)

    // Delete programs
    for (const { program } of this.programs.values()) {
      gl.deleteProgram(program)
    }
    this.programs.clear()

    // Lose context
    const ext = gl.getExtension('WEBGL_lose_context')
    if (ext) ext.loseContext()
  }
}
