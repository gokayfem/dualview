/**
 * GIF Export Utility
 * Uses gif.js-upgrade for browser-based GIF encoding
 */

// @ts-expect-error - gif.js-upgrade doesn't have types
import GIF from 'gif.js-upgrade'

export interface GIFExportSettings {
  width: number
  height: number
  fps: number
  quality: number // 1-30, lower is better quality
  repeat: number // 0 = loop forever, -1 = no repeat, n = repeat n times
}

export interface GIFExportProgress {
  phase: 'capturing' | 'encoding' | 'done' | 'error'
  progress: number // 0-100
  message: string
}

const DEFAULT_SETTINGS: GIFExportSettings = {
  width: 480,
  height: 270,
  fps: 10,
  quality: 10,
  repeat: 0,
}

/**
 * Export canvas frames to GIF
 */
export async function exportToGIF(
  canvas: HTMLCanvasElement,
  duration: number,
  settings: Partial<GIFExportSettings> = {},
  onProgress?: (progress: GIFExportProgress) => void
): Promise<Blob> {
  const config = { ...DEFAULT_SETTINGS, ...settings }
  const frameDelay = 1000 / config.fps
  const totalFrames = Math.ceil(duration * config.fps)

  return new Promise((resolve, reject) => {
    // Create GIF encoder
    const gif = new GIF({
      workers: 4,
      quality: config.quality,
      width: config.width,
      height: config.height,
      repeat: config.repeat,
      workerScript: '/gif.worker.js',
    })

    // Create a temporary canvas for resizing
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = config.width
    tempCanvas.height = config.height
    const tempCtx = tempCanvas.getContext('2d')

    if (!tempCtx) {
      reject(new Error('Failed to create canvas context'))
      return
    }

    // Capture frames
    onProgress?.({
      phase: 'capturing',
      progress: 0,
      message: `Capturing frame 0/${totalFrames}`,
    })

    // For static images, just add the current frame
    if (duration === 0 || totalFrames <= 1) {
      tempCtx.drawImage(canvas, 0, 0, config.width, config.height)
      gif.addFrame(tempCtx, { copy: true, delay: 1000 })
    } else {
      // For videos/animations, we need to capture multiple frames
      // This is a simplified version - real implementation would need
      // to control video playback and capture at specific times
      for (let i = 0; i < totalFrames; i++) {
        tempCtx.drawImage(canvas, 0, 0, config.width, config.height)
        gif.addFrame(tempCtx, { copy: true, delay: frameDelay })

        onProgress?.({
          phase: 'capturing',
          progress: Math.round((i / totalFrames) * 50),
          message: `Capturing frame ${i + 1}/${totalFrames}`,
        })
      }
    }

    // Handle encoding progress
    gif.on('progress', (p: number) => {
      onProgress?.({
        phase: 'encoding',
        progress: 50 + Math.round(p * 50),
        message: `Encoding GIF: ${Math.round(p * 100)}%`,
      })
    })

    // Handle completion
    gif.on('finished', (blob: Blob) => {
      onProgress?.({
        phase: 'done',
        progress: 100,
        message: 'GIF export complete!',
      })
      resolve(blob)
    })

    // Start rendering
    onProgress?.({
      phase: 'encoding',
      progress: 50,
      message: 'Starting GIF encoding...',
    })

    gif.render()
  })
}

/**
 * Export comparison view to GIF with frame capture at intervals
 */
export async function exportComparisonToGIF(
  captureFrame: () => ImageData | null,
  duration: number,
  settings: Partial<GIFExportSettings> = {},
  onProgress?: (progress: GIFExportProgress) => void,
  seekTo?: (time: number) => Promise<void>
): Promise<Blob> {
  const config = { ...DEFAULT_SETTINGS, ...settings }
  const frameDelay = 1000 / config.fps
  const totalFrames = Math.ceil(duration * config.fps)

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 4,
      quality: config.quality,
      width: config.width,
      height: config.height,
      repeat: config.repeat,
      workerScript: '/gif.worker.js',
    })

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = config.width
    tempCanvas.height = config.height
    const tempCtx = tempCanvas.getContext('2d')

    if (!tempCtx) {
      reject(new Error('Failed to create canvas context'))
      return
    }

    // Async frame capture
    const captureAllFrames = async () => {
      for (let i = 0; i < totalFrames; i++) {
        const time = (i / config.fps)

        // Seek to the specific time if function provided
        if (seekTo) {
          await seekTo(time)
          // Small delay to let the frame render
          await new Promise(r => setTimeout(r, 50))
        }

        const frameData = captureFrame()
        if (frameData) {
          // Scale the captured frame to target size
          const sourceCanvas = document.createElement('canvas')
          sourceCanvas.width = frameData.width
          sourceCanvas.height = frameData.height
          const sourceCtx = sourceCanvas.getContext('2d')
          if (sourceCtx) {
            sourceCtx.putImageData(frameData, 0, 0)
            tempCtx.drawImage(sourceCanvas, 0, 0, config.width, config.height)
          }
        }

        gif.addFrame(tempCtx, { copy: true, delay: frameDelay })

        onProgress?.({
          phase: 'capturing',
          progress: Math.round((i / totalFrames) * 50),
          message: `Capturing frame ${i + 1}/${totalFrames}`,
        })
      }
    }

    captureAllFrames()
      .then(() => {
        gif.on('progress', (p: number) => {
          onProgress?.({
            phase: 'encoding',
            progress: 50 + Math.round(p * 50),
            message: `Encoding GIF: ${Math.round(p * 100)}%`,
          })
        })

        gif.on('finished', (blob: Blob) => {
          onProgress?.({
            phase: 'done',
            progress: 100,
            message: 'GIF export complete!',
          })
          resolve(blob)
        })

        onProgress?.({
          phase: 'encoding',
          progress: 50,
          message: 'Starting GIF encoding...',
        })

        gif.render()
      })
      .catch(reject)
  })
}

/**
 * Download a blob as a file
 */
export function downloadGIF(blob: Blob, filename: string = 'comparison.gif') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * GIF size presets
 */
export const GIF_PRESETS = {
  small: { width: 320, height: 180, fps: 8, quality: 15 },
  medium: { width: 480, height: 270, fps: 10, quality: 10 },
  large: { width: 640, height: 360, fps: 12, quality: 8 },
  hd: { width: 854, height: 480, fps: 15, quality: 5 },
} as const

export type GIFPreset = keyof typeof GIF_PRESETS
