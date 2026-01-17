/**
 * Optimized Video Sync Hook - Native Playback with Drift Correction
 *
 * KEY PRINCIPLES:
 * 1. Let videos play natively using video.play() - browser handles decoding efficiently
 * 2. Only intervene when drift exceeds threshold (smoother than constant currentTime updates)
 * 3. Use requestVideoFrameCallback for frame-accurate sync when available
 * 4. Master/slave pattern for multi-video sync
 */
import { useRef, useEffect, useCallback } from 'react'
import { usePlaybackStore } from '../stores/playbackStore'
import type { TimelineClip } from '../types'

// Drift threshold in seconds - only sync if videos drift more than this
const DRIFT_THRESHOLD = 0.05 // 50ms - good balance between smoothness and sync
const HARD_SYNC_THRESHOLD = 0.15 // 150ms - force immediate sync

interface SyncState {
  isPlaying: boolean
  lastSyncTime: number
  frameCallbackId: number | null
}

/**
 * Calculate media time from timeline time based on clip boundaries
 * Applies speed and reverse properties for real-time preview.
 * Note: Ease curves are applied only during export for performance.
 */
function calculateMediaTime(timelineTime: number, clip: TimelineClip): number | null {
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

/**
 * Get the effective playback rate for a clip
 */
function getEffectivePlaybackRate(clip: TimelineClip | null, baseSpeed: number): number {
  if (!clip) return baseSpeed
  const clipSpeed = clip.speed || 1
  // For reverse, we still use positive playback rate but calculate reversed time
  return baseSpeed * clipSpeed
}

/**
 * Optimized clip-aware video sync that uses native playback
 */
export function useOptimizedClipSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  clip: TimelineClip | null
): { isVisible: boolean } {
  const syncStateRef = useRef<SyncState>({
    isPlaying: false,
    lastSyncTime: 0,
    frameCallbackId: null,
  })
  const isVisibleRef = useRef(false)

  // Initialize video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    // Optimize for smooth playback
    video.disableRemotePlayback = true

    // Set initial position
    if (clip) {
      const { currentTime } = usePlaybackStore.getState()
      const mediaTime = calculateMediaTime(currentTime, clip)
      if (mediaTime !== null) {
        video.currentTime = mediaTime
        isVisibleRef.current = true
      }
    }
  }, [videoRef, clip?.id])

  // Frame-accurate sync using requestVideoFrameCallback
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return

    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    const checkAndSync = () => {
      const { currentTime: timelineTime, isPlaying, isExporting } = usePlaybackStore.getState()

      // Don't interfere during export - export controls videos directly
      if (isExporting) return

      const mediaTime = calculateMediaTime(timelineTime, clip)

      if (mediaTime === null) {
        // Outside clip bounds
        if (isVisibleRef.current) {
          video.pause()
          isVisibleRef.current = false
        }
        return
      }

      isVisibleRef.current = true
      const drift = Math.abs(video.currentTime - mediaTime)

      if (isPlaying) {
        // Handle playback state
        const baseSpeed = usePlaybackStore.getState().playbackSpeed
        const effectiveRate = getEffectivePlaybackRate(clip, baseSpeed)

        if (video.paused) {
          video.currentTime = mediaTime
          video.playbackRate = effectiveRate
          video.play().catch(() => {})
        } else if (drift > HARD_SYNC_THRESHOLD) {
          // Large drift - hard sync
          video.currentTime = mediaTime
          video.playbackRate = effectiveRate
        } else if (drift > DRIFT_THRESHOLD) {
          // Small drift - gentle correction using playbackRate
          // Speed up or slow down slightly to catch up
          const correction = video.currentTime < mediaTime ? 1.05 : 0.95
          video.playbackRate = effectiveRate * correction
          syncStateRef.current.lastSyncTime = performance.now()
        } else {
          // In sync - restore normal playback rate
          if (Math.abs(video.playbackRate - effectiveRate) > 0.01) {
            video.playbackRate = effectiveRate
          }
        }
      } else {
        // Paused - seek to exact position
        if (!video.paused) {
          video.pause()
        }
        if (drift > 0.01) {
          video.currentTime = mediaTime
        }
      }
    }

    if (hasRVFC) {
      // Use requestVideoFrameCallback for frame-accurate sync
      const onFrame = () => {
        checkAndSync()
        syncStateRef.current.frameCallbackId = video.requestVideoFrameCallback(onFrame)
      }
      syncStateRef.current.frameCallbackId = video.requestVideoFrameCallback(onFrame)

      return () => {
        if (syncStateRef.current.frameCallbackId !== null) {
          video.cancelVideoFrameCallback(syncStateRef.current.frameCallbackId)
        }
      }
    } else {
      // Fallback: use interval-based sync (less accurate but works everywhere)
      const intervalId = setInterval(checkAndSync, 33) // ~30fps check rate
      return () => clearInterval(intervalId)
    }
  }, [videoRef, clip])

  // Handle seek events - immediate response needed
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return

    const handleSeek = (e: CustomEvent<{ time: number }>) => {
      // Don't interfere during export
      if (usePlaybackStore.getState().isExporting) return

      const mediaTime = calculateMediaTime(e.detail.time, clip)
      if (mediaTime !== null) {
        video.currentTime = mediaTime
        isVisibleRef.current = true
      } else {
        isVisibleRef.current = false
      }
    }

    window.addEventListener('playback-seek', handleSeek as EventListener)
    return () => window.removeEventListener('playback-seek', handleSeek as EventListener)
  }, [videoRef, clip])

  // Handle play/pause events
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return

    const handleUpdate = (e: CustomEvent<{ time: number; isPlaying: boolean }>) => {
      // Don't interfere during export
      if (usePlaybackStore.getState().isExporting) return

      const { isPlaying } = e.detail
      const mediaTime = calculateMediaTime(e.detail.time, clip)

      if (mediaTime === null) {
        if (!video.paused) video.pause()
        isVisibleRef.current = false
        return
      }

      isVisibleRef.current = true

      if (isPlaying && video.paused) {
        video.currentTime = mediaTime
        video.play().catch(() => {})
      } else if (!isPlaying && !video.paused) {
        video.pause()
        video.currentTime = mediaTime
      }
    }

    window.addEventListener('playback-update', handleUpdate as EventListener)
    return () => window.removeEventListener('playback-update', handleUpdate as EventListener)
  }, [videoRef, clip])

  // Handle speed changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSpeed = (e: CustomEvent<{ speed: number }>) => {
      video.playbackRate = e.detail.speed
    }

    window.addEventListener('playback-speed', handleSpeed as EventListener)
    return () => window.removeEventListener('playback-speed', handleSpeed as EventListener)
  }, [videoRef])

  return { isVisible: isVisibleRef.current }
}

