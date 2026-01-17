/**
 * Filmstrip Frame Extractor (FILMSTRIP-001)
 * 
 * Extracts multiple frames from videos as thumbnails for timeline preview.
 * Runs extraction in the main thread but with requestIdleCallback for performance.
 */

export interface FilmstripFrame {
  time: number // Time in seconds
  dataUrl: string // Base64 thumbnail
}

export interface FilmstripData {
  mediaId: string
  duration: number
  frames: FilmstripFrame[]
  frameInterval: number // Seconds between frames
}

// Cache for extracted filmstrips with LRU eviction
const filmstripCache = new Map<string, FilmstripData>()
const MAX_CACHE_SIZE = 50 // Maximum number of filmstrips to cache

// Pending extractions to avoid duplicate work
const pendingExtractions = new Map<string, Promise<FilmstripData | null>>()

/**
 * Add to cache with LRU eviction
 */
function addToCache(mediaId: string, data: FilmstripData): void {
  // If cache is full, evict oldest entry (first in Map)
  if (filmstripCache.size >= MAX_CACHE_SIZE) {
    const firstKey = filmstripCache.keys().next().value
    if (firstKey) {
      filmstripCache.delete(firstKey)
    }
  }
  filmstripCache.set(mediaId, data)
}

/**
 * Get from cache and move to end (most recently used)
 */
function getFromCache(mediaId: string): FilmstripData | undefined {
  const data = filmstripCache.get(mediaId)
  if (data) {
    // Move to end for LRU
    filmstripCache.delete(mediaId)
    filmstripCache.set(mediaId, data)
  }
  return data
}

/**
 * Configuration for filmstrip extraction
 */
export interface FilmstripConfig {
  frameInterval?: number // Seconds between frames (default: 1)
  thumbnailWidth?: number // Width of each thumbnail (default: 80)
  thumbnailHeight?: number // Height of each thumbnail (default: 45)
  maxFrames?: number // Maximum frames to extract (default: 100)
}

const DEFAULT_CONFIG: Required<FilmstripConfig> = {
  frameInterval: 1,
  thumbnailWidth: 80,
  thumbnailHeight: 45,
  maxFrames: 100,
}

/**
 * Extract filmstrip frames from a video
 */
export async function extractFilmstrip(
  mediaId: string,
  videoUrl: string,
  duration: number,
  config: FilmstripConfig = {}
): Promise<FilmstripData | null> {
  // Check cache first (uses LRU access)
  const cached = getFromCache(mediaId)
  if (cached) {
    return cached
  }

  // Check if extraction is already pending
  if (pendingExtractions.has(mediaId)) {
    return pendingExtractions.get(mediaId)!
  }

  // Merge with defaults
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Create extraction promise
  const extractionPromise = performExtraction(mediaId, videoUrl, duration, cfg)
  pendingExtractions.set(mediaId, extractionPromise)

  try {
    const result = await extractionPromise
    if (result) {
      addToCache(mediaId, result)
    }
    return result
  } finally {
    pendingExtractions.delete(mediaId)
  }
}

/**
 * Perform the actual frame extraction
 */
async function performExtraction(
  mediaId: string,
  videoUrl: string,
  duration: number,
  config: Required<FilmstripConfig>
): Promise<FilmstripData | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.src = videoUrl

    const frames: FilmstripFrame[] = []
    let currentFrame = 0
    let isResolved = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Cleanup function to properly release resources
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
      video.src = ''
      video.load() // Force release
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const resolveOnce = (result: FilmstripData | null) => {
      if (isResolved) return
      isResolved = true
      cleanup()
      resolve(result)
    }

    // Calculate frame times
    const frameCount = Math.min(
      Math.ceil(duration / config.frameInterval),
      config.maxFrames
    )
    const frameTimes: number[] = []
    for (let i = 0; i < frameCount; i++) {
      frameTimes.push(i * config.frameInterval)
    }

    const captureFrame = () => {
      if (isResolved) return
      
      if (currentFrame >= frameTimes.length) {
        // All frames captured
        resolveOnce({
          mediaId,
          duration,
          frames,
          frameInterval: config.frameInterval,
        })
        return
      }

      const time = frameTimes[currentFrame]
      video.currentTime = time
    }

    const handleSeeked = () => {
      if (isResolved) return
      
      try {
        const canvas = document.createElement('canvas')
        canvas.width = config.thumbnailWidth
        canvas.height = config.thumbnailHeight
        const ctx = canvas.getContext('2d')

        if (ctx) {
          // Draw frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6)

          frames.push({
            time: frameTimes[currentFrame],
            dataUrl,
          })
        }

        currentFrame++

        // Use requestIdleCallback for next frame if available, otherwise setTimeout
        if ('requestIdleCallback' in window) {
          (window as Window & { requestIdleCallback: (cb: () => void, options?: { timeout: number }) => number })
            .requestIdleCallback(captureFrame, { timeout: 100 })
        } else {
          setTimeout(captureFrame, 10)
        }
      } catch (error) {
        console.warn('Failed to capture frame:', error)
        currentFrame++
        if (currentFrame < frameTimes.length) {
          captureFrame()
        } else {
          // Return what we have so far
          resolveOnce(frames.length > 0 ? {
            mediaId,
            duration,
            frames,
            frameInterval: config.frameInterval,
          } : null)
        }
      }
    }

    const handleLoadedMetadata = () => {
      video.addEventListener('seeked', handleSeeked)
      captureFrame()
    }

    const handleError = () => {
      console.warn('Failed to load video for filmstrip extraction')
      resolveOnce(null)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('error', handleError)

    // Timeout fallback - resolve with partial results or null
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.warn('Filmstrip extraction timed out')
        resolveOnce(frames.length > 0 ? {
          mediaId,
          duration,
          frames,
          frameInterval: config.frameInterval,
        } : null)
      }
    }, 30000) // 30 second timeout
  })
}

/**
 * Get cached filmstrip if available (uses LRU access)
 */
export function getCachedFilmstrip(mediaId: string): FilmstripData | null {
  return getFromCache(mediaId) || null
}

/**
 * Clear filmstrip cache for a media item
 */
export function clearFilmstripCache(mediaId: string): void {
  filmstripCache.delete(mediaId)
}

/**
 * Clear entire filmstrip cache
 */
export function clearAllFilmstripCache(): void {
  filmstripCache.clear()
}

/**
 * Get frames visible in a time range
 */
export function getVisibleFrames(
  filmstrip: FilmstripData,
  startTime: number,
  endTime: number,
  inPoint: number = 0
): FilmstripFrame[] {
  // Adjust for clip's in-point
  const adjustedStart = startTime + inPoint
  const adjustedEnd = endTime + inPoint

  return filmstrip.frames.filter(
    frame => frame.time >= adjustedStart && frame.time <= adjustedEnd
  )
}

/**
 * Calculate how many frames should be shown based on clip width
 */
export function calculateVisibleFrameCount(
  clipWidth: number,
  thumbnailWidth: number = DEFAULT_CONFIG.thumbnailWidth
): number {
  return Math.max(1, Math.floor(clipWidth / thumbnailWidth))
}
