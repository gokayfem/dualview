import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let loaded = false

let loadingPromise: Promise<FFmpeg> | null = null

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && loaded) return ffmpeg

  // Prevent multiple simultaneous loads
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    console.log('[FFmpeg] Starting to load FFmpeg WASM...')
    ffmpeg = new FFmpeg()

    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message)
    })

    ffmpeg.on('progress', ({ progress }) => {
      console.log('[FFmpeg] Loading progress:', Math.round(progress * 100) + '%')
    })

    // Load FFmpeg with CORS-enabled URLs
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    console.log('[FFmpeg] Fetching FFmpeg core from CDN...')

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      console.log('[FFmpeg] FFmpeg loaded successfully!')
      loaded = true
    } catch (error) {
      console.error('[FFmpeg] Failed to load FFmpeg:', error)
      loadingPromise = null
      throw error
    }

    return ffmpeg
  })()

  return loadingPromise
}

export interface ExportOptions {
  format: 'mp4' | 'webm'
  resolution: '720p' | '1080p' | '4k'
  quality: 'low' | 'medium' | 'high'
  fps: number
}

const resolutionMap = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
}

const qualityMap = {
  low: 28,
  medium: 23,
  high: 18,
}

/**
 * Export comparison with actual frame capture (FIX-004)
 * @param captureFrame - Function to capture current frame as canvas
 * @param duration - Total duration in seconds
 * @param fps - Frames per second
 * @param options - Export options
 * @param onProgress - Progress callback
 * @param seekTo - Function to seek video to specific time
 */
export async function exportComparison(
  captureFrame: () => HTMLCanvasElement | null,
  duration: number,
  fps: number,
  options: ExportOptions,
  onProgress: (progress: number) => void,
  seekTo?: (time: number) => Promise<void>
): Promise<Blob> {
  console.log('[Export] Starting export, duration:', duration, 'fps:', fps)

  const ffmpeg = await getFFmpeg()
  console.log('[Export] FFmpeg ready')

  const { width, height } = resolutionMap[options.resolution]
  const crf = qualityMap[options.quality]

  const totalFrames = Math.ceil(duration * fps)
  const frameTime = 1 / fps

  console.log('[Export] Total frames to capture:', totalFrames)

  if (totalFrames <= 0) {
    throw new Error(`Invalid frame count: ${totalFrames}. Duration: ${duration}, FPS: ${fps}`)
  }

  onProgress(0)

  // FIX-004: Capture actual frames at each timestamp
  for (let i = 0; i < totalFrames; i++) {
    const time = i * frameTime

    // Seek to the specific time if function provided
    if (seekTo) {
      await seekTo(time)
      // Wait for frame to render
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Capture the current frame
    const canvas = captureFrame()
    if (!canvas) {
      throw new Error('Failed to capture frame - canvas not available')
    }

    const frameData = canvas.toDataURL('image/png')
    const frameBlob = await fetch(frameData).then(r => r.blob())
    const paddedIndex = String(i).padStart(5, '0')
    await ffmpeg.writeFile(`frame_${paddedIndex}.png`, await fetchFile(frameBlob))

    // Update progress (first 70% is frame capture)
    onProgress(Math.round((i / totalFrames) * 70))

    if (i % 10 === 0) {
      console.log(`[Export] Captured frame ${i + 1}/${totalFrames}`)
    }
  }

  // Create video from captured frames
  const outputFormat = options.format === 'mp4' ? 'mp4' : 'webm'
  const codec = options.format === 'mp4' ? 'libx264' : 'libvpx-vp9'

  onProgress(75)

  await ffmpeg.exec([
    '-framerate', fps.toString(),
    '-i', 'frame_%05d.png',
    '-c:v', codec,
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${width}:${height}`,
    '-crf', crf.toString(),
    `output.${outputFormat}`,
  ])

  onProgress(95)

  const data = await ffmpeg.readFile(`output.${outputFormat}`)
  const uint8Data = data instanceof Uint8Array
    ? new Uint8Array(data)
    : new TextEncoder().encode(data as string)
  const blob = new Blob([uint8Data.buffer as ArrayBuffer], {
    type: options.format === 'mp4' ? 'video/mp4' : 'video/webm',
  })

  // Cleanup all frame files
  for (let i = 0; i < totalFrames; i++) {
    const paddedIndex = String(i).padStart(5, '0')
    try {
      await ffmpeg.deleteFile(`frame_${paddedIndex}.png`)
    } catch {
      // Ignore cleanup errors
    }
  }
  await ffmpeg.deleteFile(`output.${outputFormat}`)

  onProgress(100)

  return blob
}

/**
 * Legacy single-frame export for screenshots
 */
export async function exportSingleFrame(
  canvas: HTMLCanvasElement,
  duration: number,
  fps: number,
  options: ExportOptions,
  onProgress: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  const { width, height } = resolutionMap[options.resolution]
  const crf = qualityMap[options.quality]

  onProgress(0)

  const frameData = canvas.toDataURL('image/png')
  const frameBlob = await fetch(frameData).then(r => r.blob())
  await ffmpeg.writeFile('frame.png', await fetchFile(frameBlob))

  const outputFormat = options.format === 'mp4' ? 'mp4' : 'webm'
  const codec = options.format === 'mp4' ? 'libx264' : 'libvpx-vp9'

  await ffmpeg.exec([
    '-loop', '1',
    '-i', 'frame.png',
    '-c:v', codec,
    '-t', duration.toString(),
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${width}:${height}`,
    '-r', fps.toString(),
    '-crf', crf.toString(),
    `output.${outputFormat}`,
  ])

  onProgress(100)

  const data = await ffmpeg.readFile(`output.${outputFormat}`)
  const uint8Data = data instanceof Uint8Array
    ? new Uint8Array(data)
    : new TextEncoder().encode(data as string)
  const blob = new Blob([uint8Data.buffer as ArrayBuffer], {
    type: options.format === 'mp4' ? 'video/mp4' : 'video/webm',
  })

  await ffmpeg.deleteFile('frame.png')
  await ffmpeg.deleteFile(`output.${outputFormat}`)

  return blob
}

export function downloadBlob(blob: Blob, filename: string) {
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
 * Convert WebM blob to MP4 using FFmpeg
 */
export async function convertWebMToMP4(
  webmBlob: Blob,
  quality: 'low' | 'medium' | 'high',
  onProgress: (progress: number, message: string) => void
): Promise<Blob> {
  onProgress(0, 'Loading FFmpeg...')
  const ffmpeg = await getFFmpeg()

  const crf = qualityMap[quality]

  onProgress(10, 'Preparing conversion...')
  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob))

  onProgress(20, 'Converting to MP4...')

  // Set up progress tracking
  ffmpeg.on('progress', ({ progress }) => {
    const percent = 20 + Math.round(progress * 70)
    onProgress(percent, `Converting... ${Math.round(progress * 100)}%`)
  })

  await ffmpeg.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', crf.toString(),
    '-preset', 'fast',
    'output.mp4',
  ])

  onProgress(95, 'Finalizing...')

  const data = await ffmpeg.readFile('output.mp4')
  const uint8Data = data instanceof Uint8Array
    ? new Uint8Array(data)
    : new TextEncoder().encode(data as string)
  const mp4Blob = new Blob([uint8Data.buffer as ArrayBuffer], { type: 'video/mp4' })

  // Cleanup
  await ffmpeg.deleteFile('input.webm')
  await ffmpeg.deleteFile('output.mp4')

  onProgress(100, 'Conversion complete!')
  return mp4Blob
}

