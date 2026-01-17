/**
 * Fast Sweep Export using MediaRecorder API
 * Creates a smooth left→right→left sweep animation
 */

export interface SweepExportOptions {
  loopCount: number
  format: 'webm' | 'mp4'
  quality: 'low' | 'medium' | 'high'
}

const QUALITY_BITRATES = {
  low: 2_500_000,    // 2.5 Mbps
  medium: 5_000_000, // 5 Mbps
  high: 10_000_000,  // 10 Mbps
}

/**
 * Export a sweep comparison video using MediaRecorder
 * Much faster than frame-by-frame capture
 */
export async function exportSweepVideo(
  canvas: HTMLCanvasElement,
  videoDuration: number,
  options: SweepExportOptions,
  setSliderPosition: (pos: number) => void,
  onProgress: (progress: number, message: string) => void,
  videoElements: { videoA: HTMLVideoElement | null; videoB: HTMLVideoElement | null }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { loopCount, format, quality } = options

    // Each loop is left→right→left, duration = videoDuration
    const loopDuration = videoDuration * 1000 // Convert to ms
    const totalDuration = loopDuration * loopCount

    onProgress(0, 'Preparing export...')

    // Get canvas stream
    const stream = canvas.captureStream(30) // 30fps

    // Determine codec based on format
    const mimeType = format === 'mp4'
      ? 'video/webm;codecs=vp9' // We'll record as webm, browser doesn't support mp4 recording
      : 'video/webm;codecs=vp9'

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      reject(new Error('Video recording not supported in this browser'))
      return
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: QUALITY_BITRATES[quality],
    })

    const chunks: Blob[] = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      onProgress(100, 'Export complete!')
      resolve(blob)
    }

    mediaRecorder.onerror = (e) => {
      reject(new Error('Recording failed: ' + e))
    }

    // Reset videos to start
    const { videoA, videoB } = videoElements
    if (videoA) {
      videoA.currentTime = 0
      videoA.play()
    }
    if (videoB) {
      videoB.currentTime = 0
      videoB.play()
    }

    // Start recording
    mediaRecorder.start(100) // Collect data every 100ms

    const startTime = performance.now()

    // Animation loop
    const animate = () => {
      const elapsed = performance.now() - startTime
      const progress = elapsed / totalDuration

      if (progress >= 1) {
        // Stop recording
        if (videoA) videoA.pause()
        if (videoB) videoB.pause()
        mediaRecorder.stop()
        return
      }

      // Calculate slider position for sweep effect
      // Each loop: 0→100→0 (left to right to left)
      const loopProgress = (elapsed % loopDuration) / loopDuration
      // Use sine wave for smooth easing: 0→1→0
      const sweepPosition = Math.sin(loopProgress * Math.PI) * 100

      setSliderPosition(sweepPosition)

      // Update progress
      onProgress(Math.round(progress * 100), `Recording... ${Math.round(progress * 100)}%`)

      requestAnimationFrame(animate)
    }

    // Small delay to ensure everything is ready
    setTimeout(() => {
      animate()
    }, 100)
  })
}

/**
 * Alternative: Even faster export using pre-rendered approach
 * Records just one sweep and lets the user choose loop count at playback
 */
export async function exportSingleSweep(
  canvas: HTMLCanvasElement,
  sweepDuration: number,
  quality: 'low' | 'medium' | 'high',
  setSliderPosition: (pos: number) => void,
  onProgress: (progress: number, message: string) => void,
  videoElements: { videoA: HTMLVideoElement | null; videoB: HTMLVideoElement | null }
): Promise<Blob> {
  return exportSweepVideo(
    canvas,
    sweepDuration,
    { loopCount: 1, format: 'webm', quality },
    setSliderPosition,
    onProgress,
    videoElements
  )
}

export function downloadVideo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
