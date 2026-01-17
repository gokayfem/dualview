/**
 * STITCH-002: Ease Curve Editor
 * Visual bezier curve editor with presets and custom control points
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Spline, Copy, Clipboard, RotateCcw, Play, Pause, X,
  TrendingUp, TrendingDown, Activity, Zap
} from 'lucide-react'
import type { EaseCurve } from '../../types'

// Re-export EaseCurve type for convenience
export type { EaseCurve } from '../../types'

// Built-in presets
export const EASE_PRESETS: EaseCurve[] = [
  { id: 'linear', name: 'Linear', x1: 0, y1: 0, x2: 1, y2: 1 },
  { id: 'ease', name: 'Ease', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  { id: 'ease-in', name: 'Ease In', x1: 0.42, y1: 0, x2: 1, y2: 1 },
  { id: 'ease-out', name: 'Ease Out', x1: 0, y1: 0, x2: 0.58, y2: 1 },
  { id: 'ease-in-out', name: 'Ease In Out', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  { id: 'ease-in-quad', name: 'Ease In Quad', x1: 0.55, y1: 0.085, x2: 0.68, y2: 0.53 },
  { id: 'ease-out-quad', name: 'Ease Out Quad', x1: 0.25, y1: 0.46, x2: 0.45, y2: 0.94 },
  { id: 'ease-in-cubic', name: 'Ease In Cubic', x1: 0.55, y1: 0.055, x2: 0.675, y2: 0.19 },
  { id: 'ease-out-cubic', name: 'Ease Out Cubic', x1: 0.215, y1: 0.61, x2: 0.355, y2: 1 },
  { id: 'ease-in-expo', name: 'Ease In Expo', x1: 0.95, y1: 0.05, x2: 0.795, y2: 0.035 },
  { id: 'ease-out-expo', name: 'Ease Out Expo', x1: 0.19, y1: 1, x2: 0.22, y2: 1 },
  { id: 'ease-in-back', name: 'Ease In Back', x1: 0.6, y1: -0.28, x2: 0.735, y2: 0.045 },
  { id: 'ease-out-back', name: 'Ease Out Back', x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275 },
]

interface EaseCurveEditorProps {
  isOpen: boolean
  onClose: () => void
  curve: EaseCurve
  onCurveChange: (curve: EaseCurve) => void
  clipId?: string
}

// Clipboard storage for copy/paste
let curveClipboard: EaseCurve | null = null

// Calculate cubic bezier value at t
function cubicBezier(t: number, p1: number, p2: number): number {
  // Cubic bezier formula: (1-t)^3*0 + 3*(1-t)^2*t*p1 + 3*(1-t)*t^2*p2 + t^3*1
  const oneMinusT = 1 - t
  return 3 * oneMinusT * oneMinusT * t * p1 + 3 * oneMinusT * t * t * p2 + t * t * t
}

// Sample the bezier curve for rendering
function sampleBezierCurve(x1: number, y1: number, x2: number, y2: number, samples: number = 100): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const x = cubicBezier(t, x1, x2)
    const y = cubicBezier(t, y1, y2)
    points.push({ x, y })
  }
  return points
}

export function EaseCurveEditor({ isOpen, onClose, curve, onCurveChange, clipId }: EaseCurveEditorProps) {
  const [localCurve, setLocalCurve] = useState<EaseCurve>(curve)
  const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)

  // Constants for canvas rendering
  const CANVAS_SIZE = 300
  const PADDING = 40
  const INNER_SIZE = CANVAS_SIZE - PADDING * 2

  // Sync local curve with prop
  useEffect(() => {
    setLocalCurve(curve)
  }, [curve])

  // Draw the curve on canvas
  const drawCurve = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_SIZE * dpr
    canvas.height = CANVAS_SIZE * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw grid
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const pos = PADDING + (INNER_SIZE / 4) * i
      // Vertical lines
      ctx.beginPath()
      ctx.moveTo(pos, PADDING)
      ctx.lineTo(pos, CANVAS_SIZE - PADDING)
      ctx.stroke()
      // Horizontal lines
      ctx.beginPath()
      ctx.moveTo(PADDING, pos)
      ctx.lineTo(CANVAS_SIZE - PADDING, pos)
      ctx.stroke()
    }

    // Draw diagonal reference line (linear)
    ctx.strokeStyle = '#444'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(PADDING, CANVAS_SIZE - PADDING)
    ctx.lineTo(CANVAS_SIZE - PADDING, PADDING)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw control point handles
    const p1x = PADDING + localCurve.x1 * INNER_SIZE
    const p1y = CANVAS_SIZE - PADDING - localCurve.y1 * INNER_SIZE
    const p2x = PADDING + localCurve.x2 * INNER_SIZE
    const p2y = CANVAS_SIZE - PADDING - localCurve.y2 * INNER_SIZE

    // Handle lines
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PADDING, CANVAS_SIZE - PADDING)
    ctx.lineTo(p1x, p1y)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(CANVAS_SIZE - PADDING, PADDING)
    ctx.lineTo(p2x, p2y)
    ctx.stroke()

    // Draw the bezier curve
    const curvePoints = sampleBezierCurve(localCurve.x1, localCurve.y1, localCurve.x2, localCurve.y2)
    ctx.strokeStyle = '#ff5722'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    curvePoints.forEach((pt, i) => {
      const x = PADDING + pt.x * INNER_SIZE
      const y = CANVAS_SIZE - PADDING - pt.y * INNER_SIZE
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Draw control points
    // P1 (start control)
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.arc(p1x, p1y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // P2 (end control)
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.arc(p2x, p2y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw endpoint markers
    ctx.fillStyle = '#fff'
    // Start point (0,0)
    ctx.beginPath()
    ctx.arc(PADDING, CANVAS_SIZE - PADDING, 4, 0, Math.PI * 2)
    ctx.fill()
    // End point (1,1)
    ctx.beginPath()
    ctx.arc(CANVAS_SIZE - PADDING, PADDING, 4, 0, Math.PI * 2)
    ctx.fill()

    // Labels
    ctx.fillStyle = '#888'
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('0', PADDING, CANVAS_SIZE - PADDING + 20)
    ctx.fillText('1', CANVAS_SIZE - PADDING, CANVAS_SIZE - PADDING + 20)
    ctx.textAlign = 'right'
    ctx.fillText('0', PADDING - 8, CANVAS_SIZE - PADDING + 4)
    ctx.fillText('1', PADDING - 8, PADDING + 4)
    ctx.textAlign = 'center'
    ctx.fillText('Time →', CANVAS_SIZE / 2, CANVAS_SIZE - 10)
    ctx.save()
    ctx.translate(12, CANVAS_SIZE / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Progress →', 0, 0)
    ctx.restore()

  }, [localCurve, CANVAS_SIZE, PADDING, INNER_SIZE])

  // Draw curve on mount and changes
  useEffect(() => {
    if (!isOpen) return

    // Use requestAnimationFrame to ensure canvas is ready
    const frame = requestAnimationFrame(() => {
      drawCurve()
    })
    return () => cancelAnimationFrame(frame)
  }, [drawCurve, isOpen])

  // Also draw immediately when localCurve changes
  useEffect(() => {
    if (isOpen) {
      drawCurve()
    }
  }, [localCurve, isOpen, drawCurve])

  // Handle mouse events for dragging control points
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / (rect.width / CANVAS_SIZE)
    const y = (e.clientY - rect.top) / (rect.height / CANVAS_SIZE)

    // Check if clicked on P1
    const p1x = PADDING + localCurve.x1 * INNER_SIZE
    const p1y = CANVAS_SIZE - PADDING - localCurve.y1 * INNER_SIZE
    if (Math.hypot(x - p1x, y - p1y) < 15) {
      setDragging('p1')
      return
    }

    // Check if clicked on P2
    const p2x = PADDING + localCurve.x2 * INNER_SIZE
    const p2y = CANVAS_SIZE - PADDING - localCurve.y2 * INNER_SIZE
    if (Math.hypot(x - p2x, y - p2y) < 15) {
      setDragging('p2')
    }
  }, [localCurve, CANVAS_SIZE, PADDING, INNER_SIZE])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / (rect.width / CANVAS_SIZE)
    const y = (e.clientY - rect.top) / (rect.height / CANVAS_SIZE)

    // Convert to normalized coordinates
    const normX = Math.max(0, Math.min(1, (x - PADDING) / INNER_SIZE))
    const normY = Math.max(-0.5, Math.min(1.5, (CANVAS_SIZE - PADDING - y) / INNER_SIZE))

    if (dragging === 'p1') {
      setLocalCurve(prev => ({
        ...prev,
        x1: normX,
        y1: normY,
        id: 'custom',
        name: 'Custom'
      }))
    } else if (dragging === 'p2') {
      setLocalCurve(prev => ({
        ...prev,
        x2: normX,
        y2: normY,
        id: 'custom',
        name: 'Custom'
      }))
    }
  }, [dragging, CANVAS_SIZE, PADDING, INNER_SIZE])

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null)
      onCurveChange(localCurve)
    }
  }, [dragging, localCurve, onCurveChange])

  // Global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp()
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [handleMouseUp])

  // Preview animation
  useEffect(() => {
    if (isPreviewPlaying) {
      const duration = 2000 // 2 seconds
      startTimeRef.current = performance.now()

      const animate = (time: number) => {
        const elapsed = time - (startTimeRef.current || time)
        const t = (elapsed % duration) / duration
        const progress = cubicBezier(t, localCurve.y1, localCurve.y2)
        setPreviewProgress(progress)
        animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      setPreviewProgress(0)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPreviewPlaying, localCurve])

  // Apply preset
  const applyPreset = useCallback((preset: EaseCurve) => {
    setLocalCurve(preset)
    onCurveChange(preset)
  }, [onCurveChange])

  // Copy to clipboard
  const copyToClipboard = useCallback(() => {
    curveClipboard = { ...localCurve }
  }, [localCurve])

  // Paste from clipboard
  const pasteFromClipboard = useCallback(() => {
    if (curveClipboard) {
      setLocalCurve({ ...curveClipboard })
      onCurveChange(curveClipboard)
    }
  }, [onCurveChange])

  // Reset to linear
  const resetCurve = useCallback(() => {
    const linear = EASE_PRESETS[0]
    setLocalCurve(linear)
    onCurveChange(linear)
  }, [onCurveChange])

  // Get CSS cubic-bezier string
  const getCssCubicBezier = useCallback(() => {
    return `cubic-bezier(${localCurve.x1.toFixed(3)}, ${localCurve.y1.toFixed(3)}, ${localCurve.x2.toFixed(3)}, ${localCurve.y2.toFixed(3)})`
  }, [localCurve])

  // Get icon for preset category
  const getPresetIcon = (preset: EaseCurve) => {
    if (preset.id.includes('in') && preset.id.includes('out')) return Activity
    if (preset.id.includes('in')) return TrendingUp
    if (preset.id.includes('out')) return TrendingDown
    if (preset.id.includes('expo') || preset.id.includes('back')) return Zap
    return Spline
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Spline size={20} className="text-[#ff5722]" />
            <h2 className="text-lg font-semibold text-white">Ease Curve Editor (STITCH-002)</h2>
            {clipId && (
              <>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-400">Clip: {clipId}</span>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Presets Panel */}
          <div className="w-56 border-r border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Presets</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {EASE_PRESETS.map(preset => {
                const Icon = getPresetIcon(preset)
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left mb-1 ${
                      localCurve.id === preset.id
                        ? 'bg-[#ff5722]/20 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{preset.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col p-6">
            <div className="flex gap-6">
              {/* Canvas */}
              <div className="flex-shrink-0">
                <canvas
                  ref={canvasRef}
                  style={{ width: `${CANVAS_SIZE}px`, height: `${CANVAS_SIZE}px`, background: '#0d0d0d' }}
                  className="cursor-crosshair rounded border border-gray-700"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                />
              </div>

              {/* Controls & Preview */}
              <div className="flex-1 flex flex-col gap-4">
                {/* Control Point Values */}
                <div className="bg-[#0d0d0d] rounded p-4 border border-gray-800">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Control Points</div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-300">P1 (Start)</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 block mb-1">X</label>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={localCurve.x1.toFixed(2)}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              setLocalCurve(prev => ({ ...prev, x1: Math.max(0, Math.min(1, val)), id: 'custom', name: 'Custom' }))
                            }}
                            onBlur={() => onCurveChange(localCurve)}
                            className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-2 py-1 text-sm text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 block mb-1">Y</label>
                          <input
                            type="number"
                            min="-0.5"
                            max="1.5"
                            step="0.01"
                            value={localCurve.y1.toFixed(2)}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              setLocalCurve(prev => ({ ...prev, y1: Math.max(-0.5, Math.min(1.5, val)), id: 'custom', name: 'Custom' }))
                            }}
                            onBlur={() => onCurveChange(localCurve)}
                            className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-2 py-1 text-sm text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm text-gray-300">P2 (End)</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 block mb-1">X</label>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={localCurve.x2.toFixed(2)}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              setLocalCurve(prev => ({ ...prev, x2: Math.max(0, Math.min(1, val)), id: 'custom', name: 'Custom' }))
                            }}
                            onBlur={() => onCurveChange(localCurve)}
                            className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-2 py-1 text-sm text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 block mb-1">Y</label>
                          <input
                            type="number"
                            min="-0.5"
                            max="1.5"
                            step="0.01"
                            value={localCurve.y2.toFixed(2)}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0
                              setLocalCurve(prev => ({ ...prev, y2: Math.max(-0.5, Math.min(1.5, val)), id: 'custom', name: 'Custom' }))
                            }}
                            onBlur={() => onCurveChange(localCurve)}
                            className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-2 py-1 text-sm text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CSS Output */}
                <div className="bg-[#0d0d0d] rounded p-4 border border-gray-800">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">CSS Value</div>
                  <code className="text-sm text-[#ff5722] font-mono bg-[#1a1a1a] px-3 py-2 rounded block">
                    {getCssCubicBezier()}
                  </code>
                </div>

                {/* Preview Animation */}
                <div className="bg-[#0d0d0d] rounded p-4 border border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Preview</div>
                    <button
                      onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
                    >
                      {isPreviewPlaying ? <Pause size={12} /> : <Play size={12} />}
                      {isPreviewPlaying ? 'Stop' : 'Play'}
                    </button>
                  </div>
                  <div className="h-8 bg-[#1a1a1a] rounded relative overflow-hidden">
                    <div
                      ref={previewRef}
                      className="absolute top-1 bottom-1 w-6 bg-[#ff5722] rounded transition-none"
                      style={{ left: `${previewProgress * 100}%`, transform: 'translateX(-50%)' }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
                    title="Copy curve to clipboard"
                  >
                    <Copy size={14} />
                    Copy
                  </button>
                  <button
                    onClick={pasteFromClipboard}
                    disabled={!curveClipboard}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                    title="Paste curve from clipboard"
                  >
                    <Clipboard size={14} />
                    Paste
                  </button>
                  <button
                    onClick={resetCurve}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
                    title="Reset to linear"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Drag the green/blue control points to adjust the curve
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
                onCurveChange(localCurve)
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

// Toggle button for ease curve editor
export function EaseCurveToggle({
  onClick,
  curveName = 'Linear'
}: {
  onClick: () => void
  curveName?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/70 text-gray-400 hover:text-white transition-colors"
      title="Edit Ease Curve (STITCH-002)"
    >
      <Spline size={14} />
      <span className="text-xs">{curveName}</span>
    </button>
  )
}

// Utility function to evaluate ease curve at a given t (0-1)
export function evaluateEaseCurve(curve: EaseCurve, t: number): number {
  return cubicBezier(t, curve.y1, curve.y2)
}
