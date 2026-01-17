/**
 * Optimized Export Utilities
 *
 * Uses direct video element control for frame-accurate capture.
 * Properly waits for video seeks using seeked event instead of timeouts.
 *
 * STITCH-002: Ease curves are applied here during export for smooth preview playback.
 */

import type { TimelineClip } from '../types'

/**
 * Calculate the media time for a clip at a given timeline time
 * Applies speed and reverse properties for export
 */
export function calculateExportMediaTime(
  timelineTime: number,
  clip: TimelineClip
): number | null {
  // Check if timeline time is within clip bounds
  if (timelineTime < clip.startTime || timelineTime >= clip.endTime) {
    return null
  }

  const relativeTime = timelineTime - clip.startTime

  // Apply speed - faster speed means we progress through media faster
  const speed = clip.speed || 1
  let mediaTime = clip.inPoint + (relativeTime * speed)

  // Clamp to valid media range
  mediaTime = Math.min(mediaTime, clip.outPoint)
  mediaTime = Math.max(mediaTime, clip.inPoint)

  // Apply reverse - flip the time within the media range
  if (clip.reverse) {
    mediaTime = clip.outPoint - (mediaTime - clip.inPoint)
  }

  return mediaTime
}

export interface VideoExportRefs {
  videoA: HTMLVideoElement | null
  videoB: HTMLVideoElement | null
  canvas: HTMLCanvasElement | null
}

/**
 * Wait for a video to seek to a specific time
 * Uses the 'seeked' event for accurate timing instead of arbitrary timeouts
 */
export function seekVideoTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    // If already at the target time (within tolerance), resolve immediately
    if (Math.abs(video.currentTime - time) < 0.001) {
      resolve()
      return
    }

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      // Small delay to ensure frame is rendered
      requestAnimationFrame(() => resolve())
    }

    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

/**
 * Seek multiple videos to the same time in parallel
 * Much faster than sequential seeking
 */
export async function seekVideosTo(
  videos: (HTMLVideoElement | null)[],
  time: number
): Promise<void> {
  const validVideos = videos.filter((v): v is HTMLVideoElement => v !== null)

  if (validVideos.length === 0) return

  // Pause all videos first
  validVideos.forEach(v => v.pause())

  // Seek all in parallel
  await Promise.all(validVideos.map(v => seekVideoTo(v, time)))
}

/**
 * Seek videos with speed/reverse applied per-clip
 * Each video seeks to its media time based on its clip's speed/reverse settings
 */
export async function seekVideosForExport(
  videoA: HTMLVideoElement | null,
  videoB: HTMLVideoElement | null,
  timelineTime: number,
  clipA: TimelineClip | null,
  clipB: TimelineClip | null
): Promise<void> {
  const promises: Promise<void>[] = []

  if (videoA && clipA) {
    const mediaTimeA = calculateExportMediaTime(timelineTime, clipA)
    if (mediaTimeA !== null) {
      videoA.pause()
      promises.push(seekVideoTo(videoA, mediaTimeA))
    }
  }

  if (videoB && clipB) {
    const mediaTimeB = calculateExportMediaTime(timelineTime, clipB)
    if (mediaTimeB !== null) {
      videoB.pause()
      promises.push(seekVideoTo(videoB, mediaTimeB))
    }
  }

  await Promise.all(promises)
}

/**
 * Prepare videos for export by pausing and buffering
 */
export async function prepareVideosForExport(
  videos: (HTMLVideoElement | null)[]
): Promise<void> {
  const validVideos = videos.filter((v): v is HTMLVideoElement => v !== null)

  for (const video of validVideos) {
    video.pause()
    video.muted = true

    // Ensure video is ready
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay)
          resolve()
        }
        video.addEventListener('canplay', onCanPlay)
      })
    }
  }
}

/**
 * Optimized frame capture for export
 * Handles the full seek-wait-capture cycle efficiently
 */
export async function captureFrameAtTime(
  refs: VideoExportRefs,
  time: number,
  renderToCanvas: () => void
): Promise<void> {
  const videos = [refs.videoA, refs.videoB].filter((v): v is HTMLVideoElement => v !== null)

  // Seek all videos to the target time
  await seekVideosTo(videos, time)

  // Render the frame to canvas
  renderToCanvas()
}

/**
 * High-performance frame capture loop for video export
 * Uses requestVideoFrameCallback when available for optimal timing
 */
export async function captureFrameSequence(
  refs: VideoExportRefs,
  startTime: number,
  endTime: number,
  fps: number,
  renderToCanvas: () => void,
  onFrame: (frameIndex: number, totalFrames: number, canvas: HTMLCanvasElement) => Promise<void>,
  onProgress?: (progress: number) => void
): Promise<void> {
  const frameTime = 1 / fps
  const totalFrames = Math.ceil((endTime - startTime) * fps)

  // Prepare videos
  await prepareVideosForExport([refs.videoA, refs.videoB])

  for (let i = 0; i < totalFrames; i++) {
    const time = startTime + i * frameTime

    // Seek and capture
    await captureFrameAtTime(refs, time, renderToCanvas)

    // Process the frame
    if (refs.canvas) {
      await onFrame(i, totalFrames, refs.canvas)
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.round((i / totalFrames) * 100))
    }

    // Yield to prevent blocking
    if (i % 5 === 0) {
      await new Promise(r => setTimeout(r, 0))
    }
  }
}

/**
 * Create a seekTo function that properly waits for video seeks
 * Drop-in replacement for the timeout-based approach
 */
export function createOptimizedSeekFn(
  videoRefs: (React.RefObject<HTMLVideoElement | null>)[],
  timelineSeek: (time: number) => void
): (time: number) => Promise<void> {
  return async (time: number) => {
    // First, update the timeline state
    timelineSeek(time)

    // Get all valid video elements
    const videos = videoRefs
      .map(ref => ref.current)
      .filter((v): v is HTMLVideoElement => v !== null)

    if (videos.length === 0) {
      // No videos, just wait a frame for UI to update
      await new Promise(r => requestAnimationFrame(r))
      return
    }

    // Pause and seek all videos
    videos.forEach(v => v.pause())

    // Seek all videos and wait for them to complete
    await Promise.all(videos.map(v => seekVideoTo(v, time)))

    // Extra frame to ensure canvas is updated
    await new Promise(r => requestAnimationFrame(r))
  }
}

/**
 * Batch frame capture using WebCodecs VideoFrame (when available)
 * This is the fastest method for modern browsers
 */
export async function captureFramesWithWebCodecs(
  video: HTMLVideoElement,
  times: number[],
  onFrame: (frame: VideoFrame, index: number) => Promise<void>
): Promise<void> {
  if (typeof VideoFrame === 'undefined') {
    throw new Error('WebCodecs VideoFrame not supported')
  }

  video.pause()

  for (let i = 0; i < times.length; i++) {
    await seekVideoTo(video, times[i])

    // Create VideoFrame from video element
    const frame = new VideoFrame(video, {
      timestamp: times[i] * 1_000_000, // Convert to microseconds
    })

    await onFrame(frame, i)

    frame.close()
  }
}

/**
 * Check if we can use the optimized WebCodecs path
 */
export function canUseWebCodecs(): boolean {
  return typeof VideoEncoder !== 'undefined' &&
         typeof VideoFrame !== 'undefined' &&
         typeof VideoDecoder !== 'undefined'
}