/**
 * Simple optimized video sync (no clip awareness)
 */
export function useOptimizedVideoSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: { timeOffset?: number; muted?: boolean } = {}
) {
  const { timeOffset = 0, muted = true } = options
  const syncStateRef = useRef<SyncState>({
    isPlaying: false,
    lastSyncTime: 0,
    frameCallbackId: null,
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = muted
    video.playsInline = true
    video.preload = 'auto'
    video.disableRemotePlayback = true

    const { currentTime } = usePlaybackStore.getState()
    video.currentTime = Math.max(0, currentTime + timeOffset)
  }, [videoRef, timeOffset, muted])

  // Frame-accurate sync
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    const checkAndSync = () => {
      const { currentTime, isPlaying, playbackSpeed, isExporting } = usePlaybackStore.getState()

      // Don't interfere during export
      if (isExporting) return

      const targetTime = Math.max(0, currentTime + timeOffset)
      const drift = Math.abs(video.currentTime - targetTime)

      if (isPlaying) {
        if (video.paused) {
          video.currentTime = targetTime
          video.play().catch(() => {})
        } else if (drift > HARD_SYNC_THRESHOLD) {
          video.currentTime = targetTime
        } else if (drift > DRIFT_THRESHOLD) {
          const correction = video.currentTime < targetTime ? 1.05 : 0.95
          video.playbackRate = playbackSpeed * correction
        } else {
          if (Math.abs(video.playbackRate - playbackSpeed) > 0.01) {
            video.playbackRate = playbackSpeed
          }
        }
      } else {
        if (!video.paused) video.pause()
        if (drift > 0.01) video.currentTime = targetTime
      }
    }

    if (hasRVFC) {
      const onFrame = () => {
        checkAndSync()
        syncStateRef.current.frameCallbackId = video.requestVideoFrameCallback(onFrame)
      }
      syncStateRef.current.frameCallbackId = video.requestVideoFrameCallback(onFrame)

      return () => {
        if (syncStateRef.current.frameCallbackId !== null) {
          video.cancelVideoFrameCallback(syncStateRef.current.frameCallbackId)
        }
      }
    } else {
      const intervalId = setInterval(checkAndSync, 33)
      return () => clearInterval(intervalId)
    }
  }, [videoRef, timeOffset])

  // Handle seek
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSeek = (e: CustomEvent<{ time: number }>) => {
      // Don't interfere during export
      if (usePlaybackStore.getState().isExporting) return
      video.currentTime = Math.max(0, e.detail.time + timeOffset)
    }

    window.addEventListener('playback-seek', handleSeek as EventListener)
    return () => window.removeEventListener('playback-seek', handleSeek as EventListener)
  }, [videoRef, timeOffset])

  // Handle play/pause
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleUpdate = (e: CustomEvent<{ time: number; isPlaying: boolean }>) => {
      // Don't interfere during export
      if (usePlaybackStore.getState().isExporting) return

      const { time, isPlaying } = e.detail
      const targetTime = Math.max(0, time + timeOffset)

      if (isPlaying && video.paused) {
        video.currentTime = targetTime
        video.play().catch(() => {})
      } else if (!isPlaying && !video.paused) {
        video.pause()
        video.currentTime = targetTime
      }
    }

    window.addEventListener('playback-update', handleUpdate as EventListener)
    return () => window.removeEventListener('playback-update', handleUpdate as EventListener)
  }, [videoRef, timeOffset])

  // Handle speed
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleSpeed = (e: CustomEvent<{ speed: number }>) => {
      video.playbackRate = e.detail.speed
    }

    window.addEventListener('playback-speed', handleSpeed as EventListener)
    return () => window.removeEventListener('playback-speed', handleSpeed as EventListener)
  }, [videoRef])

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, time + timeOffset)
    usePlaybackStore.getState().seek(time)
  }, [videoRef, timeOffset])

  return { seekTo }
}

