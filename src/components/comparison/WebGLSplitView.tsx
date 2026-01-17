/**
 * WEBGL-011: Split View Component
 * Three-panel layout: Source A | Analysis | Source B
 * With synchronized zoom/pan and adjustable panel widths
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { WebGLComparisonRenderer } from '../../lib/webgl/WebGLComparisonRenderer'
import { getComparisonModeInfo } from '../../lib/webgl/comparison-shaders'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react'

interface WebGLSplitViewProps {
  isVisible: boolean
  onToggle: () => void
}

export function WebGLSplitView({ isVisible, onToggle }: WebGLSplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLComparisonRenderer | null>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)
  const animationRef = useRef<number>(0)

  const [leftWidth, setLeftWidth] = useState(30) // % for source A
  const [rightWidth, setRightWidth] = useState(30) // % for source B
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [imagesLoaded, setImagesLoaded] = useState({ a: false, b: false })

  const { webglComparisonSettings } = useProjectStore()
  const { getFile } = useMediaStore()
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()

  // Get active media from tracks
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const firstClipA = trackA?.clips[0] || null
  const firstClipB = trackB?.clips[0] || null

  // Find active clip (clip at current time)
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

  // Use the optimized clip sync hook for videos
  useOptimizedClipSync(videoARef, activeClipA || firstClipA)
  useOptimizedClipSync(videoBRef, activeClipB || firstClipB)

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current || !isVisible) return

    if (!WebGLComparisonRenderer.isSupported()) return

    const renderer = new WebGLComparisonRenderer(canvasRef.current)
    rendererRef.current = renderer
    renderer.setMode(webglComparisonSettings.mode)

    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [isVisible])

  // Update mode when settings change
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setMode(webglComparisonSettings.mode)
    }
  }, [webglComparisonSettings.mode])

  // Render loop for center panel
  const render = useCallback(() => {
    if (!isVisible) return

    const renderer = rendererRef.current
    if (!renderer) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Update texture A
    if (mediaA?.type === 'video' && videoARef.current && videoARef.current.readyState >= 2) {
      renderer.updateTexture('A', videoARef.current)
    } else if (mediaA?.type === 'image' && imgARef.current && imagesLoaded.a) {
      renderer.updateTexture('A', imgARef.current)
    }

    // Update texture B
    if (mediaB?.type === 'video' && videoBRef.current && videoBRef.current.readyState >= 2) {
      renderer.updateTexture('B', videoBRef.current)
    } else if (mediaB?.type === 'image' && imgBRef.current && imagesLoaded.b) {
      renderer.updateTexture('B', imgBRef.current)
    }

    // Render
    renderer.render({
      amplification: webglComparisonSettings.amplification,
      threshold: webglComparisonSettings.threshold,
      opacity: webglComparisonSettings.opacity,
      blockSize: webglComparisonSettings.blockSize,
      loupeSize: webglComparisonSettings.loupeSize,
      loupeZoom: webglComparisonSettings.loupeZoom,
      checkerSize: webglComparisonSettings.checkerSize,
      mouseX: 0.5,
      mouseY: 0.5
    })

    animationRef.current = requestAnimationFrame(render)
  }, [mediaA, mediaB, webglComparisonSettings, imagesLoaded, isVisible])

  // Start render loop
  useEffect(() => {
    if (!isVisible) return
    animationRef.current = requestAnimationFrame(render)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render, isVisible])

  // Handle resize for center canvas
  useEffect(() => {
    if (!isVisible) return

    const resizeCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width
        canvas.height = rect.height
        if (rendererRef.current) {
          rendererRef.current.resize(rect.width, rect.height)
        }
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [isVisible, leftWidth, rightWidth])

  // Handle divider drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100

    if (isDraggingLeft) {
      const newLeft = Math.max(15, Math.min(45, x))
      setLeftWidth(newLeft)
    }
    if (isDraggingRight) {
      const newRight = Math.max(15, Math.min(45, 100 - x))
      setRightWidth(newRight)
    }
  }, [isDraggingLeft, isDraggingRight])

  const handleMouseUp = useCallback(() => {
    setIsDraggingLeft(false)
    setIsDraggingRight(false)
  }, [])

  useEffect(() => {
    if (isDraggingLeft || isDraggingRight) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingLeft, isDraggingRight, handleMouseMove, handleMouseUp])

  const handleImageALoad = useCallback(() => {
    setImagesLoaded(prev => ({ ...prev, a: true }))
  }, [])

  const handleImageBLoad = useCallback(() => {
    setImagesLoaded(prev => ({ ...prev, b: true }))
  }, [])

  const modeInfo = getComparisonModeInfo(webglComparisonSettings.mode)
  const centerWidth = 100 - leftWidth - rightWidth

  if (!isVisible) return null

  return (
    <div ref={containerRef} className="absolute inset-0 flex bg-black z-40">
      {/* Hidden video/image elements for texture sources */}
      <video
        ref={videoARef}
        src={mediaA?.type === 'video' ? mediaA.url : undefined}
        className="hidden"
        muted
        playsInline
        loop
        preload="auto"
        autoPlay
      />
      <video
        ref={videoBRef}
        src={mediaB?.type === 'video' ? mediaB.url : undefined}
        className="hidden"
        muted
        playsInline
        loop
        preload="auto"
        autoPlay
      />
      {mediaA?.type === 'image' && (
        <img ref={imgARef} src={mediaA.url} className="hidden" onLoad={handleImageALoad} alt="" />
      )}
      {mediaB?.type === 'image' && (
        <img ref={imgBRef} src={mediaB.url} className="hidden" onLoad={handleImageBLoad} alt="" />
      )}

      {/* Source A Panel */}
      <div
        className="relative bg-black flex items-center justify-center overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {mediaA?.type === 'video' && (
          <video
            src={mediaA.url}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${webglComparisonSettings.webglZoom}) translate(${webglComparisonSettings.webglPanX * 50 / webglComparisonSettings.webglZoom}%, ${-webglComparisonSettings.webglPanY * 50 / webglComparisonSettings.webglZoom}%)`
            }}
            muted
            playsInline
            loop
            autoPlay
          />
        )}
        {mediaA?.type === 'image' && (
          <img
            src={mediaA.url}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${webglComparisonSettings.webglZoom}) translate(${webglComparisonSettings.webglPanX * 50 / webglComparisonSettings.webglZoom}%, ${-webglComparisonSettings.webglPanY * 50 / webglComparisonSettings.webglZoom}%)`
            }}
            alt="Source A"
          />
        )}
        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 text-xs text-gray-300 rounded">
          Source A
        </div>
      </div>

      {/* Left Divider */}
      <div
        className="w-1 bg-gray-700 hover:bg-[#ff5722] cursor-col-resize flex items-center justify-center group"
        onMouseDown={() => setIsDraggingLeft(true)}
      >
        <GripVertical size={12} className="text-gray-500 group-hover:text-white" />
      </div>

      {/* Analysis Center Panel */}
      <div
        className="relative bg-black flex items-center justify-center overflow-hidden"
        style={{ width: `${centerWidth}%` }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{
            transform: `scale(${webglComparisonSettings.webglZoom}) translate(${webglComparisonSettings.webglPanX * 50 / webglComparisonSettings.webglZoom}%, ${-webglComparisonSettings.webglPanY * 50 / webglComparisonSettings.webglZoom}%)`
          }}
        />
        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 text-xs rounded">
          <span className="text-gray-400">Analysis: </span>
          <span className="text-[#cddc39]">{modeInfo?.label || webglComparisonSettings.mode}</span>
        </div>
      </div>

      {/* Right Divider */}
      <div
        className="w-1 bg-gray-700 hover:bg-[#ff5722] cursor-col-resize flex items-center justify-center group"
        onMouseDown={() => setIsDraggingRight(true)}
      >
        <GripVertical size={12} className="text-gray-500 group-hover:text-white" />
      </div>

      {/* Source B Panel */}
      <div
        className="relative bg-black flex items-center justify-center overflow-hidden"
        style={{ width: `${rightWidth}%` }}
      >
        {mediaB?.type === 'video' && (
          <video
            src={mediaB.url}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${webglComparisonSettings.webglZoom}) translate(${webglComparisonSettings.webglPanX * 50 / webglComparisonSettings.webglZoom}%, ${-webglComparisonSettings.webglPanY * 50 / webglComparisonSettings.webglZoom}%)`
            }}
            muted
            playsInline
            loop
            autoPlay
          />
        )}
        {mediaB?.type === 'image' && (
          <img
            src={mediaB.url}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${webglComparisonSettings.webglZoom}) translate(${webglComparisonSettings.webglPanX * 50 / webglComparisonSettings.webglZoom}%, ${-webglComparisonSettings.webglPanY * 50 / webglComparisonSettings.webglZoom}%)`
            }}
            alt="Source B"
          />
        )}
        <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 text-xs text-gray-300 rounded">
          Source B
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onToggle}
        className="absolute top-2 right-2 p-2 bg-black/70 rounded text-gray-400 hover:text-white transition-colors z-10"
        title="Exit Split View"
      >
        <Minimize2 size={16} />
      </button>
    </div>
  )
}

// Toggle button component
export function SplitViewToggle({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-colors ${isActive ? 'bg-[#ff5722] text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
      title="Split View: A | Analysis | B (WEBGL-011)"
    >
      <Maximize2 size={16} />
    </button>
  )
}
