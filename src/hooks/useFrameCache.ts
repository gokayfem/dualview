/**
 * Frame Cache Hook (OpenCut Pattern)
 *
 * Caches rendered frames for smooth scrubbing performance.
 * Uses LRU eviction when cache is full.
 */

// Global frame cache - shared across all instances
const frameCache = new Map<string, ImageData>()
const MAX_CACHE_SIZE = 200 // Maximum cached frames
const FRAME_BUCKET_FPS = 30 // Bucket frames to 30fps intervals

interface CacheStats {
  size: number
  maxSize: number
  hitRate: number
}

let cacheHits = 0
let cacheMisses = 0

/**
 * Generate a cache key for a specific time and content hash
 */
function getCacheKey(time: number, contentHash: string): string {
  // Round time to nearest frame bucket (30fps)
  const bucketTime = Math.floor(time * FRAME_BUCKET_FPS) / FRAME_BUCKET_FPS
  return `${bucketTime.toFixed(4)}-${contentHash}`
}

/**
 * LRU eviction - remove oldest entries when cache is full
 */
function evictOldestFrames(count: number = 30): void {
  if (frameCache.size < MAX_CACHE_SIZE) return

  const keysToDelete = Array.from(frameCache.keys()).slice(0, count)
  keysToDelete.forEach(key => frameCache.delete(key))
}

/**
 * Clear all cached frames
 */
export function clearFrameCache(): void {
  frameCache.clear()
  cacheHits = 0
  cacheMisses = 0
}

/**
 * Get cache statistics
 */
export function getFrameCacheStats(): CacheStats {
  const total = cacheHits + cacheMisses
  return {
    size: frameCache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: total > 0 ? cacheHits / total : 0,
  }
}

interface UseFrameCacheOptions {
  /** Hash of current content to invalidate cache on changes */
  contentHash: string
  /** Whether caching is enabled */
  enabled?: boolean
}

export function useFrameCache(options: UseFrameCacheOptions) {
  const { contentHash, enabled = true } = options

  /**
   * Get a cached frame if available
   */
  const getCachedFrame = (time: number): ImageData | null => {
    if (!enabled) return null

    const key = getCacheKey(time, contentHash)
    const cached = frameCache.get(key)

    if (cached) {
      cacheHits++
      return cached
    }

    cacheMisses++
    return null
  }

  /**
   * Cache a rendered frame
   */
  const cacheFrame = (time: number, imageData: ImageData): void => {
    if (!enabled) return

    // Evict old frames if needed
    evictOldestFrames()

    const key = getCacheKey(time, contentHash)
    frameCache.set(key, imageData)
  }

  /**
   * Pre-render and cache frames near the current position
   * Uses requestIdleCallback for non-blocking rendering
   */
  const preRenderNearbyFrames = (
    currentTime: number,
    rangeSeconds: number,
    renderFn: (time: number) => ImageData | null
  ): void => {
    if (!enabled || typeof requestIdleCallback === 'undefined') return

    requestIdleCallback((deadline) => {
      const startFrame = Math.floor((currentTime - rangeSeconds) * FRAME_BUCKET_FPS)
      const endFrame = Math.ceil((currentTime + rangeSeconds) * FRAME_BUCKET_FPS)

      for (let f = startFrame; f <= endFrame; f++) {
        // Stop if we're out of idle time
        if (deadline.timeRemaining() < 5) break

        const time = f / FRAME_BUCKET_FPS
        const key = getCacheKey(time, contentHash)

        // Skip if already cached
        if (frameCache.has(key)) continue

        // Stop if cache is full
        if (frameCache.size >= MAX_CACHE_SIZE) break

        const imageData = renderFn(time)
        if (imageData) {
          frameCache.set(key, imageData)
        }
      }
    }, { timeout: 100 })
  }

  /**
   * Invalidate frames that match a specific content hash
   * Useful when content changes and cached frames are stale
   */
  const invalidateFrames = (hash?: string): void => {
    if (hash) {
      // Remove only frames with matching hash
      for (const key of frameCache.keys()) {
        if (key.endsWith(`-${hash}`)) {
          frameCache.delete(key)
        }
      }
    } else {
      // Clear all frames
      frameCache.clear()
    }
  }

  return {
    getCachedFrame,
    cacheFrame,
    preRenderNearbyFrames,
    invalidateFrames,
    getStats: getFrameCacheStats,
  }
}

/**
 * Video Frame Cache
 *
 * Specialized cache for video frames with intelligent seeking
 */
class VideoFrameCache {
  private canvasCache = new Map<string, {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    currentTime: number
  }>()

  /**
   * Get a frame from a video element
   */
  async getFrame(
    video: HTMLVideoElement,
    targetTime: number,
    videoId: string
  ): Promise<ImageData | null> {
    if (!video.videoWidth || !video.videoHeight) return null

    // Get or create canvas for this video
    let cache = this.canvasCache.get(videoId)
    if (!cache) {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      cache = { canvas, ctx, currentTime: -1 }
      this.canvasCache.set(videoId, cache)
    }

    // If video is near target time, draw current frame
    if (Math.abs(video.currentTime - targetTime) < 0.05) {
      cache.ctx.drawImage(video, 0, 0)
      cache.currentTime = video.currentTime
      return cache.ctx.getImageData(0, 0, cache.canvas.width, cache.canvas.height)
    }

    // Need to seek - this is async
    return new Promise((resolve) => {
      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked)
        cache!.ctx.drawImage(video, 0, 0)
        cache!.currentTime = video.currentTime
        resolve(cache!.ctx.getImageData(0, 0, cache!.canvas.width, cache!.canvas.height))
      }

      video.addEventListener('seeked', handleSeeked)
      video.currentTime = targetTime
    })
  }

  /**
   * Clear cache for a specific video
   */
  clearVideo(videoId: string): void {
    this.canvasCache.delete(videoId)
  }

  /**
   * Clear all cached videos
   */
  clearAll(): void {
    this.canvasCache.clear()
  }
}

export const videoFrameCache = new VideoFrameCache()
