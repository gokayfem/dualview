/**
 * GridTileComparison Component (MODE-003)
 * Checkerboard pattern alternating A and B tiles
 * Features:
 * - Adjustable tile size (8-256px)
 * - Animated tile swap option
 * - Drag to offset grid
 * - Toggle with G key
 * - Optional hexagonal grid pattern
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useProjectStore } from '../../stores/projectStore'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { Grid, Play, Pause, RotateCcw } from 'lucide-react'

export function GridTileComparison() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)
  const animationRef = useRef<number>(0)
  const animationPhaseRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)

  const [imagesLoaded, setImagesLoaded] = useState({ a: false, b: false })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const {
    gridTileSettings,
    setGridTileSettings,
    toggleGridTileAnimation
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
  const render = useCallback((timestamp: number) => {
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
    const { tileSize, animated, animationSpeed, offsetX, offsetY, hexagonal } = gridTileSettings

    // Update animation phase
    if (animated) {
      const deltaTime = timestamp - lastFrameTimeRef.current
      if (deltaTime > animationSpeed * 1000) {
        animationPhaseRef.current = 1 - animationPhaseRef.current
        lastFrameTimeRef.current = timestamp
      }
    }

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

    // If no sources, show placeholder
    if (!sourceAReady && !sourceBReady) {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, width, height)
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Draw complete images first to off-screen canvases
    const tempCanvasA = document.createElement('canvas')
    const tempCanvasB = document.createElement('canvas')
    tempCanvasA.width = width
    tempCanvasA.height = height
    tempCanvasB.width = width
    tempCanvasB.height = height

    const ctxA = tempCanvasA.getContext('2d')
    const ctxB = tempCanvasB.getContext('2d')

    if (ctxA && sourceA && sourceAReady) {
      ctxA.drawImage(sourceA, 0, 0, width, height)
    } else if (ctxA) {
      ctxA.fillStyle = '#1a1a1a'
      ctxA.fillRect(0, 0, width, height)
    }

    if (ctxB && sourceB && sourceBReady) {
      ctxB.drawImage(sourceB, 0, 0, width, height)
    } else if (ctxB) {
      ctxB.fillStyle = '#252525'
      ctxB.fillRect(0, 0, width, height)
    }

    // Calculate offset in pixels
    const pixelOffsetX = offsetX * tileSize
    const pixelOffsetY = offsetY * tileSize

    // Draw checkerboard pattern
    const cols = Math.ceil(width / tileSize) + 2
    const rows = Math.ceil(height / tileSize) + 2

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * tileSize + pixelOffsetX
        const y = row * tileSize + pixelOffsetY

        // Skip if completely outside canvas
        if (x + tileSize < 0 || x > width || y + tileSize < 0 || y > height) continue

        // Determine which source to show
        let showA: boolean
        if (hexagonal) {
          // Hexagonal offset pattern
          const rowOffset = row % 2 === 0 ? 0 : 0.5
          showA = Math.floor(col + rowOffset) % 2 === row % 2
        } else {
          // Standard checkerboard
          showA = (col + row) % 2 === 0
        }

        // Swap during animation
        if (animated && animationPhaseRef.current === 1) {
          showA = !showA
        }

        // Draw the tile
        ctx.save()
        ctx.beginPath()
        ctx.rect(Math.max(0, x), Math.max(0, y), tileSize, tileSize)
        ctx.clip()

        if (showA) {
          ctx.drawImage(tempCanvasA, 0, 0)
        } else {
          ctx.drawImage(tempCanvasB, 0, 0)
        }

        ctx.restore()
      }
    }

    // Draw grid lines for clarity
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)'
    ctx.lineWidth = 1

    for (let col = 0; col <= cols; col++) {
      const x = col * tileSize + pixelOffsetX
      if (x >= 0 && x <= width) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    }

    for (let row = 0; row <= rows; row++) {
      const y = row * tileSize + pixelOffsetY
      if (y >= 0 && y <= height) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    }

    animationRef.current = requestAnimationFrame(render)
  }, [mediaA, mediaB, gridTileSettings, imagesLoaded])

  // Start render loop
  useEffect(() => {
    lastFrameTimeRef.current = performance.now()
    animationRef.current = requestAnimationFrame(render)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  // Handle mouse drag for offset
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return

    const dx = (e.clientX - dragStart.x) / gridTileSettings.tileSize
    const dy = (e.clientY - dragStart.y) / gridTileSettings.tileSize

    setGridTileSettings({
      offsetX: (gridTileSettings.offsetX + dx) % 1,
      offsetY: (gridTileSettings.offsetY + dy) % 1
    })

    setDragStart({ x: e.clientX, y: e.clientY })
  }, [isDragging, dragStart, gridTileSettings.tileSize, gridTileSettings.offsetX, gridTileSettings.offsetY, setGridTileSettings])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Reset offset
  const resetOffset = useCallback(() => {
    setGridTileSettings({ offsetX: 0, offsetY: 0 })
  }, [setGridTileSettings])

  // Empty state
  if (!mediaA && !mediaB) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-center p-8">
          <Grid className="w-16 h-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-xl font-bold text-text-primary mb-2">Grid Tile</h3>
          <p className="text-text-muted">
            Add media to Track A and Track B to see a checkerboard comparison.
          </p>
          <p className="text-sm text-text-muted mt-4">
            Drag to offset the grid, or enable animation for flicker comparison.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-black overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
        {/* Animation toggle */}
        <button
          onClick={toggleGridTileAnimation}
          className={`p-2 rounded transition-colors ${gridTileSettings.animated ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={gridTileSettings.animated ? 'Stop animation' : 'Start animation'}
        >
          {gridTileSettings.animated ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* Reset offset */}
        <button
          onClick={resetOffset}
          className="p-2 rounded bg-black/70 text-gray-400 hover:text-white transition-colors"
          title="Reset offset"
        >
          <RotateCcw size={16} />
        </button>

        {/* Hexagonal toggle */}
        <button
          onClick={() => setGridTileSettings({ hexagonal: !gridTileSettings.hexagonal })}
          className={`p-2 rounded transition-colors ${gridTileSettings.hexagonal ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={gridTileSettings.hexagonal ? 'Standard grid' : 'Hexagonal grid'}
        >
          <Grid size={16} />
        </button>
      </div>

      {/* Mode indicator */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1.5 rounded text-sm">
        <span className="text-gray-400">Mode:</span>
        <span className="text-[#cddc39] ml-2 font-medium">Grid Tile</span>
        {gridTileSettings.animated && <span className="text-orange-400 ml-2">(Animated)</span>}
        {gridTileSettings.hexagonal && <span className="text-blue-400 ml-2">(Hex)</span>}
      </div>

      {/* Settings display */}
      <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400">
        Tile Size: {gridTileSettings.tileSize}px |
        Speed: {gridTileSettings.animationSpeed}s |
        Drag to offset
      </div>

      {/* Tile size slider */}
      <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-2 rounded">
        <label className="text-xs text-gray-400 block mb-1">Tile Size</label>
        <input
          type="range"
          min={8}
          max={256}
          value={gridTileSettings.tileSize}
          onChange={(e) => setGridTileSettings({ tileSize: parseInt(e.target.value) })}
          className="w-32 accent-accent"
        />
        <div className="text-xs text-gray-400 mt-1 text-center">{gridTileSettings.tileSize}px</div>
      </div>

      {/* Animation speed slider (when animated) */}
      {gridTileSettings.animated && (
        <div className="absolute bottom-20 right-4 bg-black/70 px-3 py-2 rounded">
          <label className="text-xs text-gray-400 block mb-1">Speed</label>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={gridTileSettings.animationSpeed}
            onChange={(e) => setGridTileSettings({ animationSpeed: parseFloat(e.target.value) })}
            className="w-32 accent-accent"
          />
          <div className="text-xs text-gray-400 mt-1 text-center">{gridTileSettings.animationSpeed.toFixed(1)}s</div>
        </div>
      )}
    </div>
  )
}
