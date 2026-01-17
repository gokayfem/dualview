/**
 * IMG-001: Flicker Comparison Mode
 * Alternates between images/videos A and B for spotting differences
 */
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import { cn } from '../../lib/utils'

export function FlickerComparison() {
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const [showA, setShowA] = useState(true)
  const [flickerSpeed, setFlickerSpeed] = useState(500) // ms
  const [autoFlicker, setAutoFlicker] = useState(true)

  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()

  // Get tracks
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')

  // Get first clip for display
  const firstClipA = trackA?.clips[0] || null
  const firstClipB = trackB?.clips[0] || null

  // Find clip that contains current time
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

  // Toggle manually
  const toggle = useCallback(() => {
    setShowA(prev => !prev)
  }, [])

  // Auto flicker
  useEffect(() => {
    if (!autoFlicker) return

    const interval = setInterval(toggle, flickerSpeed)
    return () => clearInterval(interval)
  }, [autoFlicker, flickerSpeed, toggle])

  // Keyboard shortcuts (F or Tab to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'f' || e.key === 'F' || e.key === 'Tab') {
        e.preventDefault()
        toggle()
        // Pause auto flicker when manually toggling
        setAutoFlicker(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  // Video sync is now handled by useClipAwareVideoSync hook

  const transformStyle = getTransformStyle()

  const renderMedia = (media: typeof mediaA, ref: React.RefObject<HTMLVideoElement | null>, track: 'a' | 'b') => {
    if (!media) {
      return (
        <div className="w-full h-full flex items-center justify-center text-text-muted bg-surface">
          <span>Drop media here</span>
        </div>
      )
    }

    if (media.type === 'video') {
      return (
        <video
          ref={ref}
          src={media.url}
          className="w-full h-full object-contain"
          data-track={track}
          muted
          playsInline
        />
      )
    }

    return (
      <img src={media.url} className="w-full h-full object-contain" alt="" data-track={track} draggable={false} />
    )
  }

  return (
    <div className="relative w-full h-full bg-black" {...containerProps}>
      {/* Zoom indicator (IMG-002) */}
      {zoom > 1 && (
        <div className="absolute top-4 right-4 z-20 bg-black/70 backdrop-blur-sm px-3 py-1 flex items-center gap-2">
          <span className="text-xs text-text-primary font-medium">{Math.round(zoom * 100)}%</span>
          <button
            onClick={(e) => { e.stopPropagation(); resetZoom() }}
            className="text-[10px] text-text-muted hover:text-text-primary"
          >
            Reset
          </button>
        </div>
      )}

      {/* Layer A */}
      <div className={cn(
        'absolute inset-0 transition-opacity duration-75 overflow-hidden',
        showA ? 'opacity-100' : 'opacity-0'
      )}>
        <div className="w-full h-full" style={transformStyle}>
          {renderMedia(mediaA, videoARef, 'a')}
        </div>
      </div>

      {/* Layer B */}
      <div className={cn(
        'absolute inset-0 transition-opacity duration-75 overflow-hidden',
        showA ? 'opacity-0' : 'opacity-100'
      )}>
        <div className="w-full h-full" style={transformStyle}>
          {renderMedia(mediaB, videoBRef, 'b')}
        </div>
      </div>


      {/* Controls */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm p-3 space-y-2 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoFlicker(prev => !prev)}
            className={cn(
              'px-2 py-1 text-xs transition-colors',
              autoFlicker ? 'bg-accent text-white' : 'bg-surface text-text-primary hover:bg-surface-hover'
            )}
          >
            {autoFlicker ? 'Auto' : 'Manual'}
          </button>
          <button
            onClick={toggle}
            className="px-2 py-1 text-xs bg-surface text-text-primary hover:bg-surface-hover"
            title="Toggle (F or Tab)"
          >
            Toggle
          </button>
        </div>

        {autoFlicker && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Speed:</span>
            {[250, 500, 1000, 2000].map(speed => (
              <button
                key={speed}
                onClick={() => setFlickerSpeed(speed)}
                className={cn(
                  'px-1.5 py-0.5 text-[10px] transition-colors',
                  flickerSpeed === speed
                    ? 'bg-accent text-white'
                    : 'bg-surface/50 text-text-muted hover:text-text-primary'
                )}
              >
                {speed}ms
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-4 right-4 text-[10px] text-text-muted bg-black/40 px-2 py-1 z-10">
        Press F or Tab to toggle
      </div>
    </div>
  )
}
