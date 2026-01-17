/**
 * RadialLoupeComparison Component (MODE-002)
 * Circular magnifying lens that follows cursor
 * Features:
 * - Inside loupe shows source B, outside shows source A
 * - Adjustable radius (50-300px)
 * - Adjustable magnification (2x-16x)
 * - Smooth edge feathering option
 * - Split loupe mode (A|B inside circle)
 * - Lock position on click
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useProjectStore } from '../../stores/projectStore'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { Lock, Unlock, Circle, Square, SplitSquareVertical, ZoomIn, ZoomOut } from 'lucide-react'

export function RadialLoupeComparison() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)
  const animationRef = useRef<number>(0)

  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const [imagesLoaded, setImagesLoaded] = useState({ a: false, b: false })

  const {
    radialLoupeSettings,
    setRadialLoupeSettings,
    toggleRadialLoupeLock
  } = useProjectStore()
  const { getFile } = useMediaStore()
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()

  // Get tracks and clips
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const firstClipA = trackA?.clips[0] || null
  const firstClipB = trackB?.clips[0] || null

  // Find active clip
  const activeClipA = useMemo(() => {
    if (!trackA) return null
    return trackA.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackA, currentTime])

  const activeClipB = useMemo(() => {
    if (!trackB) return null
    return trackB.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackB, currentTime])

  // Get media files - use active clip (clip at current time), fallback to first clip
  const displayClipA = activeClipA || firstClipA
  const displayClipB = activeClipB || firstClipB
  const rawMediaA = displayClipA ? getFile(displayClipA.mediaId) : null
  const rawMediaB = displayClipB ? getFile(displayClipB.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null
  const mediaB = rawMediaB?.type === 'video' || rawMediaB?.type === 'image' ? rawMediaB : null

  // Sync video playback
  useOptimizedClipSync(videoARef, activeClipA || firstClipA)
  useOptimizedClipSync(videoBRef, activeClipB || firstClipB)

  // Handle image load
  const handleImageALoad = useCallback(() => {
    setImagesLoaded(prev => ({ ...prev, a: true }))
  }, [])

  const handleImageBLoad = useCallback(() => {
    setImagesLoaded(prev => ({ ...prev, b: true }))
  }, [])

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

    // Get settings
    const { radius, magnification, featherEdge, splitMode, locked, lockedPosition, showRectangular } = radialLoupeSettings

    // Determine loupe center (use locked position or current mouse)
    const loupeCenter = locked && lockedPosition ? lockedPosition : mousePos
    const loupeCenterX = loupeCenter.x * width
    const loupeCenterY = loupeCenter.y * height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get sources
    const sourceA = mediaA?.type === 'video' ? videoARef.current :
                   mediaA?.type === 'image' ? imgARef.current : null
    const sourceB = mediaB?.type === 'video' ? videoBRef.current :
                   mediaB?.type === 'image' ? imgBRef.current : null

    // Check if sources are ready
    const sourceAReady = sourceA && (
      mediaA?.type === 'video' ? (videoARef.current?.readyState || 0) >= 2 :
      mediaA?.type === 'image' && imagesLoaded.a
    )
    const sourceBReady = sourceB && (
      mediaB?.type === 'video' ? (videoBRef.current?.readyState || 0) >= 2 :
      mediaB?.type === 'image' && imagesLoaded.b
    )

    // Draw base layer (source A)
    if (sourceA && sourceAReady) {
      ctx.drawImage(sourceA, 0, 0, width, height)
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, width, height)
    }

    // Draw loupe if source B is available
    if (sourceB && sourceBReady) {
      ctx.save()

      // Create clipping path for loupe
      ctx.beginPath()
      if (showRectangular) {
        ctx.rect(loupeCenterX - radius, loupeCenterY - radius, radius * 2, radius * 2)
      } else {
        ctx.arc(loupeCenterX, loupeCenterY, radius, 0, Math.PI * 2)
      }
      ctx.clip()

      // Calculate source coordinates for magnification
      const srcWidth = 'videoWidth' in sourceB ? sourceB.videoWidth : sourceB.naturalWidth
      const srcHeight = 'videoHeight' in sourceB ? sourceB.videoHeight : sourceB.naturalHeight

      // Magnified region
      const srcX = loupeCenter.x * srcWidth - (srcWidth / magnification) / 2
      const srcY = loupeCenter.y * srcHeight - (srcHeight / magnification) / 2

      if (splitMode) {
        // Split mode: A on left half, B on right half inside loupe
        // Left half - draw A magnified
        ctx.save()
        ctx.beginPath()
        ctx.rect(loupeCenterX - radius, loupeCenterY - radius, radius, radius * 2)
        ctx.clip()

        if (sourceA && sourceAReady) {
          const srcAWidth = 'videoWidth' in sourceA ? sourceA.videoWidth : sourceA.naturalWidth
          const srcAHeight = 'videoHeight' in sourceA ? sourceA.videoHeight : sourceA.naturalHeight
          const srcAX = loupeCenter.x * srcAWidth - (srcAWidth / magnification) / 2
          const srcAY = loupeCenter.y * srcAHeight - (srcAHeight / magnification) / 2

          ctx.drawImage(
            sourceA,
            srcAX, srcAY, srcAWidth / magnification, srcAHeight / magnification,
            loupeCenterX - radius, loupeCenterY - radius, radius * 2, radius * 2
          )
        }
        ctx.restore()

        // Right half - draw B magnified
        ctx.save()
        ctx.beginPath()
        ctx.rect(loupeCenterX, loupeCenterY - radius, radius, radius * 2)
        ctx.clip()

        ctx.drawImage(
          sourceB,
          srcX, srcY, srcWidth / magnification, srcHeight / magnification,
          loupeCenterX - radius, loupeCenterY - radius, radius * 2, radius * 2
        )
        ctx.restore()

        // Draw divider line
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(loupeCenterX, loupeCenterY - radius)
        ctx.lineTo(loupeCenterX, loupeCenterY + radius)
        ctx.stroke()
      } else {
        // Normal mode: B fills entire loupe
        ctx.drawImage(
          sourceB,
          srcX, srcY, srcWidth / magnification, srcHeight / magnification,
          loupeCenterX - radius, loupeCenterY - radius, radius * 2, radius * 2
        )
      }

      ctx.restore()

      // Draw loupe border
      ctx.strokeStyle = featherEdge ? 'rgba(255,255,255,0.5)' : '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      if (showRectangular) {
        ctx.rect(loupeCenterX - radius, loupeCenterY - radius, radius * 2, radius * 2)
      } else {
        ctx.arc(loupeCenterX, loupeCenterY, radius, 0, Math.PI * 2)
      }
      ctx.stroke()

      // Draw crosshair in center
      ctx.strokeStyle = 'rgba(255,255,0,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(loupeCenterX - 10, loupeCenterY)
      ctx.lineTo(loupeCenterX + 10, loupeCenterY)
      ctx.moveTo(loupeCenterX, loupeCenterY - 10)
      ctx.lineTo(loupeCenterX, loupeCenterY + 10)
      ctx.stroke()
    }

    animationRef.current = requestAnimationFrame(render)
  }, [mediaA, mediaB, mousePos, radialLoupeSettings, imagesLoaded])

  // Start render loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (radialLoupeSettings.locked) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMousePos({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) })
  }, [radialLoupeSettings.locked])

  // Handle click to lock/unlock
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (radialLoupeSettings.locked) {
      // Unlock
      toggleRadialLoupeLock()
    } else {
      // Lock at current position
      setRadialLoupeSettings({ lockedPosition: { x, y } })
      toggleRadialLoupeLock()
    }
  }, [radialLoupeSettings.locked, setRadialLoupeSettings, toggleRadialLoupeLock])

  // Empty state
  if (!mediaA && !mediaB) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-center p-8">
          <Circle className="w-16 h-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-xl font-bold text-text-primary mb-2">Radial Loupe</h3>
          <p className="text-text-muted">
            Add media to Track A and Track B to compare with a magnifying loupe.
          </p>
          <p className="text-sm text-text-muted mt-4">
            Inside the loupe shows B, outside shows A.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-black overflow-hidden"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      style={{ cursor: radialLoupeSettings.locked ? 'pointer' : 'none' }}
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
      <video
        ref={videoBRef}
        src={mediaB?.type === 'video' ? mediaB.url : undefined}
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
      {mediaB?.type === 'image' && (
        <img
          ref={imgBRef}
          src={mediaB.url}
          className="hidden"
          onLoad={handleImageBLoad}
          alt=""
        />
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* Lock button */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleRadialLoupeLock() }}
          className={`p-2 rounded transition-colors ${radialLoupeSettings.locked ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={radialLoupeSettings.locked ? 'Unlock position' : 'Lock position'}
        >
          {radialLoupeSettings.locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        {/* Shape toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setRadialLoupeSettings({ showRectangular: !radialLoupeSettings.showRectangular }) }}
          className={`p-2 rounded transition-colors ${radialLoupeSettings.showRectangular ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={radialLoupeSettings.showRectangular ? 'Switch to circular' : 'Switch to rectangular'}
        >
          {radialLoupeSettings.showRectangular ? <Square size={16} /> : <Circle size={16} />}
        </button>

        {/* Split mode toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setRadialLoupeSettings({ splitMode: !radialLoupeSettings.splitMode }) }}
          className={`p-2 rounded transition-colors ${radialLoupeSettings.splitMode ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={radialLoupeSettings.splitMode ? 'Normal mode' : 'Split mode (A|B)'}
        >
          <SplitSquareVertical size={16} />
        </button>

        <div className="w-px h-4 bg-gray-600 mx-auto" />

        {/* Magnification controls */}
        <button
          onClick={(e) => { e.stopPropagation(); setRadialLoupeSettings({ magnification: Math.min(16, radialLoupeSettings.magnification + 1) }) }}
          className="p-2 rounded bg-black/70 text-gray-400 hover:text-white transition-colors"
          title="Increase magnification"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setRadialLoupeSettings({ magnification: Math.max(2, radialLoupeSettings.magnification - 1) }) }}
          className="p-2 rounded bg-black/70 text-gray-400 hover:text-white transition-colors"
          title="Decrease magnification"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Mode indicator */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1.5 rounded text-sm">
        <span className="text-gray-400">Mode:</span>
        <span className="text-[#cddc39] ml-2 font-medium">Radial Loupe</span>
        {radialLoupeSettings.splitMode && <span className="text-orange-400 ml-2">(Split)</span>}
      </div>

      {/* Settings display */}
      <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400">
        Radius: {radialLoupeSettings.radius}px |
        Zoom: {radialLoupeSettings.magnification}x |
        {radialLoupeSettings.locked ? ' Locked' : ' Click to lock'}
      </div>

      {/* Radius slider */}
      <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-2 rounded">
        <label className="text-xs text-gray-400 block mb-1">Radius</label>
        <input
          type="range"
          min={50}
          max={300}
          value={radialLoupeSettings.radius}
          onChange={(e) => setRadialLoupeSettings({ radius: parseInt(e.target.value) })}
          className="w-32 accent-accent"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
