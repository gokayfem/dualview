/**
 * Video Sync Hooks
 *
 * UPDATED: Now uses native playback with drift correction for smooth performance.
 * Videos play natively and only sync when drift exceeds threshold.
 *
 * For the optimized implementation, see useOptimizedVideoSync.ts
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import type { TimelineClip } from '../types'

// Re-export optimized hooks for easy migration
export {
  useOptimizedClipSync,
  useOptimizedVideoSync,
  useOptimizedDualSync,
} from './useOptimizedVideoSync'

interface UseVideoSyncOptions {
  /** Offset in seconds to apply to the video */
  timeOffset?: number
  /** Whether this video should be muted */
  muted?: boolean
}

/**
 * Clip-Aware Video Sync Hook
 *
 * This hook properly syncs video to a clip's in-point/out-point,
 * handles visibility when playhead is outside clip bounds,
 * and maps timeline time to media time correctly.
 *
 * @returns isVisible - whether the video should be shown (playhead is within clip)
 */
export function useClipAwareVideoSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  clip: TimelineClip | null
): boolean {
  const [isVisible, setIsVisible] = useState(false)
  const lastSeekTime = useRef(0)
  const isSeekingRef = useRef(false)

  // Initialize video settings
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // CRITICAL: Videos should NOT autoplay - we control currentTime directly
    video.pause()
    video.muted = true
    video.preload = 'auto'
    video.playsInline = true

    // Set initial time based on clip
    if (clip) {
      const { currentTime } = usePlaybackStore.getState()
      const mediaTime = calculateMediaTime(currentTime, clip)
      if (mediaTime !== null) {
        video.currentTime = mediaTime
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    } else {
      setIsVisible(false)
    }
  }, [videoRef, clip?.id]) // Re-run when clip changes

  // Listen for playback-seek events - immediate response
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return

    const handleSeek = (e: CustomEvent<{ time: number }>) => {
      const timelineTime = e.detail.time
      const mediaTime = calculateMediaTime(timelineTime, clip)

      if (mediaTime !== null) {
        setIsVisible(true)
        if (Math.abs(video.currentTime - mediaTime) > 0.01) {
          isSeekingRef.current = true
          video.currentTime = mediaTime
          lastSeekTime.current = performance.now()

          video.onseeked = () => {
            isSeekingRef.current = false
          }
        }
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('playback-seek', handleSeek as EventListener)
    return () => window.removeEventListener('playback-seek', handleSeek as EventListener)
  }, [videoRef, clip])

  // Listen for playback-update events - continuous sync during playback
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return

    const handleUpdate = (e: CustomEvent<{ time: number; isPlaying: boolean }>) => {
      const { time: timelineTime, isPlaying } = e.detail
      const mediaTime = calculateMediaTime(timelineTime, clip)

      if (mediaTime === null) {
        // Playhead is outside clip bounds
        setIsVisible(false)
        return
      }

      setIsVisible(true)

      if (isPlaying) {
        // During playback: update currentTime directly
        const now = performance.now()
        if (!isSeekingRef.current && now - lastSeekTime.current > 16) {
          if (Math.abs(video.currentTime - mediaTime) > 0.02) {
            video.currentTime = mediaTime
          }
        }
      } else {
        // When paused, ensure we're at the exact frame
        video.pause()
        if (Math.abs(video.currentTime - mediaTime) > 0.01) {
          video.currentTime = mediaTime
        }
      }
    }

    window.addEventListener('playback-update', handleUpdate as EventListener)
    return () => window.removeEventListener('playback-update', handleUpdate as EventListener)
  }, [videoRef, clip])

  // Listen for playback-speed events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSpeed = (e: CustomEvent<{ speed: number }>) => {
      video.playbackRate = e.detail.speed
    }

    window.addEventListener('playback-speed', handleSpeed as EventListener)
    return () => window.removeEventListener('playback-speed', handleSpeed as EventListener)
  }, [videoRef])

  return isVisible
}

/**
 * Calculate the media time from timeline time based on clip boundaries
 * Returns null if timeline time is outside clip bounds
 *
 * Applies speed and reverse properties for real-time preview.
 * Note: Ease curves are applied only during export for performance.
 */
function calculateMediaTime(timelineTime: number, clip: TimelineClip): number | null {
  // Check if timeline time is within clip bounds
  if (timelineTime < clip.startTime || timelineTime >= clip.endTime) {
    return null
  }

  const relativeTime = timelineTime - clip.startTime

  // Apply speed - faster speed means we progress through media faster
  const speed = clip.speed || 1
  let mediaTime = clip.inPoint + (relativeTime * speed)

  // Clamp to valid media range (accounts for speed making us go past outPoint)
  mediaTime = Math.min(mediaTime, clip.outPoint)
  mediaTime = Math.max(mediaTime, clip.inPoint)

  // Apply reverse - flip the time within the media range
  if (clip.reverse) {
    mediaTime = clip.outPoint - (mediaTime - clip.inPoint)
  }

  return mediaTime
}

