/**
 * Lightweight GIF encoder using gif.js from CDN
 * No FFmpeg dependency - much faster to load
 */

// Load gif.js from CDN
let GIF: any = null
let gifJsLoaded = false
let loadingPromise: Promise<void> | null = null

async function loadGifJs(): Promise<void> {
  if (gifJsLoaded && GIF) return

  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise((resolve, reject) => {
    // Load gif.js from CDN
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
    script.onload = () => {
      GIF = (window as any).GIF
      gifJsLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load gif.js'))
    document.head.appendChild(script)
  })

  return loadingPromise
}

export interface GifExportOptions {
  width: number
  height: number
  fps: number
  quality: number // 1-20, lower is better quality
}

const GIF_PRESETS = {
  small: { width: 320, height: 180, fps: 10, quality: 10 },
  medium: { width: 480, height: 270, fps: 12, quality: 10 },
  large: { width: 640, height: 360, fps: 15, quality: 10 },
  hd: { width: 854, height: 480, fps: 15, quality: 10 },
}

/**
 * Create GIF from canvas frames
 */
export async function createGifFromFrames(
  frames: ImageData[],
  preset: 'small' | 'medium' | 'large' | 'hd',
  onProgress: (progress: number, message: string) => void
): Promise<Blob> {
  onProgress(0, 'Loading GIF encoder...')
  await loadGifJs()

  const options = GIF_PRESETS[preset]

  onProgress(5, 'Initializing GIF encoder...')

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: options.quality,
      width: options.width,
      height: options.height,
      workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
    })

    // Add frames
    const frameDelay = Math.round(1000 / options.fps)
    frames.forEach((frame, i) => {
      gif.addFrame(frame, { delay: frameDelay })
      if (i % 10 === 0) {
        onProgress(5 + (i / frames.length) * 45, `Adding frame ${i + 1}/${frames.length}`)
      }
    })

    gif.on('progress', (p: number) => {
      onProgress(50 + p * 50, `Encoding GIF... ${Math.round(p * 100)}%`)
    })

    gif.on('finished', (blob: Blob) => {
      onProgress(100, 'GIF created!')
      resolve(blob)
    })

    gif.on('error', (err: Error) => {
      reject(err)
    })

    onProgress(50, 'Encoding GIF...')
    gif.render()
  })
}

/**
 * Capture frames from a canvas during animation
 */
export function captureFrame(
  canvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): ImageData {
  // Create a temporary canvas at target size
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = targetWidth
  tempCanvas.height = targetHeight
  const ctx = tempCanvas.getContext('2d')!

  // Draw scaled version
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight)

  return ctx.getImageData(0, 0, targetWidth, targetHeight)
}

/**
 * Export sweep animation as GIF
 * Records frames during the sweep and encodes to GIF
 */
export async function exportSweepAsGif(
  drawFrame: (progress: number) => HTMLCanvasElement,
  durationMs: number,
  preset: 'small' | 'medium' | 'large' | 'hd',
  onProgress: (progress: number, message: string) => void
): Promise<Blob> {
  const options = GIF_PRESETS[preset]
  const totalFrames = Math.ceil((durationMs / 1000) * options.fps)
  const frames: ImageData[] = []

  onProgress(0, 'Capturing frames...')

  // Capture frames
  for (let i = 0; i < totalFrames; i++) {
    const progress = (i / totalFrames) * 100
    const canvas = drawFrame(progress)
    const frame = captureFrame(canvas, options.width, options.height)
    frames.push(frame)

    if (i % 5 === 0) {
      onProgress((i / totalFrames) * 30, `Capturing frame ${i + 1}/${totalFrames}`)
    }

    // Small delay to prevent blocking
    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 0))
    }
  }

  onProgress(30, 'Encoding GIF...')

  // Create GIF
  const blob = await createGifFromFrames(frames, preset, (p, msg) => {
    onProgress(30 + p * 0.7, msg)
  })

  return blob
}

export { GIF_PRESETS }
