/**
 * WEBGL-009: Temporal Difference Graph
 * Line graph showing difference values over video timeline
 * Clickable to seek, highlights peaks/anomalies
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { Play, Pause, BarChart2, Loader2 } from 'lucide-react'

interface DifferenceDataPoint {
  time: number
  avgDiff: number
  peakDiff: number
}

interface TemporalDiffGraphProps {
  videoARef: React.RefObject<HTMLVideoElement | null>
  videoBRef: React.RefObject<HTMLVideoElement | null>
  isVisible: boolean
}

export function TemporalDiffGraph({ videoARef, videoBRef, isVisible }: TemporalDiffGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<DifferenceDataPoint[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [hoveredTime, setHoveredTime] = useState<number | null>(null)

  const { currentTime, seek, isPlaying, togglePlay } = usePlaybackStore()
  const { duration } = useTimelineStore()

  // Sample interval in seconds (analyze every 0.5 seconds)
  const sampleInterval = 0.5

  // Compute difference between two video frames
  const computeFrameDifference = useCallback((
    videoA: HTMLVideoElement,
    videoB: HTMLVideoElement
  ): { avgDiff: number; peakDiff: number } => {
    const canvas = document.createElement('canvas')
    const width = 160  // Sample at low resolution for speed
    const height = 90
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) return { avgDiff: 0, peakDiff: 0 }

    // Draw video A
    ctx.drawImage(videoA, 0, 0, width, height)
    const dataA = ctx.getImageData(0, 0, width, height)

    // Draw video B
    ctx.drawImage(videoB, 0, 0, width, height)
    const dataB = ctx.getImageData(0, 0, width, height)

    let totalDiff = 0
    let peakDiff = 0
    const pixelCount = width * height

    for (let i = 0; i < dataA.data.length; i += 4) {
      const rDiff = Math.abs(dataA.data[i] - dataB.data[i])
      const gDiff = Math.abs(dataA.data[i + 1] - dataB.data[i + 1])
      const bDiff = Math.abs(dataA.data[i + 2] - dataB.data[i + 2])
      const pixelDiff = (rDiff + gDiff + bDiff) / 3
      totalDiff += pixelDiff
      peakDiff = Math.max(peakDiff, Math.max(rDiff, gDiff, bDiff))
    }

    return {
      avgDiff: totalDiff / pixelCount,
      peakDiff
    }
  }, [])

  // Analyze video and build difference data
  const analyzeVideo = useCallback(async () => {
    const videoA = videoARef.current
    const videoB = videoBRef.current

    if (!videoA || !videoB || !duration) return

    setIsAnalyzing(true)
    setData([])
    setAnalysisProgress(0)

    const points: DifferenceDataPoint[] = []
    const totalSamples = Math.ceil(duration / sampleInterval)

    // Store original time
    const originalTimeA = videoA.currentTime
    const originalTimeB = videoB.currentTime

    for (let i = 0; i <= totalSamples; i++) {
      const time = Math.min(i * sampleInterval, duration)

      // Seek both videos to this time
      videoA.currentTime = time
      videoB.currentTime = time

      // Wait for both to seek
      await Promise.all([
        new Promise<void>(resolve => {
          const handler = () => {
            videoA.removeEventListener('seeked', handler)
            resolve()
          }
          videoA.addEventListener('seeked', handler)
        }),
        new Promise<void>(resolve => {
          const handler = () => {
            videoB.removeEventListener('seeked', handler)
            resolve()
          }
          videoB.addEventListener('seeked', handler)
        })
      ])

      // Compute difference
      const diff = computeFrameDifference(videoA, videoB)
      points.push({ time, ...diff })

      setAnalysisProgress(((i + 1) / totalSamples) * 100)

      // Yield to UI
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    // Restore original time
    videoA.currentTime = originalTimeA
    videoB.currentTime = originalTimeB

    setData(points)
    setIsAnalyzing(false)
  }, [videoARef, videoBRef, duration, sampleInterval, computeFrameDifference])

  // Find peaks/anomalies in the data
  const peaks = useMemo(() => {
    if (data.length < 3) return []

    const threshold = 30 // Difference threshold for peak detection
    const peaks: number[] = []

    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1].avgDiff
      const curr = data[i].avgDiff
      const next = data[i + 1].avgDiff

      // Local maximum above threshold
      if (curr > prev && curr > next && curr > threshold) {
        peaks.push(i)
      }
    }

    return peaks
  }, [data])

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !isVisible) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = container.getBoundingClientRect()
    canvas.width = width * 2  // 2x for retina
    canvas.height = height * 2
    ctx.scale(2, 2)

    // Clear
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    if (data.length === 0) {
      ctx.fillStyle = '#666666'
      ctx.font = '12px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Click "Analyze" to generate temporal difference graph', width / 2, height / 2)
      return
    }

    // Find max for scaling
    const maxDiff = Math.max(...data.map(d => d.avgDiff), 1)
    const graphPadding = { top: 20, right: 20, bottom: 30, left: 50 }
    const graphWidth = width - graphPadding.left - graphPadding.right
    const graphHeight = height - graphPadding.top - graphPadding.bottom

    // Draw grid
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = graphPadding.top + (graphHeight * i) / 4
      ctx.beginPath()
      ctx.moveTo(graphPadding.left, y)
      ctx.lineTo(width - graphPadding.right, y)
      ctx.stroke()
    }

    // Draw Y-axis labels
    ctx.fillStyle = '#666666'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const y = graphPadding.top + (graphHeight * i) / 4
      const value = maxDiff * (1 - i / 4)
      ctx.fillText(value.toFixed(0), graphPadding.left - 5, y + 3)
    }

    // Draw X-axis labels (time)
    ctx.textAlign = 'center'
    const timeStep = Math.ceil(duration / 5)
    for (let t = 0; t <= duration; t += timeStep) {
      const x = graphPadding.left + (t / duration) * graphWidth
      const minutes = Math.floor(t / 60)
      const seconds = Math.floor(t % 60)
      ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, x, height - 10)
    }

    // Draw difference line
    ctx.beginPath()
    ctx.strokeStyle = '#ff5722'
    ctx.lineWidth = 1.5
    data.forEach((point, i) => {
      const x = graphPadding.left + (point.time / duration) * graphWidth
      const y = graphPadding.top + graphHeight - (point.avgDiff / maxDiff) * graphHeight

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw peak markers
    ctx.fillStyle = '#ff0000'
    peaks.forEach(peakIndex => {
      const point = data[peakIndex]
      const x = graphPadding.left + (point.time / duration) * graphWidth
      const y = graphPadding.top + graphHeight - (point.avgDiff / maxDiff) * graphHeight

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw playhead position
    const playheadX = graphPadding.left + (currentTime / duration) * graphWidth
    ctx.strokeStyle = '#cddc39'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, graphPadding.top)
    ctx.lineTo(playheadX, height - graphPadding.bottom)
    ctx.stroke()

    // Draw hover indicator
    if (hoveredTime !== null) {
      const hoverX = graphPadding.left + (hoveredTime / duration) * graphWidth
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(hoverX, graphPadding.top)
      ctx.lineTo(hoverX, height - graphPadding.bottom)
      ctx.stroke()
      ctx.setLineDash([])

      // Find closest data point
      const closestPoint = data.reduce((closest, point) =>
        Math.abs(point.time - hoveredTime) < Math.abs(closest.time - hoveredTime) ? point : closest
      )

      // Draw tooltip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(hoverX + 10, 30, 100, 50)
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`Time: ${hoveredTime.toFixed(1)}s`, hoverX + 15, 45)
      ctx.fillText(`Avg: ${closestPoint.avgDiff.toFixed(1)}`, hoverX + 15, 58)
      ctx.fillText(`Peak: ${closestPoint.peakDiff.toFixed(0)}`, hoverX + 15, 71)
    }

    // Axis labels
    ctx.fillStyle = '#888888'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('Time', width / 2, height - 2)

    ctx.save()
    ctx.translate(12, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Avg Difference', 0, 0)
    ctx.restore()

  }, [data, currentTime, duration, isVisible, peaks, hoveredTime])

  // Handle click to seek
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !duration) return

    const rect = container.getBoundingClientRect()
    const graphPadding = { left: 50, right: 20 }
    const graphWidth = rect.width - graphPadding.left - graphPadding.right
    const x = e.clientX - rect.left - graphPadding.left

    if (x >= 0 && x <= graphWidth) {
      const time = (x / graphWidth) * duration
      seek(time)
    }
  }, [duration, seek])

  // Handle mouse move for hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !duration) return

    const rect = container.getBoundingClientRect()
    const graphPadding = { left: 50, right: 20 }
    const graphWidth = rect.width - graphPadding.left - graphPadding.right
    const x = e.clientX - rect.left - graphPadding.left

    if (x >= 0 && x <= graphWidth) {
      const time = (x / graphWidth) * duration
      setHoveredTime(time)
    } else {
      setHoveredTime(null)
    }
  }, [duration])

  const handleMouseLeave = useCallback(() => {
    setHoveredTime(null)
  }, [])

  if (!isVisible) return null

  return (
    <div className="bg-[#1a1a1a] border-t border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-[#ff5722]" />
          <span className="text-sm text-gray-300 font-medium">Temporal Difference Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          {data.length > 0 && (
            <span className="text-xs text-gray-500">
              {peaks.length} peak{peaks.length !== 1 ? 's' : ''} detected
            </span>
          )}
          <button
            onClick={togglePlay}
            className="p-1 rounded bg-black/50 text-gray-400 hover:text-white transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={analyzeVideo}
            disabled={isAnalyzing}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              isAnalyzing
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-[#ff5722] text-white hover:bg-[#e64a19]'
            }`}
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                {analysisProgress.toFixed(0)}%
              </span>
            ) : (
              'Analyze'
            )}
          </button>
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="h-32 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Peak list */}
      {peaks.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-700 overflow-x-auto">
          <span className="text-xs text-gray-500 whitespace-nowrap">Jump to peak:</span>
          {peaks.map((peakIndex, i) => {
            const point = data[peakIndex]
            const minutes = Math.floor(point.time / 60)
            const seconds = Math.floor(point.time % 60)
            return (
              <button
                key={i}
                onClick={() => seek(point.time)}
                className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 text-xs hover:bg-red-900 transition-colors whitespace-nowrap"
              >
                {minutes}:{seconds.toString().padStart(2, '0')} ({point.avgDiff.toFixed(0)})
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
