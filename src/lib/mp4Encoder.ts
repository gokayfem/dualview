/**
 * MP4 Encoder using mp4-muxer and WebCodecs API
 * Hardware-accelerated, fast, no FFmpeg needed
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

export interface Mp4ExportOptions {
  width: number
  height: number
  fps: number
  bitrate: number
}

const QUALITY_BITRATES = {
  low: 2_500_000,    // 2.5 Mbps
  medium: 5_000_000, // 5 Mbps
  high: 10_000_000,  // 10 Mbps
}

/**
 * Check if WebCodecs is supported
 */
export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

/**
 * Export canvas frames to MP4 using WebCodecs + mp4-muxer
 */
export async function exportCanvasToMp4(
  frames: (() => HTMLCanvasElement)[],
  options: {
    width: number
    height: number
    fps: number
    quality: 'low' | 'medium' | 'high'
  },
  onProgress: (progress: number, message: string) => void
): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs not supported in this browser. Try Chrome or Edge.')
  }

  const { width, height, fps, quality } = options
  const bitrate = QUALITY_BITRATES[quality]
  const totalFrames = frames.length

  onProgress(0, 'Initializing MP4 encoder...')

  // Create muxer
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
    },
    fastStart: 'in-memory',
  })

  // Create video encoder
  let encodedFrames = 0
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta)
      encodedFrames++
      const progress = 50 + (encodedFrames / totalFrames) * 45
      onProgress(progress, `Encoding frame ${encodedFrames}/${totalFrames}`)
    },
    error: (e) => {
      console.error('VideoEncoder error:', e)
    },
  })

  // Configure encoder
  encoder.configure({
    codec: 'avc1.640028', // H.264 High Profile Level 4.0
    width,
    height,
    bitrate,
    framerate: fps,
  })

  onProgress(5, 'Encoding frames...')

  // Encode each frame
  const frameDuration = 1_000_000 / fps // microseconds

  for (let i = 0; i < totalFrames; i++) {
    const canvas = frames[i]()

    // Create VideoFrame from canvas
    const frame = new VideoFrame(canvas, {
      timestamp: i * frameDuration,
      duration: frameDuration,
    })

    // Encode frame (keyframe every 30 frames)
    encoder.encode(frame, { keyFrame: i % 30 === 0 })
    frame.close()

    // Update progress for capture phase
    if (i % 5 === 0) {
      const progress = (i / totalFrames) * 50
      onProgress(progress, `Processing frame ${i + 1}/${totalFrames}`)
    }

    // Prevent blocking
    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 0))
    }
  }

  // Flush encoder
  onProgress(95, 'Finalizing MP4...')
  await encoder.flush()
  encoder.close()

  // Finalize muxer
  muxer.finalize()

  // Get the MP4 data
  const { buffer } = muxer.target as ArrayBufferTarget
  const blob = new Blob([buffer], { type: 'video/mp4' })

  onProgress(100, 'MP4 export complete!')
  return blob
}

/**
 * Simplified export for sweep animation
 */
export async function exportSweepToMp4(
  drawFrame: (progress: number) => HTMLCanvasElement,
  totalFrames: number,
  options: {
    width: number
    height: number
    fps: number
    quality: 'low' | 'medium' | 'high'
  },
  onProgress: (progress: number, message: string) => void
): Promise<Blob> {
  // Create frame generators
  const frames = Array.from({ length: totalFrames }, (_, i) => {
    const progress = (i / totalFrames) * 100
    return () => {
      drawFrame(progress)
      // Return the canvas that drawFrame renders to
      // We need to capture it at this moment
      const canvas = document.createElement('canvas')
      canvas.width = options.width
      canvas.height = options.height
      return canvas
    }
  })

  return exportCanvasToMp4(frames, options, onProgress)
}
