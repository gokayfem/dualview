/**
 * QuadComparison Component (MODE-001)
 * 4-way comparison in 2x2 grid with synchronized zoom/pan
 * Features:
 * - Compare 4 images/videos simultaneously
 * - Synchronized zoom and pan across all quadrants
 * - Click any quadrant to expand to full view
 * - Independent source selection per quadrant
 * - Labels showing source name in each quadrant
 */

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useProjectStore } from '../../stores/projectStore'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { Maximize2, Minimize2, Grid2X2, Upload } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDropZone } from '../../hooks/useDropZone'

interface QuadrantProps {
  index: number
  mediaId: string | null
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  transformStyle: React.CSSProperties
  zoom: number
  isHidden: boolean
}

function Quadrant({ index, mediaId, isExpanded, onExpand, onCollapse, transformStyle, zoom, isHidden }: QuadrantProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const { getFile } = useMediaStore()
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const dropZone = useDropZone({ trackType: index < 2 ? 'a' : 'b' })

  // Get media file
  const media = mediaId ? getFile(mediaId) : null

  // Determine which track/clip to sync with
  const trackType = index < 2 ? 'a' : 'b'
  const track = tracks.find(t => t.type === trackType)

  // Find clip that contains current time
  const activeClip = useMemo(() => {
    if (!track) return null
    return track.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime) || track.clips[0] || null
  }, [track, currentTime])

  // Sync video playback
  useOptimizedClipSync(videoRef, activeClip)

  // Labels for quadrants
  const labels = ['1', '2', '3', '4']
  const colors = ['#ff5722', '#cddc39', '#2196f3', '#9c27b0']

  if (isHidden) return null

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border bg-surface transition-all duration-300",
        isExpanded && "col-span-2 row-span-2",
        dropZone.isDragOver && "ring-2 ring-inset ring-accent bg-accent/10"
      )}
      {...dropZone.dropZoneProps}
    >
      <input
        ref={dropZone.fileInputRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={dropZone.handleFileInputChange}
      />

      <div className="w-full h-full" style={transformStyle}>
        {media ? (
          media.type === 'video' ? (
            <video
              ref={videoRef}
              src={media.url}
              className="w-full h-full object-contain"
              muted
              playsInline
              preload="auto"
            />
          ) : media.type === 'image' ? (
            <img
              ref={imgRef}
              src={media.url}
              className="w-full h-full object-contain"
              alt={`Quadrant ${index + 1}`}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              <span>Unsupported media type</span>
            </div>
          )
        ) : (
          <div className={cn(
            "w-full h-full flex flex-col items-center justify-center text-text-muted bg-surface gap-2",
            dropZone.isDragOver && "bg-accent/20 text-accent"
          )}>
            <button
              onClick={() => dropZone.openFileDialog()}
              className="p-3 rounded-lg border-2 border-dashed border-current hover:bg-accent/10 transition-colors"
            >
              <Upload className={cn("w-6 h-6", dropZone.isDragOver && "animate-bounce")} />
            </button>
            <span className="text-xs">Slot {index + 1}</span>
          </div>
        )}
      </div>

      {/* Quadrant label */}
      <div
        className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold text-white"
        style={{ backgroundColor: colors[index] + 'cc' }}
      >
        {labels[index]}
        {media && <span className="ml-1 font-normal opacity-80">- {media.name.slice(0, 15)}</span>}
      </div>

      {/* Expand/Collapse button */}
      <button
        onClick={isExpanded ? onCollapse : onExpand}
        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded transition-colors"
        title={isExpanded ? 'Collapse' : 'Expand to full view'}
      >
        {isExpanded ? (
          <Minimize2 className="w-4 h-4 text-white" />
        ) : (
          <Maximize2 className="w-4 h-4 text-white" />
        )}
      </button>

      {/* Zoom indicator */}
      {zoom > 1 && (
        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 text-xs text-white rounded">
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  )
}

export function QuadComparison() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { quadViewSettings, setQuadExpandedQuadrant, setQuadViewSettings } = useProjectStore()
  const { files } = useMediaStore()
  const { tracks } = useTimelineStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()

  // Get media from tracks for initial sources
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const clipA = trackA?.clips[0]
  const clipB = trackB?.clips[0]

  // Derive sources from either settings or tracks
  const sources = useMemo(() => {
    const result: (string | null)[] = [...quadViewSettings.sources]

    // If sources are empty, use track media
    if (!result[0] && clipA) result[0] = clipA.mediaId
    if (!result[1] && clipB) result[1] = clipB.mediaId

    return result as [string | null, string | null, string | null, string | null]
  }, [quadViewSettings.sources, clipA, clipB])

  const expandedQuadrant = quadViewSettings.expandedQuadrant

  const handleExpand = useCallback((index: number) => {
    setQuadExpandedQuadrant(index)
  }, [setQuadExpandedQuadrant])

  const handleCollapse = useCallback(() => {
    setQuadExpandedQuadrant(null)
  }, [setQuadExpandedQuadrant])

  // Handle number keys 1-4 to cycle sources for quadrants
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Check if number key 1-4 is pressed (for source cycling within quad view)
      const quadrantIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
      if (quadrantIndex !== -1 && e.shiftKey) {
        e.preventDefault()
        // Cycle through available media files for this quadrant
        const currentMediaId = sources[quadrantIndex]
        const availableMedia = files.filter(f => f.type === 'video' || f.type === 'image')
        if (availableMedia.length === 0) return

        const currentIndex = availableMedia.findIndex(m => m.id === currentMediaId)
        const nextIndex = (currentIndex + 1) % availableMedia.length
        const newSources = [...sources] as [string | null, string | null, string | null, string | null]
        newSources[quadrantIndex] = availableMedia[nextIndex]?.id || null
        setQuadViewSettings({ sources: newSources })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sources, files, setQuadViewSettings])

  const transformStyle = getTransformStyle()

  // If no media at all, show empty state
  const hasAnyMedia = sources.some(s => s !== null) || clipA || clipB

  if (!hasAnyMedia) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-center p-8">
          <Grid2X2 className="w-16 h-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-xl font-bold text-text-primary mb-2">Quad View</h3>
          <p className="text-text-muted mb-4">
            Compare up to 4 images or videos simultaneously in a 2x2 grid.
          </p>
          <p className="text-sm text-text-muted">
            Add media to tracks A and B, or drag files directly into quadrants.
          </p>
          <p className="text-xs text-text-muted mt-4">
            Tip: Hold Shift + 1-4 to cycle sources in each quadrant
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black relative"
      {...containerProps}
    >
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

      {/* 2x2 Grid */}
      <div className={cn(
        "w-full h-full grid gap-1",
        expandedQuadrant === null ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-2"
      )}>
        {sources.map((mediaId, index) => (
          <Quadrant
            key={index}
            index={index}
            mediaId={mediaId}
            isExpanded={expandedQuadrant === index}
            onExpand={() => handleExpand(index)}
            onCollapse={handleCollapse}
            transformStyle={transformStyle}
            zoom={zoom}
            isHidden={expandedQuadrant !== null && expandedQuadrant !== index}
          />
        ))}
      </div>

      {/* Mode indicator */}
      <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400">
        Quad View {expandedQuadrant !== null ? `- Quadrant ${expandedQuadrant + 1} Expanded` : '- 2x2 Grid'}
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400">
        Click expand icon to focus | Scroll to zoom | Shift+1-4 to cycle sources
      </div>
    </div>
  )
}
