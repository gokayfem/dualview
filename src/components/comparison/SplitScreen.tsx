import { useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useSyncedZoom } from '../../hooks/useSyncedZoom'
import { cn } from '../../lib/utils'
import type { SplitLayout } from '../../types'

const layoutClasses: Record<SplitLayout, string> = {
  '2x1': 'grid-cols-2 grid-rows-1',
  '1x2': 'grid-cols-1 grid-rows-2',
  '2x2': 'grid-cols-2 grid-rows-2',
}

export function SplitScreen() {
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const videoCRef = useRef<HTMLVideoElement>(null)
  const videoDRef = useRef<HTMLVideoElement>(null)

  const { splitLayout } = useProjectStore()
  const { currentTime, isPlaying, tracks, playbackSpeed, loopRegion, seek } = useTimelineStore()
  const { getFile } = useMediaStore()
  const { zoom, resetZoom, getTransformStyle, containerProps } = useSyncedZoom()

  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const clipA = trackA?.clips[0]
  const clipB = trackB?.clips[0]
  // Only use video/image, not audio
  const rawMediaA = clipA ? getFile(clipA.mediaId) : null
  const rawMediaB = clipB ? getFile(clipB.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null
  const mediaB = rawMediaB?.type === 'video' || rawMediaB?.type === 'image' ? rawMediaB : null

  const slots = splitLayout === '2x2' ? 4 : 2
  const clipList = [clipA, clipB, null, null].slice(0, slots)
  const mediaList = [mediaA, mediaB, null, null].slice(0, slots)
  const videoRefs = [videoARef, videoBRef, videoCRef, videoDRef].slice(0, slots)

  // Calculate media time from timeline time based on clip's inPoint
  const getMediaTime = useCallback((timelineTime: number, clip: typeof clipA | null) => {
    if (!clip) return timelineTime
    const clipOffset = timelineTime - clip.startTime
    return clip.inPoint + clipOffset
  }, [])

  // Convert media time back to timeline time
  const getTimelineTimeFromA = useCallback((mediaTime: number) => {
    if (!clipA) return mediaTime
    return clipA.startTime + (mediaTime - clipA.inPoint)
  }, [clipA])

  // Apply playback speed (VID-002)
  useEffect(() => {
    videoRefs.forEach((ref) => {
      if (ref.current) ref.current.playbackRate = playbackSpeed
    })
  }, [playbackSpeed, videoRefs])

  // Handle loop region (VID-003)
  useEffect(() => {
    const videoA = videoARef.current
    if (!videoA || !isPlaying || !loopRegion) return

    const handleTimeUpdate = () => {
      const timelineTime = getTimelineTimeFromA(videoA.currentTime)
      if (timelineTime >= loopRegion.outPoint) {
        videoRefs.forEach((ref, index) => {
          if (ref.current) {
            ref.current.currentTime = getMediaTime(loopRegion.inPoint, clipList[index])
          }
        })
        seek(loopRegion.inPoint)
      }
    }

    videoA.addEventListener('timeupdate', handleTimeUpdate)
    return () => videoA.removeEventListener('timeupdate', handleTimeUpdate)
  }, [isPlaying, loopRegion, seek, videoRefs, getTimelineTimeFromA, getMediaTime, clipList])

  useEffect(() => {
    videoRefs.forEach((ref, index) => {
      const media = mediaList[index]
      const clip = clipList[index]
      if (ref.current && media?.type === 'video') {
        const mediaTime = getMediaTime(currentTime, clip)
        ref.current.currentTime = mediaTime
        if (isPlaying) {
          ref.current.play().catch(() => {})
        } else {
          ref.current.pause()
        }
      }
    })
  }, [currentTime, isPlaying, mediaList, videoRefs, getMediaTime, clipList])

  const transformStyle = getTransformStyle()

  return (
    <div className={cn('w-full h-full grid gap-1 bg-black relative', layoutClasses[splitLayout])} {...containerProps}>
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

      {mediaList.map((media, index) => (
        <div key={index} className="relative bg-surface overflow-hidden">
          <div className="w-full h-full" style={transformStyle}>
            {media ? (
              media.type === 'video' ? (
                <video
                  ref={videoRefs[index]}
                  src={media.url}
                  className="w-full h-full object-contain"
                  muted
                  playsInline
                  loop
                />
              ) : (
                <img src={media.url} className="w-full h-full object-contain" alt={`Slot ${index + 1}`} draggable={false} />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                <span>Slot {index + 1}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
