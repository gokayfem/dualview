/**
 * STITCH-003: WebGL Transitions Between Clips
 * Apply WebGL transition effects between stitched clips
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Sparkles, Play, Pause, X, Clock, Zap, Layers, Slice } from 'lucide-react'
import type { ClipTransition } from '../../types'
import { EASE_PRESETS, evaluateEaseCurve } from './EaseCurveEditor'

// Re-export types for convenience
export type { ClipTransition } from '../../types'

// Transition effect definition
export interface TransitionEffect {
  id: string
  name: string
  category: 'basic' | 'wipe' | 'geometric' | 'dissolve' | 'blur' | 'color' | 'distortion'
  fragmentShader: string
}

// Default transition
export const DEFAULT_TRANSITION: ClipTransition = {
  effectId: 'dissolve',
  duration: 0.5,
  easeCurve: EASE_PRESETS[4] // ease-in-out
}

// Vertex shader for transitions
const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0, 1);
}
`

// Common uniforms and functions for transitions
const TRANSITION_COMMON = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_textureFrom;
uniform sampler2D u_textureTo;
uniform float u_progress;
uniform vec2 u_resolution;

// Noise functions
float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Smooth step
float smootherstep(float edge0, float edge1, float x) {
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}
`

// Built-in transition effects
export const TRANSITION_EFFECTS: TransitionEffect[] = [
  // Basic
  {
    id: 'cut',
    name: 'Cut',
    category: 'basic',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        gl_FragColor = u_progress < 0.5 ? colorFrom : colorTo;
      }
    `
  },
  {
    id: 'dissolve',
    name: 'Dissolve',
    category: 'dissolve',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },

  // Wipes
  {
    id: 'wipe-left',
    name: 'Wipe Left',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = u_progress;
        gl_FragColor = v_texCoord.x < edge ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'wipe-right',
    name: 'Wipe Right',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = 1.0 - u_progress;
        gl_FragColor = v_texCoord.x > edge ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'wipe-up',
    name: 'Wipe Up',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = 1.0 - u_progress;
        gl_FragColor = v_texCoord.y > edge ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'wipe-down',
    name: 'Wipe Down',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float edge = u_progress;
        gl_FragColor = v_texCoord.y < edge ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'wipe-diagonal',
    name: 'Wipe Diagonal',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float diag = (v_texCoord.x + v_texCoord.y) * 0.5;
        gl_FragColor = diag < u_progress ? colorTo : colorFrom;
      }
    `
  },

  // Geometric
  {
    id: 'circle-expand',
    name: 'Circle Expand',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(v_texCoord, center);
        float radius = u_progress * 1.5;
        gl_FragColor = dist < radius ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'circle-contract',
    name: 'Circle Contract',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(v_texCoord, center);
        float radius = (1.0 - u_progress) * 1.5;
        gl_FragColor = dist > radius ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'rectangle-expand',
    name: 'Rectangle Expand',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec2 center = vec2(0.5, 0.5);
        vec2 d = abs(v_texCoord - center);
        float dist = max(d.x, d.y);
        float radius = u_progress * 0.8;
        gl_FragColor = dist < radius ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'blinds-h',
    name: 'Blinds Horizontal',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float blinds = 8.0;
        float y = fract(v_texCoord.y * blinds);
        gl_FragColor = y < u_progress ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'blinds-v',
    name: 'Blinds Vertical',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float blinds = 8.0;
        float x = fract(v_texCoord.x * blinds);
        gl_FragColor = x < u_progress ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'checkerboard',
    name: 'Checkerboard',
    category: 'geometric',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float size = 8.0;
        float cx = floor(v_texCoord.x * size);
        float cy = floor(v_texCoord.y * size);
        float isOdd = mod(cx + cy, 2.0);
        float threshold = isOdd > 0.5 ? u_progress * 2.0 : u_progress * 2.0 - 1.0;
        gl_FragColor = threshold > 0.0 ? colorTo : colorFrom;
      }
    `
  },

  // Dissolve variations
  {
    id: 'dissolve-noise',
    name: 'Dissolve Noise',
    category: 'dissolve',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        float noise = rand(v_texCoord);
        float t = smoothstep(0.0, 1.0, u_progress);
        gl_FragColor = noise < t ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'pixelate',
    name: 'Pixelate',
    category: 'dissolve',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float pixelSize = mix(1.0, 40.0, sin(u_progress * 3.14159));
        vec2 pixelCoord = floor(v_texCoord * u_resolution / pixelSize) * pixelSize / u_resolution;
        vec4 colorFrom = texture2D(u_textureFrom, pixelCoord);
        vec4 colorTo = texture2D(u_textureTo, pixelCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },

  // Blur
  {
    id: 'blur-fade',
    name: 'Blur Fade',
    category: 'blur',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float blurAmount = sin(u_progress * 3.14159) * 0.02;
        vec4 colorFrom = vec4(0.0);
        vec4 colorTo = vec4(0.0);
        for (int i = -2; i <= 2; i++) {
          for (int j = -2; j <= 2; j++) {
            vec2 offset = vec2(float(i), float(j)) * blurAmount;
            colorFrom += texture2D(u_textureFrom, v_texCoord + offset);
            colorTo += texture2D(u_textureTo, v_texCoord + offset);
          }
        }
        colorFrom /= 25.0;
        colorTo /= 25.0;
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },

  // Color effects
  {
    id: 'fade-white',
    name: 'Fade to White',
    category: 'color',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec4 white = vec4(1.0);
        float t = u_progress * 2.0;
        if (t < 1.0) {
          gl_FragColor = mix(colorFrom, white, t);
        } else {
          gl_FragColor = mix(white, colorTo, t - 1.0);
        }
      }
    `
  },
  {
    id: 'fade-black',
    name: 'Fade to Black',
    category: 'color',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
        float t = u_progress * 2.0;
        if (t < 1.0) {
          gl_FragColor = mix(colorFrom, black, t);
        } else {
          gl_FragColor = mix(black, colorTo, t - 1.0);
        }
      }
    `
  },

  // Distortion
  {
    id: 'zoom-in',
    name: 'Zoom In',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float zoom = 1.0 + u_progress * 5.0;
        vec2 center = vec2(0.5, 0.5);
        vec2 zoomedCoord = (v_texCoord - center) / zoom + center;
        vec4 colorFrom = texture2D(u_textureFrom, zoomedCoord);
        vec4 colorTo = texture2D(u_textureTo, v_texCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },
  {
    id: 'zoom-out',
    name: 'Zoom Out',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float zoom = 6.0 - u_progress * 5.0;
        vec2 center = vec2(0.5, 0.5);
        vec2 zoomedCoord = (v_texCoord - center) / zoom + center;
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, zoomedCoord);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },
  {
    id: 'rotate',
    name: 'Rotate',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float angle = u_progress * 3.14159 * 2.0;
        vec2 center = vec2(0.5, 0.5);
        vec2 tc = v_texCoord - center;
        float s = sin(angle);
        float c = cos(angle);
        vec2 rotated = vec2(tc.x * c - tc.y * s, tc.x * s + tc.y * c) + center;
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, rotated);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },
  {
    id: 'swirl',
    name: 'Swirl',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec2 center = vec2(0.5, 0.5);
        vec2 tc = v_texCoord - center;
        float dist = length(tc);
        float angle = dist * u_progress * 10.0;
        float s = sin(angle);
        float c = cos(angle);
        vec2 swirled = vec2(tc.x * c - tc.y * s, tc.x * s + tc.y * c) + center;
        vec4 colorFrom = texture2D(u_textureFrom, v_texCoord);
        vec4 colorTo = texture2D(u_textureTo, swirled);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },
  {
    id: 'wave',
    name: 'Wave',
    category: 'distortion',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        float amplitude = sin(u_progress * 3.14159) * 0.1;
        float frequency = 10.0;
        vec2 distorted = v_texCoord;
        distorted.x += sin(v_texCoord.y * frequency) * amplitude;
        vec4 colorFrom = texture2D(u_textureFrom, distorted);
        vec4 colorTo = texture2D(u_textureTo, distorted);
        gl_FragColor = mix(colorFrom, colorTo, u_progress);
      }
    `
  },
  {
    id: 'slide-left',
    name: 'Slide Left',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec2 fromCoord = v_texCoord + vec2(u_progress, 0.0);
        vec2 toCoord = v_texCoord - vec2(1.0 - u_progress, 0.0);
        vec4 colorFrom = texture2D(u_textureFrom, fromCoord);
        vec4 colorTo = texture2D(u_textureTo, toCoord);
        gl_FragColor = v_texCoord.x < u_progress ? colorTo : colorFrom;
      }
    `
  },
  {
    id: 'slide-right',
    name: 'Slide Right',
    category: 'wipe',
    fragmentShader: `
      ${TRANSITION_COMMON}
      void main() {
        vec2 fromCoord = v_texCoord - vec2(u_progress, 0.0);
        vec2 toCoord = v_texCoord + vec2(1.0 - u_progress, 0.0);
        vec4 colorFrom = texture2D(u_textureFrom, fromCoord);
        vec4 colorTo = texture2D(u_textureTo, toCoord);
        gl_FragColor = v_texCoord.x > 1.0 - u_progress ? colorTo : colorFrom;
      }
    `
  },
]

// Group effects by category
function getEffectsByCategory(): Map<string, TransitionEffect[]> {
  const map = new Map<string, TransitionEffect[]>()
  TRANSITION_EFFECTS.forEach(effect => {
    const list = map.get(effect.category) || []
    list.push(effect)
    map.set(effect.category, list)
  })
  return map
}

interface TransitionEditorProps {
  isOpen: boolean
  onClose: () => void
  transition: ClipTransition
  onTransitionChange: (transition: ClipTransition) => void
  fromThumbnail?: string
  toThumbnail?: string
  clipNames?: { from: string; to: string }
}

export function TransitionEditor({
  isOpen,
  onClose,
  transition,
  onTransitionChange,
  fromThumbnail,
  toThumbnail,
  clipNames
}: TransitionEditorProps) {
  const [localTransition, setLocalTransition] = useState<ClipTransition>(transition)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)

  const effectsByCategory = getEffectsByCategory()
  const selectedEffect = TRANSITION_EFFECTS.find(e => e.id === localTransition.effectId) || TRANSITION_EFFECTS[1]

  // Sync with prop
  useEffect(() => {
    setLocalTransition(transition)
  }, [transition])

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) return
    glRef.current = gl

    // Create shader program
    const vertShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertShader, VERTEX_SHADER)
    gl.compileShader(vertShader)

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragShader, selectedEffect.fragmentShader)
    gl.compileShader(fragShader)

    const program = gl.createProgram()!
    gl.attachShader(program, vertShader)
    gl.attachShader(program, fragShader)
    gl.linkProgram(program)
    gl.useProgram(program)
    programRef.current = program

    // Create quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    return () => {
      gl.deleteShader(vertShader)
      gl.deleteShader(fragShader)
      gl.deleteProgram(program)
    }
  }, [selectedEffect])

  // Render preview frame
  const renderFrame = useCallback((progress: number) => {
    const gl = glRef.current
    const program = programRef.current
    if (!gl || !program) return

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Set uniforms
    const progressLoc = gl.getUniformLocation(program, 'u_progress')
    gl.uniform1f(progressLoc, progress)

    const resLoc = gl.getUniformLocation(program, 'u_resolution')
    gl.uniform2f(resLoc, gl.canvas.width, gl.canvas.height)

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }, [])

  // Preview animation
  useEffect(() => {
    if (isPreviewPlaying) {
      const duration = localTransition.duration * 1000 // ms
      startTimeRef.current = performance.now()

      const animate = (time: number) => {
        const elapsed = time - (startTimeRef.current || time)
        const t = Math.min(1, (elapsed % (duration + 500)) / duration) // small pause at end
        const easedT = evaluateEaseCurve(localTransition.easeCurve, t)
        setPreviewProgress(easedT)
        renderFrame(easedT)
        animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPreviewPlaying, localTransition, renderFrame])

  // Initial render
  useEffect(() => {
    renderFrame(previewProgress)
  }, [previewProgress, renderFrame])

  // Category icons
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'wipe': return Slice
      case 'geometric': return Layers
      case 'dissolve': return Sparkles
      case 'distortion': return Zap
      default: return Sparkles
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-[#ff5722]" />
            <h2 className="text-lg font-semibold text-white">Transition Editor (STITCH-003)</h2>
            {clipNames && (
              <>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-400">{clipNames.from} → {clipNames.to}</span>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Effects List */}
          <div className="w-56 border-r border-gray-700 flex flex-col overflow-y-auto">
            {Array.from(effectsByCategory.entries()).map(([category, effects]) => {
              const Icon = getCategoryIcon(category)
              return (
                <div key={category}>
                  <div className="sticky top-0 bg-[#1a1a1a] px-3 py-2 border-b border-gray-800">
                    <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
                      <Icon size={12} />
                      {category}
                    </div>
                  </div>
                  {effects.map(effect => (
                    <button
                      key={effect.id}
                      onClick={() => {
                        setLocalTransition(prev => ({ ...prev, effectId: effect.id }))
                      }}
                      className={`w-full px-3 py-2 text-sm text-left ${
                        localTransition.effectId === effect.id
                          ? 'bg-[#ff5722]/20 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {effect.name}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Preview & Settings */}
          <div className="flex-1 flex flex-col p-6 gap-6">
            {/* Preview */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-400">{selectedEffect.name} Preview</div>
                <button
                  onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
                >
                  {isPreviewPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {isPreviewPlaying ? 'Stop' : 'Play'}
                </button>
              </div>

              <div className="flex-1 bg-black rounded overflow-hidden flex items-center justify-center relative">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={225}
                  className="max-w-full max-h-full"
                />

                {/* Thumbnail overlays for reference */}
                <div className="absolute inset-0 flex pointer-events-none opacity-30">
                  {fromThumbnail && (
                    <div className="w-1/2 h-full border-r border-white/20 flex items-center justify-center text-xs text-white/50">
                      From
                    </div>
                  )}
                  {toThumbnail && (
                    <div className="w-1/2 h-full flex items-center justify-center text-xs text-white/50">
                      To
                    </div>
                  )}
                </div>
              </div>

              {/* Progress slider */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>From</span>
                  <span>{Math.round(previewProgress * 100)}%</span>
                  <span>To</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={previewProgress}
                  onChange={e => {
                    setIsPreviewPlaying(false)
                    const val = parseFloat(e.target.value)
                    setPreviewProgress(val)
                    renderFrame(val)
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Settings */}
            <div className="bg-[#0d0d0d] rounded p-4 border border-gray-800">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Settings</div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <Clock size={14} />
                    Duration
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={localTransition.duration}
                      onChange={e => setLocalTransition(prev => ({
                        ...prev,
                        duration: parseFloat(e.target.value)
                      }))}
                      className="flex-1"
                    />
                    <span className="text-sm text-white w-12 text-right">
                      {localTransition.duration.toFixed(1)}s
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Ease Curve</label>
                  <select
                    value={localTransition.easeCurve.id}
                    onChange={e => {
                      const preset = EASE_PRESETS.find(p => p.id === e.target.value)
                      if (preset) {
                        setLocalTransition(prev => ({ ...prev, easeCurve: preset }))
                      }
                    }}
                    className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  >
                    {EASE_PRESETS.map(preset => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {TRANSITION_EFFECTS.length} transitions available
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onTransitionChange(localTransition)
                onClose()
              }}
              className="px-4 py-2 bg-[#ff5722] text-white rounded text-sm hover:bg-[#e64a19]"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
