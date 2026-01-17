/**
 * IMG-004: Difference Heatmap
 * Visualizes pixel-level differences between two images/videos as a heatmap
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { cn } from '../../lib/utils'

type HeatmapMode = 'absolute' | 'amplified' | 'threshold'

export function DifferenceHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const animationRef = useRef<number | undefined>(undefined)

  const [mode, setMode] = useState<HeatmapMode>('amplified')
  const [threshold, setThreshold] = useState(10) // For threshold mode
  const [amplification, setAmplification] = useState(5) // For amplified mode

  const { currentTime, isPlaying, tracks, playbackSpeed, loopRegion, seek } = useTimelineStore()
  const { getFile } = useMediaStore()

  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const clipA = trackA?.clips[0]
  const clipB = trackB?.clips[0]
  // Only use video/image, not audio
  const rawMediaA = clipA ? getFile(clipA.mediaId) : null
  const rawMediaB = clipB ? getFile(clipB.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null
  const mediaB = rawMediaB?.type === 'video' || rawMediaB?.type === 'image' ? rawMediaB : null

  // Render the difference heatmap
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx) return

    const videoA = videoARef.current
    const videoB = videoBRef.current

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!videoA || !videoB) {
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(renderFrame)
      }
      return
    }

    // Create temporary canvases to read pixel data
    const tempCanvasA = document.createElement('canvas')
    const tempCanvasB = document.createElement('canvas')
    tempCanvasA.width = canvas.width
    tempCanvasA.height = canvas.height
    tempCanvasB.width = canvas.width
    tempCanvasB.height = canvas.height

    const ctxA = tempCanvasA.getContext('2d', { willReadFrequently: true })
    const ctxB = tempCanvasB.getContext('2d', { willReadFrequently: true })
    if (!ctxA || !ctxB) return

    // Draw videos to temp canvases
    ctxA.drawImage(videoA, 0, 0, canvas.width, canvas.height)
    ctxB.drawImage(videoB, 0, 0, canvas.width, canvas.height)

    // Get pixel data
    const dataA = ctxA.getImageData(0, 0, canvas.width, canvas.height)
    const dataB = ctxB.getImageData(0, 0, canvas.width, canvas.height)
    const output = ctx.createImageData(canvas.width, canvas.height)

    // Calculate difference for each pixel
    for (let i = 0; i < dataA.data.length; i += 4) {
      const rDiff = Math.abs(dataA.data[i] - dataB.data[i])
      const gDiff = Math.abs(dataA.data[i + 1] - dataB.data[i + 1])
      const bDiff = Math.abs(dataA.data[i + 2] - dataB.data[i + 2])

      // Calculate total difference (0-255 scale)
      const totalDiff = (rDiff + gDiff + bDiff) / 3

      let r = 0, g = 0, b = 0

      switch (mode) {
        case 'absolute':
          // Direct grayscale representation
          r = g = b = totalDiff
          break

        case 'amplified':
          // Amplify differences with color gradient
          const amplifiedDiff = Math.min(255, totalDiff * amplification)
          // Blue (cold, similar) -> Red (hot, different)
          if (amplifiedDiff < 128) {
            r = 0
            g = amplifiedDiff * 2
            b = 255 - amplifiedDiff * 2
          } else {
            r = (amplifiedDiff - 128) * 2
            g = 255 - (amplifiedDiff - 128) * 2
            b = 0
          }
          break

        case 'threshold':
          // Binary threshold - show only differences above threshold
          if (totalDiff > threshold) {
            r = 255
            g = 0
            b = 0
          } else {
            // Show original image from A with reduced opacity
            r = dataA.data[i]
            g = dataA.data[i + 1]
            b = dataA.data[i + 2]
          }
          break
      }

      output.data[i] = r
      output.data[i + 1] = g
      output.data[i + 2] = b
      output.data[i + 3] = 255 // Full opacity
    }

    ctx.putImageData(output, 0, 0)

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(renderFrame)
    }
  }, [isPlaying, mode, threshold, amplification])

  // Apply playback speed (VID-002)
  useEffect(() => {
    if (videoARef.current) videoARef.current.playbackRate = playbackSpeed
    if (videoBRef.current) videoBRef.current.playbackRate = playbackSpeed
  }, [playbackSpeed])

  // Handle loop region (VID-003)
  useEffect(() => {
    const videoA = videoARef.current
    if (!videoA || !isPlaying || !loopRegion) return

    const handleTimeUpdate = () => {
      if (videoA.currentTime >= loopRegion.outPoint) {
        videoA.currentTime = loopRegion.inPoint
        if (videoBRef.current) videoBRef.current.currentTime = loopRegion.inPoint
        seek(loopRegion.inPoint)
      }
    }

    videoA.addEventListener('timeupdate', handleTimeUpdate)
    return () => videoA.removeEventListener('timeupdate', handleTimeUpdate)
  }, [isPlaying, loopRegion, seek])

  // Sync video playback
  useEffect(() => {
    if (videoARef.current && mediaA) {
      videoARef.current.currentTime = currentTime
      if (isPlaying) {
        videoARef.current.play().catch(() => {})
      } else {
        videoARef.current.pause()
      }
    }
    if (videoBRef.current && mediaB) {
      videoBRef.current.currentTime = currentTime
      if (isPlaying) {
        videoBRef.current.play().catch(() => {})
      } else {
        videoBRef.current.pause()
      }
    }
  }, [currentTime, isPlaying, mediaA, mediaB])

  // Start render loop
  useEffect(() => {
    renderFrame()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [renderFrame])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
        renderFrame()
      }
    }

    resizeCanvas()
    const observer = new ResizeObserver(resizeCanvas)
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement)
    }
    return () => observer.disconnect()
  }, [renderFrame])

  return (
    <div className="relative w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Hidden video elements for canvas drawing */}
      {mediaA?.type === 'video' && (
        <video
          ref={videoARef}
          src={mediaA.url}
          className="hidden"
          muted
          playsInline
          loop
          crossOrigin="anonymous"
        />
      )}
      {mediaB?.type === 'video' && (
        <video
          ref={videoBRef}
          src={mediaB.url}
          className="hidden"
          muted
          playsInline
          loop
          crossOrigin="anonymous"
        />
      )}

      {/* Placeholder when no media */}
      {!mediaA && !mediaB && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted">
          <span>Drop videos/images to see difference heatmap</span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm p-3 space-y-3 z-10">
        <div className="text-xs text-text-primary font-medium">Heatmap Mode</div>

        <div className="flex gap-2">
          {(['absolute', 'amplified', 'threshold'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-2 py-1 text-[10px] capitalize transition-colors',
                mode === m
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'amplified' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Amplify:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={amplification}
              onChange={(e) => setAmplification(Number(e.target.value))}
              className="w-20 h-1"
            />
            <span className="text-[10px] text-text-primary w-6">{amplification}x</span>
          </div>
        )}

        {mode === 'threshold' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Threshold:</span>
            <input
              type="range"
              min="1"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-20 h-1"
            />
            <span className="text-[10px] text-text-primary w-6">{threshold}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-2 z-10">
        {mode === 'amplified' && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-3 bg-gradient-to-r from-blue-500 via-green-500 to-red-500" />
            <span className="text-[10px] text-text-muted">Similar → Different</span>
          </div>
        )}
        {mode === 'absolute' && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-3 bg-gradient-to-r from-black to-white" />
            <span className="text-[10px] text-text-muted">Similar → Different</span>
          </div>
        )}
        {mode === 'threshold' && (
          <div className="text-[10px] text-text-muted">
            <span className="text-red-500">Red</span> = difference &gt; {threshold}
          </div>
        )}
      </div>

    </div>
  )
}
