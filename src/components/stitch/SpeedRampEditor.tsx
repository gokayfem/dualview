/**
 * STITCH-004: Speed Ramping with Ease
 * Set speed keyframes on clip timeline with ease curve interpolation
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Gauge, Plus, Trash2, X, Play, Pause, ArrowRightLeft, RotateCcw } from 'lucide-react'
import type { SpeedRamp, SpeedKeyframe } from '../../types'
import { EASE_PRESETS, evaluateEaseCurve } from './EaseCurveEditor'

// Re-export types for convenience
export type { SpeedRamp, SpeedKeyframe } from '../../types'

// Default speed ramp (no ramping)
export const DEFAULT_SPEED_RAMP: SpeedRamp = {
  enabled: false,
  keyframes: [
    { id: 'start', time: 0, speed: 1, easeCurve: EASE_PRESETS[4] },
    { id: 'end', time: 1, speed: 1, easeCurve: EASE_PRESETS[4] }
  ],
  reverse: false
}

interface SpeedRampEditorProps {
  isOpen: boolean
  onClose: () => void
  speedRamp: SpeedRamp
  onSpeedRampChange: (speedRamp: SpeedRamp) => void
  clipDuration: number
  clipName?: string
  clipThumbnail?: string
}

// Format time from seconds
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  return `${mins}:${secs.padStart(4, '0')}`
}

// Interpolate speed between keyframes at a given time
function getSpeedAtTime(speedRamp: SpeedRamp, normalizedTime: number): number {
  if (!speedRamp.enabled || speedRamp.keyframes.length < 2) return 1

  const sortedKeyframes = [...speedRamp.keyframes].sort((a, b) => a.time - b.time)

  // Find surrounding keyframes
  let prevKf = sortedKeyframes[0]
  let nextKf = sortedKeyframes[sortedKeyframes.length - 1]

  for (let i = 0; i < sortedKeyframes.length - 1; i++) {
    if (sortedKeyframes[i].time <= normalizedTime && sortedKeyframes[i + 1].time >= normalizedTime) {
      prevKf = sortedKeyframes[i]
      nextKf = sortedKeyframes[i + 1]
      break
    }
  }

  // Calculate interpolation factor
  const range = nextKf.time - prevKf.time
  if (range <= 0) return prevKf.speed

  const localT = (normalizedTime - prevKf.time) / range
  const easedT = evaluateEaseCurve(prevKf.easeCurve, localT)

  // Interpolate speed
  return prevKf.speed + (nextKf.speed - prevKf.speed) * easedT
}

export function SpeedRampEditor({
  isOpen,
  onClose,
  speedRamp,
  onSpeedRampChange,
  clipDuration,
  clipName,
  clipThumbnail
}: SpeedRampEditorProps) {
  const [localRamp, setLocalRamp] = useState<SpeedRamp>(speedRamp)
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [previewTime, setPreviewTime] = useState(0)
  const [draggingKeyframe, setDraggingKeyframe] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const startTimeRef = useRef<number | undefined>(undefined)

  // Canvas dimensions
  const CANVAS_WIDTH = 600
  const CANVAS_HEIGHT = 200
  const PADDING = 40

  // Sync with prop
  useEffect(() => {
    setLocalRamp(speedRamp)
  }, [speedRamp])

  // Draw speed graph
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    const graphWidth = CANVAS_WIDTH - PADDING * 2
    const graphHeight = CANVAS_HEIGHT - PADDING * 2

    // Clear
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    // Horizontal lines (speed levels)
    const speedLevels = [0.25, 0.5, 1, 2, 4, 8]
    speedLevels.forEach(speed => {
      const y = PADDING + graphHeight - (Math.log2(speed) + 3) / 6.5 * graphHeight
      if (y >= PADDING && y <= CANVAS_HEIGHT - PADDING) {
        ctx.beginPath()
        ctx.setLineDash(speed === 1 ? [] : [5, 5])
        ctx.strokeStyle = speed === 1 ? '#ff5722' : '#333'
        ctx.lineWidth = speed === 1 ? 1.5 : 1
        ctx.moveTo(PADDING, y)
        ctx.lineTo(CANVAS_WIDTH - PADDING, y)
        ctx.stroke()
        ctx.setLineDash([])

        // Label
        ctx.fillStyle = speed === 1 ? '#ff5722' : '#666'
        ctx.font = '10px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(`${speed}x`, PADDING - 5, y + 3)
      }
    })

    // Vertical lines (time)
    for (let i = 0; i <= 4; i++) {
      const x = PADDING + (graphWidth / 4) * i
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, PADDING)
      ctx.lineTo(x, CANVAS_HEIGHT - PADDING)
      ctx.stroke()

      // Time label
      ctx.fillStyle = '#666'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(formatTime((clipDuration / 4) * i), x, CANVAS_HEIGHT - PADDING + 15)
    }

    // Draw speed curve
    ctx.strokeStyle = localRamp.enabled ? '#ff5722' : '#666'
    ctx.lineWidth = 2
    ctx.beginPath()

    const speedToY = (speed: number) => {
      // Log scale for speed (0.1x to 10x)
      const logSpeed = Math.log2(Math.max(0.1, Math.min(10, speed)))
      return PADDING + graphHeight - ((logSpeed + 3.32) / 6.64) * graphHeight
    }

    for (let i = 0; i <= 100; i++) {
      const t = i / 100
      const speed = localRamp.enabled ? getSpeedAtTime(localRamp, t) : 1
      const x = PADDING + t * graphWidth
      const y = speedToY(speed)

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Draw keyframes
    const sortedKeyframes = [...localRamp.keyframes].sort((a, b) => a.time - b.time)
    sortedKeyframes.forEach(kf => {
      const x = PADDING + kf.time * graphWidth
      const y = speedToY(kf.speed)

      // Keyframe marker
      ctx.fillStyle = selectedKeyframeId === kf.id ? '#ff5722' : '#fff'
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.stroke()

      // Speed label
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(kf.speed.toFixed(1), x, y + 3)
    })

    // Draw playhead
    const playheadX = PADDING + previewTime * graphWidth
    ctx.strokeStyle = '#cddc39'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, PADDING)
    ctx.lineTo(playheadX, CANVAS_HEIGHT - PADDING)
    ctx.stroke()

    // Current speed indicator
    const currentSpeed = localRamp.enabled ? getSpeedAtTime(localRamp, previewTime) : 1
    ctx.fillStyle = '#cddc39'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${currentSpeed.toFixed(2)}x`, CANVAS_WIDTH - PADDING - 50, PADDING - 10)

  }, [localRamp, clipDuration, previewTime, selectedKeyframeId, CANVAS_WIDTH, CANVAS_HEIGHT, PADDING])

  // Redraw on changes
  useEffect(() => {
    drawGraph()
  }, [drawGraph])

  // Preview animation
  useEffect(() => {
    if (isPreviewPlaying) {
      startTimeRef.current = performance.now()

      const animate = (time: number) => {
        const elapsed = (time - (startTimeRef.current || time)) / 1000
        const t = (elapsed / clipDuration) % 1
        setPreviewTime(t)
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
  }, [isPreviewPlaying, clipDuration])

  // Handle canvas mouse events
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / (rect.width / CANVAS_WIDTH)
    const graphWidth = CANVAS_WIDTH - PADDING * 2

    // Check if clicking on a keyframe
    const clickT = (x - PADDING) / graphWidth
    const sortedKeyframes = [...localRamp.keyframes].sort((a, b) => a.time - b.time)

    for (const kf of sortedKeyframes) {
      if (Math.abs(kf.time - clickT) < 0.03) {
        setSelectedKeyframeId(kf.id)
        setDraggingKeyframe(kf.id)
        return
      }
    }

    // Deselect
    setSelectedKeyframeId(null)
  }, [localRamp.keyframes, CANVAS_WIDTH, PADDING])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingKeyframe) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / (rect.width / CANVAS_WIDTH)
    const y = (e.clientY - rect.top) / (rect.height / CANVAS_HEIGHT)

    const graphWidth = CANVAS_WIDTH - PADDING * 2
    const graphHeight = CANVAS_HEIGHT - PADDING * 2

    // Calculate new time and speed
    const newT = Math.max(0, Math.min(1, (x - PADDING) / graphWidth))
    const normalizedY = Math.max(0, Math.min(1, (y - PADDING) / graphHeight))
    // Convert Y to log speed
    const logSpeed = (1 - normalizedY) * 6.64 - 3.32
    const newSpeed = Math.max(0.1, Math.min(10, Math.pow(2, logSpeed)))

    // Don't allow moving start/end keyframe times
    const isEndpoint = draggingKeyframe === 'start' || draggingKeyframe === 'end'

    setLocalRamp(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf => {
        if (kf.id === draggingKeyframe) {
          return {
            ...kf,
            time: isEndpoint ? kf.time : newT,
            speed: Math.round(newSpeed * 10) / 10
          }
        }
        return kf
      })
    }))
  }, [draggingKeyframe, CANVAS_WIDTH, CANVAS_HEIGHT, PADDING])

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingKeyframe(null)
  }, [])

  // Add keyframe
  const addKeyframe = useCallback(() => {
    const id = `kf-${Date.now()}`
    const newKf: SpeedKeyframe = {
      id,
      time: 0.5,
      speed: 1,
      easeCurve: EASE_PRESETS[4]
    }
    setLocalRamp(prev => ({
      ...prev,
      keyframes: [...prev.keyframes, newKf]
    }))
    setSelectedKeyframeId(id)
  }, [])

  // Delete selected keyframe
  const deleteSelectedKeyframe = useCallback(() => {
    if (!selectedKeyframeId || selectedKeyframeId === 'start' || selectedKeyframeId === 'end') return
    setLocalRamp(prev => ({
      ...prev,
      keyframes: prev.keyframes.filter(kf => kf.id !== selectedKeyframeId)
    }))
    setSelectedKeyframeId(null)
  }, [selectedKeyframeId])

  // Reset to default
  const resetRamp = useCallback(() => {
    setLocalRamp(DEFAULT_SPEED_RAMP)
    setSelectedKeyframeId(null)
  }, [])

  // Toggle reverse
  const toggleReverse = useCallback(() => {
    setLocalRamp(prev => ({ ...prev, reverse: !prev.reverse }))
  }, [])

  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    setLocalRamp(prev => ({ ...prev, enabled: !prev.enabled }))
  }, [])

  // Update selected keyframe speed
  const updateSelectedSpeed = useCallback((speed: number) => {
    if (!selectedKeyframeId) return
    setLocalRamp(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf =>
        kf.id === selectedKeyframeId ? { ...kf, speed } : kf
      )
    }))
  }, [selectedKeyframeId])

  // Update selected keyframe ease
  const updateSelectedEase = useCallback((easeCurveId: string) => {
    if (!selectedKeyframeId) return
    const preset = EASE_PRESETS.find(p => p.id === easeCurveId)
    if (!preset) return
    setLocalRamp(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf =>
        kf.id === selectedKeyframeId ? { ...kf, easeCurve: preset } : kf
      )
    }))
  }, [selectedKeyframeId])

  const selectedKeyframe = localRamp.keyframes.find(kf => kf.id === selectedKeyframeId)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Gauge size={20} className="text-[#ff5722]" />
            <h2 className="text-lg font-semibold text-white">Speed Ramp Editor (STITCH-004)</h2>
            {clipName && (
              <>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-400">{clipName}</span>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={localRamp.enabled}
                onChange={toggleEnabled}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">Enable Speed Ramping</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={toggleReverse}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                  localRamp.reverse
                    ? 'bg-[#ff5722] text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <ArrowRightLeft size={14} />
                Reverse
              </button>
              <button
                onClick={resetRamp}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>

          {/* Speed Graph Canvas */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400">Speed Graph</div>
              <div className="flex gap-2">
                <button
                  onClick={addKeyframe}
                  disabled={!localRamp.enabled}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add Keyframe
                </button>
                <button
                  onClick={deleteSelectedKeyframe}
                  disabled={!selectedKeyframeId || selectedKeyframeId === 'start' || selectedKeyframeId === 'end'}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>

            <div className="bg-black rounded overflow-hidden">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, cursor: localRamp.enabled ? 'crosshair' : 'default' }}
                className="max-w-full"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </div>

            {/* Timeline slider */}
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}
                className="p-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                {isPreviewPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={previewTime}
                onChange={e => {
                  setIsPreviewPlaying(false)
                  setPreviewTime(parseFloat(e.target.value))
                }}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 w-16">
                {formatTime(previewTime * clipDuration)}
              </span>
            </div>
          </div>

          {/* Selected Keyframe Settings */}
          {selectedKeyframe && (
            <div className="bg-[#0d0d0d] rounded p-4 border border-gray-800">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                Keyframe: {selectedKeyframeId === 'start' ? 'Start' : selectedKeyframeId === 'end' ? 'End' : 'Custom'}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Time</label>
                  <input
                    type="text"
                    value={formatTime(selectedKeyframe.time * clipDuration)}
                    readOnly
                    className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Speed</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={selectedKeyframe.speed}
                      onChange={e => updateSelectedSpeed(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-white w-12 text-right">
                      {selectedKeyframe.speed.toFixed(1)}x
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Ease Curve</label>
                  <select
                    value={selectedKeyframe.easeCurve.id}
                    onChange={e => updateSelectedEase(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  >
                    {EASE_PRESETS.map(preset => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preset speed buttons */}
              <div className="mt-3 flex gap-2">
                {[0.25, 0.5, 1, 2, 4, 8].map(speed => (
                  <button
                    key={speed}
                    onClick={() => updateSelectedSpeed(speed)}
                    className={`px-3 py-1 rounded text-xs ${
                      selectedKeyframe.speed === speed
                        ? 'bg-[#ff5722] text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clip thumbnail preview */}
          {clipThumbnail && (
            <div className="flex items-center gap-4">
              <img src={clipThumbnail} alt="" className="w-32 h-20 object-cover rounded" />
              <div className="text-sm text-gray-400">
                <div>Duration: {formatTime(clipDuration)}</div>
                <div>Keyframes: {localRamp.keyframes.length}</div>
                <div>Status: {localRamp.enabled ? 'Speed ramping enabled' : 'Normal speed'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Drag keyframes to adjust • 0.1x to 10x speed range • Log scale for precision
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
                onSpeedRampChange(localRamp)
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

// Export utility function for calculating effective duration with speed ramp
export function calculateEffectiveDuration(originalDuration: number, speedRamp: SpeedRamp): number {
  if (!speedRamp.enabled) return originalDuration

  // Integrate speed curve to get effective duration
  const samples = 100
  let effectiveDuration = 0

  for (let i = 0; i < samples; i++) {
    const t = i / samples
    const speed = getSpeedAtTime(speedRamp, t)
    effectiveDuration += (originalDuration / samples) / speed
  }

  return effectiveDuration
}