/**
 * Dual video sync with master/slave pattern
 * Video A is master, Video B syncs to it
 */
export function useOptimizedDualSync(
  videoARef: React.RefObject<HTMLVideoElement | null>,
  videoBRef: React.RefObject<HTMLVideoElement | null>
) {
  const syncA = useOptimizedVideoSync(videoARef, { timeOffset: 0 })
  const syncB = useOptimizedVideoSync(videoBRef, { timeOffset: 0 })

  // Additional master/slave sync - B follows A
  useEffect(() => {
    const videoA = videoARef.current
    const videoB = videoBRef.current
    if (!videoA || !videoB) return

    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
    let frameId: number | null = null

    const syncBToA = () => {
      if (!videoA.paused && !videoB.paused) {
        const drift = Math.abs(videoA.currentTime - videoB.currentTime)
        if (drift > DRIFT_THRESHOLD) {
          // B drifted from A - correct it
          if (drift > HARD_SYNC_THRESHOLD) {
            videoB.currentTime = videoA.currentTime
          } else {
            // Gentle correction
            const correction = videoB.currentTime < videoA.currentTime ? 1.03 : 0.97
            videoB.playbackRate = videoA.playbackRate * correction
          }
        } else {
          // In sync
          if (Math.abs(videoB.playbackRate - videoA.playbackRate) > 0.01) {
            videoB.playbackRate = videoA.playbackRate
          }
        }
      }
    }

    if (hasRVFC) {
      const onFrame = () => {
        syncBToA()
        frameId = videoA.requestVideoFrameCallback(onFrame)
      }
      frameId = videoA.requestVideoFrameCallback(onFrame)

      return () => {
        if (frameId !== null) {
          videoA.cancelVideoFrameCallback(frameId)
        }
      }
    } else {
      const intervalId = setInterval(syncBToA, 50)
      return () => clearInterval(intervalId)
    }
  }, [videoARef, videoBRef])

  const seekBoth = useCallback((time: number) => {
    syncA.seekTo(time)
    syncB.seekTo(time)
  }, [syncA, syncB])

  return { seekBoth, seekA: syncA.seekTo, seekB: syncB.seekTo }
}
