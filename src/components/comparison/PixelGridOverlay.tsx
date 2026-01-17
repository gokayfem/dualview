/**
 * PixelGridOverlay Component (MODE-004)
 * Shows individual pixel boundaries at high zoom levels
 * Features:
 * - Grid lines appear automatically above 800% zoom
 * - Optional RGB value labels inside each pixel cell
 * - Grid color configurable (white, black, auto-contrast)
 * - Pixel coordinates shown on hover
 * - Copy pixel value to clipboard on click
 *
 * This is an overlay component that can be used with any comparison mode
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useProjectStore } from '../../stores/projectStore'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { Grid3X3, Eye, EyeOff, Check } from 'lucide-react'

export function PixelGridOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const imgARef = useRef<HTMLImageElement>(null)
  const animationRef = useRef<number>(0)

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; r: number; g: number; b: number } | null>(null)
  const [imagesLoaded, setImagesLoaded] = useState({ a: false, b: false })
  const [copied, setCopied] = useState(false)

  const { pixelGridSettings, setPixelGridSettings, togglePixelGrid } = useProjectStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()
  const { getFile } = useMediaStore()
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()

  // Get tracks and clips
  const trackA = tracks.find(t => t.type === 'a')
  const firstClipA = trackA?.clips[0] || null

  // Find active clip
  const activeClipA = useMemo(() => {
    if (!trackA) return null
    return trackA.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackA, currentTime])

  // Get media files - use active clip (clip at current time), fallback to first clip
  const displayClipA = activeClipA || firstClipA
  const rawMediaA = displayClipA ? getFile(displayClipA.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null

  // Sync video playback
  useOptimizedClipSync(videoARef, activeClipA || firstClipA)

  // Handle image load
  const handleImageALoad = useCallback(() => {
    setImagesLoaded(prev => ({ ...prev, a: true }))
  }, [])

  // Check if grid should be visible (zoom >= minZoomLevel)
  const shouldShowGrid = useMemo(() => {
    return pixelGridSettings.enabled && zoom >= pixelGridSettings.minZoomLevel
  }, [pixelGridSettings.enabled, pixelGridSettings.minZoomLevel, zoom])

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Get container dimensions
    const rect = container.getBoundingClientRect()
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width
      canvas.height = rect.height
    }

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get source
    const sourceA = mediaA?.type === 'video' ? videoARef.current :
                   mediaA?.type === 'image' ? imgARef.current : null

    const sourceAReady = sourceA && (
      mediaA?.type === 'video' ? (videoARef.current?.readyState || 0) >= 2 :
      mediaA?.type === 'image' && imagesLoaded.a
    )

    if (!sourceA || !sourceAReady) {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, width, height)
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Get source dimensions
    const srcWidth = 'videoWidth' in sourceA ? sourceA.videoWidth : sourceA.naturalWidth
    const srcHeight = 'videoHeight' in sourceA ? sourceA.videoHeight : sourceA.naturalHeight

    // Draw the source image
    ctx.drawImage(sourceA, 0, 0, width, height)

    // Only draw pixel grid if zoom is high enough
    if (!shouldShowGrid) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Calculate pixel size at current zoom
    const pixelWidth = (width / srcWidth) * zoom
    const pixelHeight = (height / srcHeight) * zoom

    // Only draw if pixels are reasonably large
    if (pixelWidth < 10 || pixelHeight < 10) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Determine grid color
    let gridColor = '#ffffff'
    if (pixelGridSettings.gridColor === 'black') {
      gridColor = '#000000'
    } else if (pixelGridSettings.gridColor === 'auto') {
      // Sample center pixel to determine contrast
      const centerData = ctx.getImageData(width / 2, height / 2, 1, 1).data
      const brightness = (centerData[0] + centerData[1] + centerData[2]) / 3
      gridColor = brightness > 128 ? '#000000' : '#ffffff'
    }

    // Draw grid lines
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.5

    // Calculate visible pixel range
    const startX = 0
    const startY = 0
    const endX = srcWidth
    const endY = srcHeight

    // Vertical lines
    for (let px = startX; px <= endX; px++) {
      const x = (px / srcWidth) * width * zoom
      if (x >= 0 && x <= width * zoom) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height * zoom)
        ctx.stroke()
      }
    }

    // Horizontal lines
    for (let py = startY; py <= endY; py++) {
      const y = (py / srcHeight) * height * zoom
      if (y >= 0 && y <= height * zoom) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width * zoom, y)
        ctx.stroke()
      }
    }

    ctx.globalAlpha = 1

    // Draw RGB values if enabled and pixels are large enough
    if (pixelGridSettings.showRGBValues && pixelWidth > 40 && pixelHeight > 20) {
      ctx.font = `${Math.min(10, pixelWidth / 6)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Only draw for visible pixels
      const visibleStartX = Math.floor(0)
      const visibleEndX = Math.min(srcWidth, Math.ceil(width / pixelWidth) + 1)
      const visibleStartY = Math.floor(0)
      const visibleEndY = Math.min(srcHeight, Math.ceil(height / pixelHeight) + 1)

      // Limit to reasonable number of labels
      const maxLabels = 100
      let labelCount = 0

      for (let py = visibleStartY; py < visibleEndY && labelCount < maxLabels; py++) {
        for (let px = visibleStartX; px < visibleEndX && labelCount < maxLabels; px++) {
          const x = (px + 0.5) * pixelWidth
          const y = (py + 0.5) * pixelHeight

          // Get pixel color from source
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = 1
          tempCanvas.height = 1
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.drawImage(sourceA, px, py, 1, 1, 0, 0, 1, 1)
            const data = tempCtx.getImageData(0, 0, 1, 1).data
            const r = data[0]
            const g = data[1]
            const b = data[2]

            // Determine text color for contrast
            const brightness = (r + g + b) / 3
            ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff'
            ctx.globalAlpha = 0.8

            // Draw RGB text
            ctx.fillText(`${r}`, x, y - 5)
            ctx.fillText(`${g}`, x, y + 5)
            ctx.fillText(`${b}`, x, y + 15)

            labelCount++
          }
        }
      }

      ctx.globalAlpha = 1
    }

    animationRef.current = requestAnimationFrame(render)
  }, [mediaA, shouldShowGrid, zoom, pixelGridSettings.gridColor, pixelGridSettings.showRGBValues, imagesLoaded])

  // Start render loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  // Handle mouse move to get pixel info
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMousePos({ x, y })

    // Get pixel info from source
    const sourceA = mediaA?.type === 'video' ? videoARef.current :
                   mediaA?.type === 'image' ? imgARef.current : null

    if (!sourceA) return

    const srcWidth = 'videoWidth' in sourceA ? sourceA.videoWidth : sourceA.naturalWidth
    const srcHeight = 'videoHeight' in sourceA ? sourceA.videoHeight : sourceA.naturalHeight

    const pixelX = Math.floor((x / rect.width) * srcWidth)
    const pixelY = Math.floor((y / rect.height) * srcHeight)

    if (pixelX >= 0 && pixelX < srcWidth && pixelY >= 0 && pixelY < srcHeight) {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = 1
      tempCanvas.height = 1
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.drawImage(sourceA, pixelX, pixelY, 1, 1, 0, 0, 1, 1)
        const data = tempCtx.getImageData(0, 0, 1, 1).data
        setHoveredPixel({
          x: pixelX,
          y: pixelY,
          r: data[0],
          g: data[1],
          b: data[2]
        })
      }
    }
  }, [mediaA])

  // Handle click to copy pixel value
  const handleClick = useCallback(() => {
    if (hoveredPixel) {
      const hexColor = `#${hoveredPixel.r.toString(16).padStart(2, '0')}${hoveredPixel.g.toString(16).padStart(2, '0')}${hoveredPixel.b.toString(16).padStart(2, '0')}`
      const value = `RGB(${hoveredPixel.r}, ${hoveredPixel.g}, ${hoveredPixel.b}) ${hexColor} @ (${hoveredPixel.x}, ${hoveredPixel.y})`
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }, [hoveredPixel])

  const transformStyle = getTransformStyle()

  // Empty state
  if (!mediaA) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-center p-8">
          <Grid3X3 className="w-16 h-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-xl font-bold text-text-primary mb-2">Pixel Grid</h3>
          <p className="text-text-muted">
            Add media to Track A to see pixel boundaries at high zoom.
          </p>
          <p className="text-sm text-text-muted mt-4">
            Zoom in to {pixelGridSettings.minZoomLevel * 100}% or more to see the pixel grid.
          </p>
        </div>
      </div>
    )
  }

  // Combine containerProps handlers with our own
  const combinedMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleMouseMove(e)
    containerProps.onMouseMove?.(e)
  }, [handleMouseMove, containerProps])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-black overflow-hidden"
      {...containerProps}
      onMouseMove={combinedMouseMove}
      onClick={handleClick}
      style={{ cursor: hoveredPixel ? 'crosshair' : 'default' }}
    >
      {/* Hidden video elements */}
      <video
        ref={videoARef}
        src={mediaA?.type === 'video' ? mediaA.url : undefined}
        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        muted
        playsInline
        loop
        preload="auto"
      />

      {/* Hidden image elements */}
      {mediaA?.type === 'image' && (
        <img
          ref={imgARef}
          src={mediaA.url}
          className="hidden"
          onLoad={handleImageALoad}
          alt=""
        />
      )}

      {/* Canvas with zoom transform */}
      <div className="w-full h-full" style={transformStyle}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
        />
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* Toggle grid */}
        <button
          onClick={togglePixelGrid}
          className={`p-2 rounded transition-colors ${pixelGridSettings.enabled ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={pixelGridSettings.enabled ? 'Hide grid' : 'Show grid'}
        >
          {pixelGridSettings.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        {/* Toggle RGB values */}
        <button
          onClick={() => setPixelGridSettings({ showRGBValues: !pixelGridSettings.showRGBValues })}
          className={`p-2 rounded transition-colors ${pixelGridSettings.showRGBValues ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={pixelGridSettings.showRGBValues ? 'Hide RGB values' : 'Show RGB values'}
        >
          <span className="text-xs font-bold">RGB</span>
        </button>

        {/* Grid color selector */}
        <div className="flex flex-col gap-1">
          {(['white', 'black', 'auto'] as const).map(color => (
            <button
              key={color}
              onClick={() => setPixelGridSettings({ gridColor: color })}
              className={`p-2 rounded text-xs transition-colors ${pixelGridSettings.gridColor === color ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
              title={`${color} grid lines`}
            >
              {color[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Mode indicator */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1.5 rounded text-sm">
        <span className="text-gray-400">Mode:</span>
        <span className="text-[#cddc39] ml-2 font-medium">Pixel Grid</span>
        {!shouldShowGrid && (
          <span className="text-orange-400 ml-2">(Zoom to {pixelGridSettings.minZoomLevel * 100}%+)</span>
        )}
      </div>

      {/* Zoom indicator */}
      {zoom > 1 && (
        <div className="absolute top-14 left-4 bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400">
          Zoom: {Math.round(zoom * 100)}% {shouldShowGrid && '- Grid visible'}
          <button
            onClick={(e) => { e.stopPropagation(); resetZoom() }}
            className="ml-2 text-text-muted hover:text-text-primary"
          >
            Reset
          </button>
        </div>
      )}

      {/* Pixel info tooltip */}
      {hoveredPixel && (
        <div
          className="absolute pointer-events-none bg-black/90 px-3 py-2 rounded text-xs font-mono z-50"
          style={{
            left: Math.min(mousePos.x + 15, (containerRef.current?.offsetWidth || 400) - 200),
            top: Math.min(mousePos.y + 15, (containerRef.current?.offsetHeight || 300) - 100)
          }}
        >
          <div className="text-gray-300 font-semibold mb-1">Pixel Info</div>
          <div className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded border border-gray-600"
              style={{ backgroundColor: `rgb(${hoveredPixel.r}, ${hoveredPixel.g}, ${hoveredPixel.b})` }}
            />
            <div>
              <div className="text-white">({hoveredPixel.x}, {hoveredPixel.y})</div>
              <div>
                <span className="text-red-400">{hoveredPixel.r}</span>
                {' '}
                <span className="text-green-400">{hoveredPixel.g}</span>
                {' '}
                <span className="text-blue-400">{hoveredPixel.b}</span>
              </div>
              <div className="text-gray-500">
                #{hoveredPixel.r.toString(16).padStart(2, '0')}
                {hoveredPixel.g.toString(16).padStart(2, '0')}
                {hoveredPixel.b.toString(16).padStart(2, '0')}
              </div>
            </div>
          </div>
          <div className="text-gray-500 mt-1 text-center">Click to copy</div>
        </div>
      )}

      {/* Copied notification */}
      {copied && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent text-white px-4 py-2 rounded flex items-center gap-2 z-50">
          <Check size={16} />
          Copied to clipboard!
        </div>
      )}

      {/* Settings display */}
      <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400">
        Grid: {pixelGridSettings.gridColor} |
        Min Zoom: {pixelGridSettings.minZoomLevel * 100}% |
        {pixelGridSettings.showRGBValues ? ' RGB on' : ' RGB off'}
      </div>
    </div>
  )
}