/**
 * Convert WebM blob to GIF using FFmpeg
 */
export async function convertWebMToGIF(
  webmBlob: Blob,
  preset: 'small' | 'medium' | 'large' | 'hd',
  onProgress: (progress: number, message: string) => void
): Promise<Blob> {
  onProgress(0, 'Loading FFmpeg...')
  const ffmpeg = await getFFmpeg()

  // GIF presets with size and fps
  const gifPresets = {
    small: { width: 320, fps: 10 },
    medium: { width: 480, fps: 12 },
    large: { width: 640, fps: 15 },
    hd: { width: 854, fps: 15 },
  }

  const { width, fps } = gifPresets[preset]

  onProgress(10, 'Preparing conversion...')
  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob))

  onProgress(20, 'Generating palette...')

  // Generate palette for better GIF quality
  await ffmpeg.exec([
    '-i', 'input.webm',
    '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    '-y', 'palette.png',
  ])

  onProgress(50, 'Creating GIF...')

  // Set up progress tracking
  ffmpeg.on('progress', ({ progress }) => {
    const percent = 50 + Math.round(progress * 45)
    onProgress(percent, `Creating GIF... ${Math.round(progress * 100)}%`)
  })

  // Create GIF using palette
  await ffmpeg.exec([
    '-i', 'input.webm',
    '-i', 'palette.png',
    '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
    '-y', 'output.gif',
  ])

  onProgress(98, 'Finalizing...')

  const data = await ffmpeg.readFile('output.gif')
  const uint8Data = data instanceof Uint8Array
    ? new Uint8Array(data)
    : new TextEncoder().encode(data as string)
  const gifBlob = new Blob([uint8Data.buffer as ArrayBuffer], { type: 'image/gif' })

  // Cleanup
  await ffmpeg.deleteFile('input.webm')
  await ffmpeg.deleteFile('palette.png')
  await ffmpeg.deleteFile('output.gif')

  onProgress(100, 'GIF created!')
  return gifBlob
}
