import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { cn } from '../../lib/utils'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { useDropZone } from '../../hooks/useDropZone'
import { Upload } from 'lucide-react'

interface VideoBounds {
  left: number
  top: number
  width: number
  height: number
}

/**
 * SliderComparison - Performant video comparison slider
 *
 * Uses overflow:hidden technique instead of clipPath for better performance.
 * Based on: https://gist.github.com/CodeMyUI/34f82e50cde3c10fbf09e37a6fbf2fa5
 */
export function SliderComparison() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [videoBounds, setVideoBounds] = useState<VideoBounds | null>(null)

  const { sliderPosition, setSliderPosition, sliderOrientation, hideSlider, toggleHideSlider } = useProjectStore()
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()
  const dropZoneA = useDropZone({ trackType: 'a' })
  const dropZoneB = useDropZone({ trackType: 'b' })

  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)

  // Get tracks
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')

  // Get first clip for display (always show something)
  const firstClipA = trackA?.clips[0] || null
  const firstClipB = trackB?.clips[0] || null

  // Find clip that contains current time for proper sync
  const activeClipA = useMemo(() => {
    if (!trackA) return null
    return trackA.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackA, currentTime])

  const activeClipB = useMemo(() => {
    if (!trackB) return null
    return trackB.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackB, currentTime])

  // Use active clip's media for display (clip at current time), fallback to first clip
  const displayClipA = activeClipA || firstClipA
  const displayClipB = activeClipB || firstClipB
  const rawMediaA = displayClipA ? getFile(displayClipA.mediaId) : null
  const rawMediaB = displayClipB ? getFile(displayClipB.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null
  const mediaB = rawMediaB?.type === 'video' || rawMediaB?.type === 'image' ? rawMediaB : null

  // Use optimized clip-aware video sync (native playback with drift correction)
  useOptimizedClipSync(videoARef, activeClipA || firstClipA)
  useOptimizedClipSync(videoBRef, activeClipB || firstClipB)

  // Calculate video bounds within container (accounting for object-contain)
  const calculateVideoBounds = useCallback(() => {
    const container = containerRef.current
    const videoA = videoARef.current
    const videoB = videoBRef.current

    if (!container) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Get video dimensions - prefer actual video element dimensions, then media metadata
    // Use whichever video/media is available (A takes priority)
    let videoWidth = 0
    let videoHeight = 0

    // Try video A first
    if (videoA && videoA.videoWidth > 0) {
      videoWidth = videoA.videoWidth
      videoHeight = videoA.videoHeight
    } else if (mediaA?.width && mediaA?.height) {
      videoWidth = mediaA.width
      videoHeight = mediaA.height
    }
    // Fall back to video B if A not available
    else if (videoB && videoB.videoWidth > 0) {
      videoWidth = videoB.videoWidth
      videoHeight = videoB.videoHeight
    } else if (mediaB?.width && mediaB?.height) {
      videoWidth = mediaB.width
      videoHeight = mediaB.height
    }

    // If still no dimensions, use container aspect (neutral fallback)
    if (videoWidth === 0 || videoHeight === 0) {
      videoWidth = containerWidth
      videoHeight = containerHeight
    }

    const containerAspect = containerWidth / containerHeight
    const videoAspect = videoWidth / videoHeight

    let renderedWidth: number
    let renderedHeight: number

    if (videoAspect > containerAspect) {
      // Video is wider - letterbox top/bottom
      renderedWidth = containerWidth
      renderedHeight = containerWidth / videoAspect
    } else {
      // Video is taller - letterbox left/right
      renderedHeight = containerHeight
      renderedWidth = containerHeight * videoAspect
    }

    const left = (containerWidth - renderedWidth) / 2
    const top = (containerHeight - renderedHeight) / 2

    setVideoBounds({ left, top, width: renderedWidth, height: renderedHeight })
  }, [mediaA?.width, mediaA?.height, mediaB?.width, mediaB?.height])

  // Recalculate bounds on resize and when video loads
  useEffect(() => {
    calculateVideoBounds()

    // Use ResizeObserver for container size changes (timeline/sidebar toggle)
    const container = containerRef.current
    if (container) {
      const resizeObserver = new ResizeObserver(() => {
        calculateVideoBounds()
      })
      resizeObserver.observe(container)
      return () => resizeObserver.disconnect()
    }
  }, [calculateVideoBounds])

  // Recalculate when video metadata loads
  useEffect(() => {
    const videoA = videoARef.current
    const videoB = videoBRef.current

    const handleLoadedMetadata = () => calculateVideoBounds()

    videoA?.addEventListener('loadedmetadata', handleLoadedMetadata)
    videoB?.addEventListener('loadedmetadata', handleLoadedMetadata)

    return () => {
      videoA?.removeEventListener('loadedmetadata', handleLoadedMetadata)
      videoB?.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [calculateVideoBounds, mediaA, mediaB])

  // Handle touch events for mobile support
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current || !videoBounds) return
      e.preventDefault()

      const touch = e.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      let position: number

      if (sliderOrientation === 'vertical') {
        const x = touch.clientX - rect.left
        const relativeX = (x - videoBounds.left) / videoBounds.width
        position = relativeX * 100
      } else {
        const y = touch.clientY - rect.top
        const relativeY = (y - videoBounds.top) / videoBounds.height
        position = relativeY * 100
      }

      setSliderPosition(Math.max(0, Math.min(100, position)))
    },
    [sliderOrientation, setSliderPosition, videoBounds]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!containerRef.current || !videoBounds) return

      const rect = containerRef.current.getBoundingClientRect()
      let position: number

      if (sliderOrientation === 'vertical') {
        // Constrain to video bounds horizontally
        const x = e.clientX - rect.left
        const relativeX = (x - videoBounds.left) / videoBounds.width
        position = relativeX * 100
      } else {
        // Constrain to video bounds vertically
        const y = e.clientY - rect.top
        const relativeY = (y - videoBounds.top) / videoBounds.height
        position = relativeY * 100
      }

      setSliderPosition(Math.max(0, Math.min(100, position)))
    },
    [sliderOrientation, setSliderPosition, videoBounds]
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false)
    const handleTouchEnd = () => setIsDragging(false)
    const handleMove = (e: MouseEvent) => {
      if (isDragging) handleMouseMove(e)
    }
    const handleTouch = (e: TouchEvent) => {
      if (isDragging) handleTouchMove(e)
    }

    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchmove', handleTouch, { passive: false })

    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchmove', handleTouch)
    }
  }, [isDragging, handleMouseMove, handleTouchMove])

  const isVertical = sliderOrientation === 'vertical'
  const transformStyle = getTransformStyle()

  // Keyboard shortcut to toggle slider visibility (H key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        toggleHideSlider()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleHideSlider])

  // Calculate clipper dimensions based on slider position
  const clipperStyle = useMemo(() => {
    if (!videoBounds) return {}

    if (isVertical) {
      // Horizontal slider - clip from left
      return {
        position: 'absolute' as const,
        left: videoBounds.left,
        top: videoBounds.top,
        width: (sliderPosition / 100) * videoBounds.width,
        height: videoBounds.height,
        overflow: 'hidden' as const,
      }
    } else {
      // Vertical slider - clip from top
      return {
        position: 'absolute' as const,
        left: videoBounds.left,
        top: videoBounds.top,
        width: videoBounds.width,
        height: (sliderPosition / 100) * videoBounds.height,
        overflow: 'hidden' as const,
      }
    }
  }, [videoBounds, sliderPosition, isVertical])

  // Style for the media inside the clipper - needs to match the background position
  const clippedMediaStyle = useMemo(() => {
    if (!videoBounds) return {}

    return {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: videoBounds.width,
      height: videoBounds.height,
    }
  }, [videoBounds])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden select-none"
      onWheel={containerProps.onWheel}
    >
      {/* Zoom indicator (IMG-002) */}
      {zoom > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm px-3 py-1 flex items-center gap-2">
          <span className="text-xs text-text-primary font-medium">{Math.round(zoom * 100)}%</span>
          <button
            onClick={(e) => { e.stopPropagation(); resetZoom() }}
            className="text-[10px] text-text-muted hover:text-text-primary"
          >
            Reset
          </button>
        </div>
      )}

      {/* Video B (background layer) - full size */}
      {/* Show mediaB, or mediaA with low opacity if only A is uploaded */}
      {videoBounds && (
        <div
          className="absolute"
          style={{
            ...transformStyle,
            left: videoBounds.left,
            top: videoBounds.top,
            width: videoBounds.width,
            height: videoBounds.height,
            opacity: mediaB ? 1 : (mediaA ? 0.3 : 1),
          }}
        >
          {(mediaB || mediaA) ? (
            (mediaB || mediaA)!.type === 'video' ? (
              <video
                ref={videoBRef}
                src={(mediaB || mediaA)!.url}
                className="w-full h-full object-contain"
                data-track="b"
                muted
                playsInline
              />
            ) : (
              <img
                ref={imgBRef}
                src={(mediaB || mediaA)!.url}
                className="w-full h-full object-contain"
                alt="B"
                data-track="b"
                draggable={false}
              />
            )
          ) : null}
        </div>
      )}

      {/* Video A (clipped layer) - uses overflow:hidden for performance */}
      {/* Show mediaA, or mediaB with low opacity if only B is uploaded */}
      {videoBounds && (
        <div
          style={{
            ...clipperStyle,
            ...transformStyle,
            opacity: mediaA ? 1 : (mediaB ? 0.3 : 1),
          }}
        >
          <div style={clippedMediaStyle}>
            {(mediaA || mediaB) ? (
              (mediaA || mediaB)!.type === 'video' ? (
                <video
                  ref={videoARef}
                  src={(mediaA || mediaB)!.url}
                  className="w-full h-full object-contain"
                  data-track="a"
                  muted
                  playsInline
                />
              ) : (
                <img
                  ref={imgARef}
                  src={(mediaA || mediaB)!.url}
                  className="w-full h-full object-contain"
                  alt="A"
                  data-track="a"
                  draggable={false}
                />
              )
            ) : null}
          </div>
        </div>
      )}

      {/* Hidden file inputs for click-to-upload (supports multiple files) */}
      <input
        ref={dropZoneA.fileInputRef}
        type="file"
        accept="video/*,image/*,audio/*,.glb,.gltf"
        multiple
        className="hidden"
        onChange={dropZoneA.handleFileInputChange}
      />
      <input
        ref={dropZoneB.fileInputRef}
        type="file"
        accept="video/*,image/*,audio/*,.glb,.gltf"
        multiple
        className="hidden"
        onChange={dropZoneB.handleFileInputChange}
      />

      {/* Drop zones - shown when no media or dragging */}
      {(!mediaA || !mediaB || dropZoneA.isDragOver || dropZoneB.isDragOver) && (
        <div className="absolute inset-0 flex z-30 pointer-events-none">
          {/* Drop zone A (left half) - Bold empty state */}
          <div
            className={cn(
              "flex-1 flex flex-col items-center justify-center transition-all duration-300 pointer-events-auto relative overflow-hidden",
              !mediaA && "bg-surface",
              dropZoneA.isDragOver && "bg-accent/15 ring-2 ring-inset ring-accent"
            )}
            {...dropZoneA.dropZoneProps}
          >
            {(!mediaA || dropZoneA.isDragOver) && (
              <div className={cn(
                "flex flex-col items-center gap-4 text-center relative z-10",
                dropZoneA.isDragOver ? "text-accent scale-105" : "text-text-muted"
              )}>
                {/* Large A badge */}
                <div className={cn(
                  "w-16 h-16 flex items-center justify-center transition-all duration-300",
                  dropZoneA.isDragOver
                    ? "bg-accent text-white"
                    : "bg-accent/10 border border-accent/20"
                )}>
                  <span className={cn("text-2xl font-bold", dropZoneA.isDragOver ? "text-white" : "text-accent")}>A</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dropZoneA.openFileDialog() }}
                  className={cn(
                    "p-4 border border-dashed transition-all duration-200 group",
                    dropZoneA.isDragOver
                      ? "border-accent bg-accent/10"
                      : "border-text-muted/20 hover:border-accent/50"
                  )}
                >
                  <Upload className={cn(
                    "w-8 h-8 transition-transform",
                    dropZoneA.isDragOver ? "animate-bounce text-accent" : "group-hover:scale-105"
                  )} />
                </button>
                <div className="space-y-1">
                  <span className="text-base font-semibold block">
                    {mediaA ? "Replace Media A" : "Drop Media A"}
                  </span>
                  {!mediaA && (
                    <span className="text-sm text-text-muted/60 block">Before / Original</span>
                  )}
                  {!mediaA && (
                    <span className="text-xs text-text-muted/40 block mt-2">
                      Video, Image, or Audio
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider line */}
          {!mediaA && !mediaB && (
            <div className="w-px bg-border/50 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-background border border-border flex items-center justify-center">
                <span className="text-xs text-text-muted">VS</span>
              </div>
            </div>
          )}

          {/* Drop zone B (right half) - Bold empty state */}
          <div
            className={cn(
              "flex-1 flex flex-col items-center justify-center transition-all duration-300 pointer-events-auto relative overflow-hidden",
              !mediaB && "bg-surface/90",
              dropZoneB.isDragOver && "bg-secondary/15 ring-2 ring-inset ring-secondary"
            )}
            {...dropZoneB.dropZoneProps}
          >
            {(!mediaB || dropZoneB.isDragOver) && (
              <div className={cn(
                "flex flex-col items-center gap-4 text-center relative z-10",
                dropZoneB.isDragOver ? "text-secondary scale-105" : "text-text-muted"
              )}>
                {/* Large B badge */}
                <div className={cn(
                  "w-16 h-16 flex items-center justify-center transition-all duration-300",
                  dropZoneB.isDragOver
                    ? "bg-secondary text-black"
                    : "bg-secondary/10 border border-secondary/20"
                )}>
                  <span className={cn("text-2xl font-bold", dropZoneB.isDragOver ? "text-black" : "text-secondary")}>B</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dropZoneB.openFileDialog() }}
                  className={cn(
                    "p-4 border border-dashed transition-all duration-200 group",
                    dropZoneB.isDragOver
                      ? "border-secondary bg-secondary/10"
                      : "border-text-muted/20 hover:border-secondary/50"
                  )}
                >
                  <Upload className={cn(
                    "w-8 h-8 transition-transform",
                    dropZoneB.isDragOver ? "animate-bounce text-secondary" : "group-hover:scale-105"
                  )} />
                </button>
                <div className="space-y-1">
                  <span className="text-base font-semibold block">
                    {mediaB ? "Replace Media B" : "Drop Media B"}
                  </span>
                  {!mediaB && (
                    <span className="text-sm text-text-muted/60 block">After / Modified</span>
                  )}
                  {!mediaB && (
                    <span className="text-xs text-text-muted/40 block mt-2">
                      Video, Image, or Audio
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload buttons when media exists (shown in corners) */}
      {mediaA && mediaB && !dropZoneA.isDragOver && !dropZoneB.isDragOver && (
        <>
          {/* Upload button A (top-left) */}
          <button
            onClick={(e) => { e.stopPropagation(); dropZoneA.openFileDialog() }}
            className="absolute top-4 left-4 z-20 p-2 bg-black/60 hover:bg-accent/80 rounded-lg transition-colors group"
            title="Replace Media A"
          >
            <Upload className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </button>

          {/* Upload button B (top-right) */}
          <button
            onClick={(e) => { e.stopPropagation(); dropZoneB.openFileDialog() }}
            className="absolute top-4 right-4 z-20 p-2 bg-black/60 hover:bg-secondary/80 rounded-lg transition-colors group"
            title="Replace Media B"
          >
            <Upload className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </button>
        </>
      )}

      {/* A/B badges when media is loaded */}
      {mediaA && mediaB && videoBounds && (
        <>
          <div className="absolute bottom-4 left-4 z-20 px-2 py-0.5 bg-accent/80 text-white text-xs font-semibold">
            A
          </div>
          <div className="absolute bottom-4 right-4 z-20 px-2 py-0.5 bg-secondary/80 text-black text-xs font-semibold">
            B
          </div>
        </>
      )}

      {/* Slider handle - constrained to video bounds */}
      {videoBounds && !hideSlider && (
        <div
          className={cn(
            'absolute bg-lime-400 shadow-lg z-10',
            isVertical ? 'w-0.5 cursor-ew-resize' : 'h-0.5 cursor-ns-resize'
          )}
          style={
            isVertical
              ? {
                  left: videoBounds.left + (sliderPosition / 100) * videoBounds.width,
                  top: videoBounds.top,
                  height: videoBounds.height,
                  transform: 'translateX(-50%)',
                }
              : {
                  top: videoBounds.top + (sliderPosition / 100) * videoBounds.height,
                  left: videoBounds.left,
                  width: videoBounds.width,
                  transform: 'translateY(-50%)',
                }
          }
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Handle grip - compact but easy to drag */}
          <div
            className={cn(
              'absolute bg-lime-400 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing rounded-sm',
              isVertical
                ? 'w-3 h-8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'w-8 h-3 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
            )}
          >
            <div className={cn('flex gap-px', isVertical ? 'flex-row' : 'flex-col')}>
              <div className="w-px h-3 bg-black/30" />
              <div className="w-px h-3 bg-black/30" />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
