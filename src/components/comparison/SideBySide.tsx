import { useRef, useEffect, useMemo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useProjectStore } from '../../stores/projectStore'
import { calculateVideoMetrics } from '../../lib/metrics'
import { MetricsOverlay } from './MetricsOverlay'
import { PixelInspector } from './PixelInspector'
import { MagnifierLoupe, useMagnifier } from './MagnifierLoupe'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { usePixelInspector } from '../../hooks/usePixelInspector'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { useDropZone } from '../../hooks/useDropZone'
import { cn } from '../../lib/utils'
import { Upload } from 'lucide-react'

export function SideBySide() {
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()
  const { showMetrics, setMetrics } = useProjectStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()
  const { pixelInspectorEnabled, handlePixelClick } = usePixelInspector()
  const magnifier = useMagnifier()
  const dropZoneA = useDropZone({ trackType: 'a' })
  const dropZoneB = useDropZone({ trackType: 'b' })

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
  // Pass the active clip (or first clip as fallback) for sync
  useOptimizedClipSync(videoARef, activeClipA || firstClipA)
  useOptimizedClipSync(videoBRef, activeClipB || firstClipB)

  // Calculate quality metrics (VID-004)
  useEffect(() => {
    if (!showMetrics) return

    const videoA = videoARef.current
    const videoB = videoBRef.current
    if (!videoA || !videoB) return

    const updateMetrics = () => {
      const metrics = calculateVideoMetrics(videoA, videoB)
      if (metrics) {
        setMetrics(metrics.ssim, metrics.psnr)
      }
    }

    // Update metrics periodically
    const interval = setInterval(updateMetrics, 500)
    updateMetrics()

    return () => clearInterval(interval)
  }, [showMetrics, setMetrics])

  const transformStyle = getTransformStyle()

  // Refs for magnifier
  const sourceARef = mediaA?.type === 'video' ? videoARef : imgARef
  const sourceBRef = mediaB?.type === 'video' ? videoBRef : imgBRef

  return (
    <div ref={containerRef} className="w-full h-full flex bg-black relative" {...containerProps}>
      {/* Hidden file inputs for click-to-upload */}
      <input
        ref={dropZoneA.fileInputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        className="hidden"
        onChange={dropZoneA.handleFileInputChange}
      />
      <input
        ref={dropZoneB.fileInputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        className="hidden"
        onChange={dropZoneB.handleFileInputChange}
      />

      {/* Quality Metrics Overlay */}
      <MetricsOverlay />

      {/* Pixel Inspector */}
      <PixelInspector />

      {/* Magnifier Loupe */}
      <MagnifierLoupe
        sourceARef={sourceARef as React.RefObject<HTMLImageElement | HTMLVideoElement | null>}
        sourceBRef={sourceBRef as React.RefObject<HTMLImageElement | HTMLVideoElement | null>}
        containerRef={containerRef}
        isEnabled={magnifier.isEnabled}
        onToggle={magnifier.toggle}
      />

      {/* Zoom indicator */}
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

      {/* Video A */}
      <div
        className={cn(
          "flex-1 relative border-r border-border overflow-hidden transition-all duration-200",
          dropZoneA.isDragOver && "ring-2 ring-inset ring-accent bg-accent/10"
        )}
        {...dropZoneA.dropZoneProps}
      >
        <div className="w-full h-full" style={transformStyle}>
          {mediaA ? (
            mediaA.type === 'video' ? (
              <video
                ref={videoARef}
                src={mediaA.url}
                className="w-full h-full object-contain"
                data-track="a"
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, videoARef.current, 'a')}
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <img
                ref={imgARef}
                src={mediaA.url}
                className="w-full h-full object-contain"
                alt="A"
                data-track="a"
                draggable={false}
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, imgARef.current, 'a')}
              />
            )
          ) : (
            <div className={cn(
              "w-full h-full flex flex-col items-center justify-center text-text-muted bg-surface gap-3 transition-colors",
              dropZoneA.isDragOver && "bg-accent/20 text-accent"
            )}>
              <button
                onClick={() => dropZoneA.openFileDialog()}
                className="p-4 rounded-lg border-2 border-dashed border-current hover:bg-accent/10 transition-colors"
              >
                <Upload className={cn("w-8 h-8", dropZoneA.isDragOver && "animate-bounce")} />
              </button>
              <span className="text-sm">Click or drop Media A</span>
            </div>
          )}
        </div>
        {/* A badge - always visible when media loaded */}
        {mediaA && (
          <div className="absolute bottom-3 left-3 z-20 px-2 py-0.5 bg-accent/80 text-white text-xs font-semibold">
            A
          </div>
        )}
        {/* Upload button when has media */}
        {mediaA && !dropZoneA.isDragOver && (
          <button
            onClick={() => dropZoneA.openFileDialog()}
            className="absolute top-2 left-2 z-20 p-2 bg-black/60 hover:bg-accent/80 rounded-lg transition-colors group"
            title="Replace Media A"
          >
            <Upload className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          </button>
        )}
        {/* Drop overlay when has media */}
        {mediaA && dropZoneA.isDragOver && (
          <div className="absolute inset-0 bg-accent/20 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-black/80 px-4 py-2 rounded-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-accent" />
              <span className="text-accent font-medium">Replace Media A</span>
            </div>
          </div>
        )}
      </div>

      {/* Video B */}
      <div
        className={cn(
          "flex-1 relative overflow-hidden transition-all duration-200",
          dropZoneB.isDragOver && "ring-2 ring-inset ring-secondary bg-secondary/10"
        )}
        {...dropZoneB.dropZoneProps}
      >
        <div className="w-full h-full" style={transformStyle}>
          {mediaB ? (
            mediaB.type === 'video' ? (
              <video
                ref={videoBRef}
                src={mediaB.url}
                className="w-full h-full object-contain"
                data-track="b"
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, videoBRef.current, 'b')}
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <img
                ref={imgBRef}
                src={mediaB.url}
                className="w-full h-full object-contain"
                alt="B"
                data-track="b"
                draggable={false}
                style={pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined}
                onClick={(e) => handlePixelClick(e, imgBRef.current, 'b')}
              />
            )
          ) : (
            <div className={cn(
              "w-full h-full flex flex-col items-center justify-center text-text-muted bg-surface gap-3 transition-colors",
              dropZoneB.isDragOver && "bg-secondary/20 text-secondary"
            )}>
              <button
                onClick={() => dropZoneB.openFileDialog()}
                className="p-4 rounded-lg border-2 border-dashed border-current hover:bg-secondary/10 transition-colors"
              >
                <Upload className={cn("w-8 h-8", dropZoneB.isDragOver && "animate-bounce")} />
              </button>
              <span className="text-sm">Click or drop Media B</span>
            </div>
          )}
        </div>
        {/* B badge - always visible when media loaded */}
        {mediaB && (
          <div className="absolute bottom-3 right-3 z-20 px-2 py-0.5 bg-secondary/80 text-black text-xs font-semibold">
            B
          </div>
        )}
        {/* Upload button when has media */}
        {mediaB && !dropZoneB.isDragOver && (
          <button
            onClick={() => dropZoneB.openFileDialog()}
            className="absolute top-2 right-2 z-20 p-2 bg-black/60 hover:bg-secondary/80 rounded-lg transition-colors group"
            title="Replace Media B"
          >
            <Upload className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          </button>
        )}
        {/* Drop overlay when has media */}
        {mediaB && dropZoneB.isDragOver && (
          <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-black/80 px-4 py-2 rounded-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-secondary" />
              <span className="text-secondary font-medium">Replace Media B</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