export function useVideoSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseVideoSyncOptions = {}
) {
  const { timeOffset = 0, muted = true } = options
  const lastSeekTime = useRef(0)
  const isSeekingRef = useRef(false)

  // Initialize video settings
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // CRITICAL: Videos should NOT autoplay - we control currentTime directly
    video.pause()
    video.muted = muted
    video.preload = 'auto'
    video.playsInline = true

    // Set initial time
    const { currentTime } = usePlaybackStore.getState()
    video.currentTime = Math.max(0, currentTime + timeOffset)
  }, [videoRef, timeOffset, muted])

  // Listen for playback-seek events - immediate response
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSeek = (e: CustomEvent<{ time: number }>) => {
      const targetTime = Math.max(0, e.detail.time + timeOffset)

      // Avoid redundant seeks
      if (Math.abs(video.currentTime - targetTime) > 0.01) {
        isSeekingRef.current = true
        video.currentTime = targetTime
        lastSeekTime.current = performance.now()

        // Reset seeking flag after video seeks
        video.onseeked = () => {
          isSeekingRef.current = false
        }
      }
    }

    window.addEventListener('playback-seek', handleSeek as EventListener)
    return () => window.removeEventListener('playback-seek', handleSeek as EventListener)
  }, [videoRef, timeOffset])

  // Listen for playback-update events - continuous sync during playback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleUpdate = (e: CustomEvent<{ time: number; isPlaying: boolean }>) => {
      const { time, isPlaying } = e.detail
      const targetTime = Math.max(0, time + timeOffset)

      if (isPlaying) {
        // During playback: update currentTime directly (don't use play())
        // This is the KEY optimization - we scrub through the video
        // at the rate determined by the RAF loop, not by the video's internal clock

        // Only update if not currently seeking and enough time has passed
        const now = performance.now()
        if (!isSeekingRef.current && now - lastSeekTime.current > 16) {
          // Small threshold to avoid micro-seeks
          if (Math.abs(video.currentTime - targetTime) > 0.02) {
            video.currentTime = targetTime
          }
        }
      } else {
        // When paused, ensure we're at the exact frame
        video.pause()
        if (Math.abs(video.currentTime - targetTime) > 0.01) {
          video.currentTime = targetTime
        }
      }
    }

    window.addEventListener('playback-update', handleUpdate as EventListener)
    return () => window.removeEventListener('playback-update', handleUpdate as EventListener)
  }, [videoRef, timeOffset])

  // Listen for playback-speed events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSpeed = (e: CustomEvent<{ speed: number }>) => {
      video.playbackRate = e.detail.speed
    }

    window.addEventListener('playback-speed', handleSpeed as EventListener)
    return () => window.removeEventListener('playback-speed', handleSpeed as EventListener)
  }, [videoRef])

  // Manual seek function
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return

    const targetTime = Math.max(0, time + timeOffset)
    video.currentTime = targetTime
    usePlaybackStore.getState().seek(time)
  }, [videoRef, timeOffset])

  return { seekTo }
}

/**
 * Dual Video Sync Hook - Optimized for comparison modes
 *
 * Both videos are controlled by the same RAF loop via events.
 * Neither video plays independently.
 */
export function useDualVideoSync(
  videoARef: React.RefObject<HTMLVideoElement | null>,
  videoBRef: React.RefObject<HTMLVideoElement | null>,
  options: { offsetA?: number; offsetB?: number } = {}
) {
  const { offsetA = 0, offsetB = 0 } = options

  const syncA = useVideoSync(videoARef, { timeOffset: offsetA })
  const syncB = useVideoSync(videoBRef, { timeOffset: offsetB })

  const seekBoth = useCallback((time: number) => {
    syncA.seekTo(time)
    syncB.seekTo(time)
  }, [syncA, syncB])

  return { seekBoth, seekA: syncA.seekTo, seekB: syncB.seekTo }
}

/**
 * High-performance video sync using requestVideoFrameCallback
 * Falls back to RAF-based sync on unsupported browsers
 */
export function useFrameAccurateVideoSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseVideoSyncOptions = {}
) {
  const { timeOffset = 0, muted = true } = options
  const rafIdRef = useRef<number | null>(null)
  const rvfcIdRef = useRef<number | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = muted
    video.preload = 'auto'
    video.playsInline = true

    // Check for requestVideoFrameCallback support
    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    if (hasRVFC) {
      // Use requestVideoFrameCallback for frame-accurate sync
      const onVideoFrame = (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
        const { currentTime: playbackTime, isPlaying } = usePlaybackStore.getState()

        if (isPlaying) {
          const targetTime = playbackTime + timeOffset
          // Sync if drift > 1 frame (assuming 30fps)
          if (Math.abs(metadata.mediaTime - targetTime) > 0.033) {
            video.currentTime = targetTime
          }
        }

        rvfcIdRef.current = video.requestVideoFrameCallback(onVideoFrame)
      }

      rvfcIdRef.current = video.requestVideoFrameCallback(onVideoFrame)
    }

    return () => {
      if (rvfcIdRef.current && hasRVFC) {
        video.cancelVideoFrameCallback(rvfcIdRef.current)
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [videoRef, timeOffset, muted])

  return useVideoSync(videoRef, options)
}
