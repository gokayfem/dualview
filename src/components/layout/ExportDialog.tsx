import { useState, useMemo } from 'react'
import { Button, Select, Slider } from '../ui'
import { useProjectStore } from '../../stores/projectStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { X, Download, Loader2, Check, AlertCircle, Camera, FileText, Clipboard, Box, Sparkles, Film, Layers } from 'lucide-react'
import { captureCanvasScreenshot, downloadBlob, generatePDFReport } from '../../lib/screenshotExport'
import { downloadVideo } from '../../lib/sweepExport'
import { GIF_PRESETS } from '../../lib/gifEncoder'
import { isWebCodecsSupported } from '../../lib/mp4Encoder'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { WebGLTransitionRenderer } from '../../lib/webgl/WebGLTransitionRenderer'
import { getAllEngines, getAllVariants, getShader, getTotalShaderCount } from '../../lib/webgl/shaders'
import { exportStitchedVideo, downloadStitchedVideo, getTrackExportInfo, type StitchExportProgress } from '../../lib/stitchExport'
import type { ExportSource, SweepStyle, TransitionEngine, TransitionExportMode } from '../../types'
import { formatTime } from '../../lib/utils'

type ExportMode = 'video' | 'screenshot' | 'pdf' | '3d' | 'transition' | 'stitch'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function ExportDialog({ isOpen, onClose, canvasRef }: ExportDialogProps) {
  const { exportSettings, setExportSettings, exportProgress, setExportProgress, comparisonMode, metricsSSIM, metricsPSNR, setSliderPosition } = useProjectStore()
  const [exportMode, setExportMode] = useState<ExportMode>('video')
  const [screenshotFormat, setScreenshotFormat] = useState<'png' | 'jpg'>('png')
  const [screenshotResolution, setScreenshotResolution] = useState<'720p' | '1080p' | '4k'>('1080p')
  const [screenshotSource, setScreenshotSource] = useState<'comparison' | 'a-only' | 'b-only'>('comparison')
  const [screenshotSliderPos, setScreenshotSliderPos] = useState(50)
  const [screenshotQuality, setScreenshotQuality] = useState(95)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingScreenshot, setIsExportingScreenshot] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [pdfTitle, setPdfTitle] = useState('DualView Comparison Report')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeSettings, setIncludeSettings] = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // 3D export settings
  const [export3DSource, setExport3DSource] = useState<'side-by-side' | 'a-only' | 'b-only'>('side-by-side')
  const [export3DRotations, setExport3DRotations] = useState(1)
  const [export3DFps, setExport3DFps] = useState(30)
  const [export3DFormat, setExport3DFormat] = useState<'mp4' | 'gif'>('mp4')
  const [export3DQuality, setExport3DQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [isExporting3D, setIsExporting3D] = useState(false)
  // Transition export settings
  const [isExportingTransition, setIsExportingTransition] = useState(false)
  const [transitionEngine, setTransitionEngine] = useState<TransitionEngine>('crossfade')
  const [transitionVariant, setTransitionVariant] = useState('crossfade')
  const [transitionDuration, setTransitionDuration] = useState(1.5)
  const [transitionIntensity, setTransitionIntensity] = useState(1.0)
  const [transitionExportMode, setTransitionExportMode] = useState<TransitionExportMode>('sequential')
  const [transitionFormat, setTransitionFormat] = useState<'mp4' | 'gif'>('mp4')
  const [transitionQuality, setTransitionQuality] = useState<'low' | 'medium' | 'high'>('medium')
  // Stitch export settings
  const [isExportingStitch, setIsExportingStitch] = useState(false)
  const [stitchTrackId, setStitchTrackId] = useState<string>('track-a')
  const [stitchResolution, setStitchResolution] = useState<'720p' | '1080p' | '4k'>('1080p')
  const [stitchQuality, setStitchQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [stitchFps, setStitchFps] = useState<24 | 30 | 60>(30)
  const [stitchProgress, setStitchProgress] = useState<StitchExportProgress>({
    status: 'idle',
    progress: 0,
    message: '',
    currentClip: 0,
    totalClips: 0,
  })
  const { getFile } = useMediaStore()
  const { tracks, duration } = useTimelineStore()
  const { setExporting } = usePlaybackStore()

  // Get video elements from the DOM using data-track attributes
  const getVideoElements = () => {
    const container = canvasRef.current?.parentElement?.parentElement
    if (!container) return { videoA: null, videoB: null }

    // Use data-track attributes to correctly identify A and B
    const videoA = container.querySelector('video[data-track="a"]') as HTMLVideoElement | null
    const videoB = container.querySelector('video[data-track="b"]') as HTMLVideoElement | null

    return { videoA, videoB }
  }

  // Get image elements from the DOM using data-track attributes
  const getImageElements = () => {
    const container = canvasRef.current?.parentElement?.parentElement
    if (!container) return { imgA: null, imgB: null }

    const imgA = container.querySelector('img[data-track="a"]') as HTMLImageElement | null
    const imgB = container.querySelector('img[data-track="b"]') as HTMLImageElement | null

    return { imgA, imgB }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setExporting(true) // Disable sync hooks during export
    setError(null)
    setProgress(0)

    try {
      // Get video/image elements using data-track attributes
      const { videoA, videoB } = getVideoElements()
      const { imgA, imgB } = getImageElements()

      // Determine media sources
      const mediaA = videoA || imgA
      const mediaB = videoB || imgB

      if (!mediaA && !mediaB) {
        throw new Error('No media to export')
      }

      // Calculate loop duration based on longest video
      const trackA = tracks.find(t => t.type === 'a')
      const trackB = tracks.find(t => t.type === 'b')
      const clipA = trackA?.clips[0]
      const clipB = trackB?.clips[0]
      const fileA = clipA ? getFile(clipA.mediaId) : null
      const fileB = clipB ? getFile(clipB.mediaId) : null
      const loopDuration = Math.max(fileA?.duration || duration, fileB?.duration || duration, 1)

      // Create canvas for rendering
      const captureCanvas = document.createElement('canvas')
      captureCanvas.width = 1920
      captureCanvas.height = 1080
      const ctx = captureCanvas.getContext('2d')!

      setExportProgress({ status: 'encoding', progress: 0, message: 'Recording sweep...' })

      // Generate random parameters for spotlight animation (once per export)
      // This makes each export have a unique trajectory
      const spotlightRandom = {
        // Random phase offsets (0-2 range for full triangle wave cycle)
        phaseX: Math.random() * 2,
        phaseY: Math.random() * 2,
        // Random speed multipliers with variance (base is around 2.0, variance ±0.8)
        speedMultX: 1.2 + Math.random() * 1.6, // 1.2 to 2.8
        speedMultY: 1.2 + Math.random() * 1.6, // 1.2 to 2.8
        // Random direction (1 or -1) - determines if we start going left/right, up/down
        dirX: Math.random() > 0.5 ? 1 : -1,
        dirY: Math.random() > 0.5 ? 1 : -1,
      }

      // Function to draw sweep frame directly to canvas
      const drawSweepFrame = (progress: number, style: SweepStyle) => {
        const width = 1920
        const height = 1080

        // Clear canvas
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)

        // Draw media B as background
        if (mediaB) {
          try {
            ctx.drawImage(mediaB, 0, 0, width, height)
          } catch {}
        }

        // Draw media A with different clip shapes based on sweep style
        if (mediaA) {
          ctx.save()
          ctx.beginPath()

          switch (style) {
            case 'horizontal': {
              // Left to right sweep
              const sliderX = (progress / 100) * width
              ctx.rect(0, 0, sliderX, height)
              ctx.clip()
              try { ctx.drawImage(mediaA, 0, 0, width, height) } catch {}
              ctx.restore()
              // Draw slider line
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(sliderX - 1, 0, 2, height)
              return
            }

            case 'vertical': {
              // Top to bottom sweep
              const sliderY = (progress / 100) * height
              ctx.rect(0, 0, width, sliderY)
              ctx.clip()
              try { ctx.drawImage(mediaA, 0, 0, width, height) } catch {}
              ctx.restore()
              // Draw slider line
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, sliderY - 1, width, 2)
              return
            }

            case 'diagonal': {
              // Diagonal wipe from top-left to bottom-right
              const diagProgress = (progress / 100) * 2 // 0 to 2
              const offset = (diagProgress - 1) * (width + height)
              ctx.moveTo(offset, 0)
              ctx.lineTo(offset + height, height)
              ctx.lineTo(-width, height)
              ctx.lineTo(-width, 0)
              ctx.closePath()
              ctx.clip()
              try { ctx.drawImage(mediaA, 0, 0, width, height) } catch {}
              ctx.restore()
              // Draw diagonal line
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(offset, 0)
              ctx.lineTo(offset + height, height)
              ctx.stroke()
              return
            }

            case 'circle': {
              // Expanding circle from center (iris wipe)
              const maxRadius = Math.sqrt(width * width + height * height) / 2
              const radius = (progress / 100) * maxRadius
              const centerX = width / 2
              const centerY = height / 2
              ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
              ctx.clip()
              try { ctx.drawImage(mediaA, 0, 0, width, height) } catch {}
              ctx.restore()
              // Draw circle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
              ctx.stroke()
              return
            }

            case 'rectangle': {
              // Growing rectangle from center
              const maxW = width
              const maxH = height
              const rectW = (progress / 100) * maxW
              const rectH = (progress / 100) * maxH
              const rectX = (width - rectW) / 2
              const rectY = (height - rectH) / 2
              ctx.rect(rectX, rectY, rectW, rectH)
              ctx.clip()
              try { ctx.drawImage(mediaA, 0, 0, width, height) } catch {}
              ctx.restore()
              // Draw rectangle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 2
              ctx.strokeRect(rectX, rectY, rectW, rectH)
              return
            }

            case 'spotlight': {
              // Bouncing rectangle like classic DVD screensaver
              const rectW = exportSettings.spotlightWidth * width
              const rectH = exportSettings.spotlightHeight * height

              // Bouncing area bounds
              const maxX = width - rectW
              const maxY = height - rectH

              // Speed factor - configurable, with randomized X/Y multipliers for unique patterns
              const baseSpeed = exportSettings.spotlightSpeed
              const speedX = baseSpeed * spotlightRandom.speedMultX
              const speedY = baseSpeed * spotlightRandom.speedMultY

              // Calculate position using triangle wave (bouncing)
              // Triangle wave: goes 0→1→0→1... creating bounce effect
              const triangleWave = (t: number, dir: number) => {
                // Apply direction to potentially reverse the wave
                const adjusted = dir > 0 ? t : (t + 1) // Phase shift for reverse direction
                const normalized = adjusted % 2
                return normalized <= 1 ? normalized : 2 - normalized
              }

              // Progress determines how far along the animation we are
              // Add random phase offset for unique starting positions
              const t = progress / 100

              // Calculate bouncing positions with random offsets and directions
              const bounceX = triangleWave(t * speedX * 2 + spotlightRandom.phaseX, spotlightRandom.dirX)
              const bounceY = triangleWave(t * speedY * 2 + spotlightRandom.phaseY, spotlightRandom.dirY)

              const rectX = bounceX * maxX
              const rectY = bounceY * maxY

              ctx.rect(rectX, rectY, rectW, rectH)
              ctx.clip()
              try { ctx.drawImage(mediaA, 0, 0, width, height) } catch {}
              ctx.restore()
              // Draw rectangle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 3
              ctx.strokeRect(rectX, rectY, rectW, rectH)
              return
            }

            case 'spotlight-circle': {
              // Bouncing circle like DVD screensaver
              // Use the average of width and height for circle radius
              const circleRadius = ((exportSettings.spotlightWidth + exportSettings.spotlightHeight) / 2) * Math.min(width, height) / 2

              // Bouncing area bounds (accounting for circle radius)
              const maxX = width - circleRadius * 2
              const maxY = height - circleRadius * 2

              // Speed factor - configurable, with randomized X/Y multipliers for unique patterns
              const baseSpeed = exportSettings.spotlightSpeed
              const speedX = baseSpeed * spotlightRandom.speedMultX
              const speedY = baseSpeed * spotlightRandom.speedMultY

              // Calculate position using triangle wave (bouncing)
              const triangleWave = (t: number, dir: number) => {
                // Apply direction to potentially reverse the wave
                const adjusted = dir > 0 ? t : (t + 1) // Phase shift for reverse direction
                const normalized = adjusted % 2
                return normalized <= 1 ? normalized : 2 - normalized
              }

              // Progress determines how far along the animation we are
              const t = progress / 100

              // Calculate bouncing positions with random offsets and directions
              const bounceX = triangleWave(t * speedX * 2 + spotlightRandom.phaseX, spotlightRandom.dirX)
              const bounceY = triangleWave(t * speedY * 2 + spotlightRandom.phaseY, spotlightRandom.dirY)

              const centerX = circleRadius + bounceX * maxX
              const centerY = circleRadius + bounceY * maxY

              ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)
              ctx.clip()
              try { ctx.drawImage(mediaA, 0, 0, width, height) } catch {}
              ctx.restore()
              // Draw circle outline
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 3
              ctx.beginPath()
              ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)
              ctx.stroke()
              return
            }
          }

          ctx.restore()
        }
      }

      // Function to draw single media (for A-only or B-only export)
      const drawSingleMedia = (media: HTMLVideoElement | HTMLImageElement | null) => {
        const width = 1920
        const height = 1080
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)
        if (media) {
          try {
            ctx.drawImage(media, 0, 0, width, height)
          } catch {}
        }
      }

      // Handle A-only or B-only export (no sweep animation)
      if (exportSettings.exportSource === 'a-only' || exportSettings.exportSource === 'b-only') {
        const targetMedia = exportSettings.exportSource === 'a-only' ? mediaA : mediaB
        const targetVideo = exportSettings.exportSource === 'a-only' ? videoA : videoB
        const targetFile = exportSettings.exportSource === 'a-only' ? fileA : fileB
        const targetDuration = targetFile?.duration || duration || 1

        if (!targetMedia) {
          throw new Error(`No media ${exportSettings.exportSource === 'a-only' ? 'A' : 'B'} to export`)
        }

        setExportProgress({ status: 'encoding', progress: 0, message: `Exporting ${exportSettings.exportSource === 'a-only' ? 'A' : 'B'}...` })

        // Handle MP4 export for single media
        if (exportSettings.format === 'mp4') {
          if (!isWebCodecsSupported()) {
            throw new Error('MP4 export requires a modern browser with WebCodecs support (Chrome, Edge)')
          }

          const fps = 30
          const totalFrames = Math.ceil(targetDuration * fps)
          const bitrate = exportSettings.quality === 'high' ? 10_000_000 : exportSettings.quality === 'medium' ? 5_000_000 : 2_500_000

          // Pause and prepare for seeking
          if (targetVideo) targetVideo.pause()

          const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: { codec: 'avc', width: 1920, height: 1080 },
            fastStart: 'in-memory',
          })

          const encoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => console.error('VideoEncoder error:', e),
          })

          encoder.configure({
            codec: 'avc1.640028',
            width: 1920,
            height: 1080,
            bitrate,
            framerate: fps,
          })

          const frameDuration = 1_000_000 / fps

          for (let i = 0; i < totalFrames; i++) {
            const frameTime = (i / totalFrames) * targetDuration

            if (targetVideo) {
              await new Promise<void>((resolve) => {
                if (Math.abs(targetVideo.currentTime - frameTime) < 0.01) {
                  resolve()
                  return
                }
                const onSeeked = () => {
                  targetVideo.removeEventListener('seeked', onSeeked)
                  resolve()
                }
                targetVideo.addEventListener('seeked', onSeeked)
                targetVideo.currentTime = frameTime
              })
            }

            drawSingleMedia(targetMedia)

            const frame = new VideoFrame(captureCanvas, {
              timestamp: i * frameDuration,
              duration: frameDuration,
            })
            encoder.encode(frame, { keyFrame: i % 30 === 0 })
            frame.close()

            if (i % 5 === 0) {
              const progress = Math.round((i / totalFrames) * 90)
              setProgress(progress)
              setExportProgress({ status: 'encoding', progress, message: `Encoding frame ${i + 1}/${totalFrames}` })
            }
            if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
          }

          await encoder.flush()
          encoder.close()
          muxer.finalize()

          const { buffer } = muxer.target as ArrayBufferTarget
          const mp4Blob = new Blob([buffer], { type: 'video/mp4' })
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          downloadVideo(mp4Blob, `dualview-${exportSettings.exportSource}-${timestamp}.mp4`)
          setExportProgress({ status: 'done', progress: 100, message: 'Export complete!' })
          return
        }

        // Handle GIF export for single media
        if (exportSettings.format === 'gif') {
          const gifPreset = exportSettings.gifPreset || 'medium'
          const gifOptions = GIF_PRESETS[gifPreset]
          const totalFrames = Math.ceil(targetDuration * gifOptions.fps)
          const frames: ImageData[] = []

          if (targetVideo) targetVideo.pause()

          const gifCanvas = document.createElement('canvas')
          gifCanvas.width = gifOptions.width
          gifCanvas.height = gifOptions.height
          const gifCtx = gifCanvas.getContext('2d')!

          for (let i = 0; i < totalFrames; i++) {
            const frameTime = (i / totalFrames) * targetDuration

            if (targetVideo) {
              await new Promise<void>((resolve) => {
                if (Math.abs(targetVideo.currentTime - frameTime) < 0.01) {
                  resolve()
                  return
                }
                const onSeeked = () => {
                  targetVideo.removeEventListener('seeked', onSeeked)
                  resolve()
                }
                targetVideo.addEventListener('seeked', onSeeked)
                targetVideo.currentTime = frameTime
              })
            }

            drawSingleMedia(targetMedia)
            gifCtx.drawImage(captureCanvas, 0, 0, gifOptions.width, gifOptions.height)
            frames.push(gifCtx.getImageData(0, 0, gifOptions.width, gifOptions.height))

            if (i % 5 === 0) {
              setProgress(Math.round((i / totalFrames) * 40))
              setExportProgress({ status: 'encoding', progress: Math.round((i / totalFrames) * 40), message: `Capturing frame ${i + 1}/${totalFrames}` })
            }
            if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
          }

          // Load and encode GIF
          if (!(window as any).GIF) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script')
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
              script.onload = () => resolve()
              script.onerror = () => reject(new Error('Failed to load GIF encoder'))
              document.head.appendChild(script)
            })
          }

          const GIF = (window as any).GIF
          const gif = new GIF({
            workers: 2,
            quality: 10,
            width: gifOptions.width,
            height: gifOptions.height,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
          })

          const frameDelay = Math.round(1000 / gifOptions.fps)
          frames.forEach((frame) => gif.addFrame(frame, { delay: frameDelay }))

          const gifBlob = await new Promise<Blob>((resolve, reject) => {
            gif.on('progress', (p: number) => {
              setProgress(40 + Math.round(p * 60))
              setExportProgress({ status: 'encoding', progress: 40 + Math.round(p * 60), message: `Encoding GIF... ${Math.round(p * 100)}%` })
            })
            gif.on('finished', (blob: Blob) => resolve(blob))
            gif.on('error', (err: Error) => reject(err))
            gif.render()
          })

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          downloadVideo(gifBlob, `dualview-${exportSettings.exportSource}-${timestamp}.gif`)
          setExportProgress({ status: 'done', progress: 100, message: 'GIF export complete!' })
          return
        }

        // WebM export for single media (real-time)
        const stream = captureCanvas.captureStream(30)
        const mimeType = 'video/webm;codecs=vp9'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error('Video recording not supported')
        }

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: exportSettings.quality === 'high' ? 10_000_000 : exportSettings.quality === 'medium' ? 5_000_000 : 2_500_000,
        })

        const chunks: Blob[] = []
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }

        const recordingPromise = new Promise<Blob>((resolve) => {
          mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
        })

        if (targetVideo) {
          targetVideo.currentTime = 0
          targetVideo.play()
        }

        mediaRecorder.start(100)

        const totalDurationMs = targetDuration * 1000
        const startTime = performance.now()

        const animateSingle = () => {
          const elapsed = performance.now() - startTime
          const progressPct = elapsed / totalDurationMs

          if (progressPct >= 1) {
            if (targetVideo) targetVideo.pause()
            mediaRecorder.stop()
            return
          }

          drawSingleMedia(targetMedia)
          setProgress(Math.round(progressPct * 100))
          setExportProgress({ status: 'encoding', progress: Math.round(progressPct * 100), message: `Recording... ${Math.round(progressPct * 100)}%` })
          requestAnimationFrame(animateSingle)
        }

        setTimeout(animateSingle, 100)
        const webmBlob = await recordingPromise
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(webmBlob, `dualview-${exportSettings.exportSource}-${timestamp}.webm`)
        setExportProgress({ status: 'done', progress: 100, message: 'Export complete!' })
        return
      }

      // Set up canvas stream capture (for comparison/sweep export)
      const stream = captureCanvas.captureStream(30)

      const mimeType = 'video/webm;codecs=vp9'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('Video recording not supported')
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: exportSettings.quality === 'high' ? 10_000_000 : exportSettings.quality === 'medium' ? 5_000_000 : 2_500_000,
      })

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }
      })

      // Reset videos to start
      if (videoA) { videoA.currentTime = 0; videoA.play().catch(() => {}) }
      if (videoB) { videoB.currentTime = 0; videoB.play().catch(() => {}) }

      mediaRecorder.start(100)

      const totalDuration = loopDuration * exportSettings.videoLoops * 1000
      const loopDurationMs = loopDuration * 1000
      const startTime = performance.now()
      let lastLoopIndex = 0

      // Animation loop - render directly to canvas
      const animate = () => {
        const elapsed = performance.now() - startTime
        const progressPct = elapsed / totalDuration

        if (progressPct >= 1) {
          if (videoA) videoA.pause()
          if (videoB) videoB.pause()
          mediaRecorder.stop()
          return
        }

        // Check if we've crossed into a new loop - if so, restart videos
        const currentLoopIndex = Math.floor(elapsed / loopDurationMs)
        if (currentLoopIndex > lastLoopIndex) {
          lastLoopIndex = currentLoopIndex
          // Restart videos for the new loop and ensure they keep playing
          if (videoA) {
            videoA.currentTime = 0
            videoA.play().catch(() => {})
          }
          if (videoB) {
            videoB.currentTime = 0
            videoB.play().catch(() => {})
          }
        }

        // Sweep: multiple sweeps per video loop using sine wave
        const loopProgress = (elapsed % loopDurationMs) / loopDurationMs
        const sweepProgress = (loopProgress * exportSettings.sweepsPerLoop) % 1
        const sweepPos = Math.sin(sweepProgress * Math.PI) * 100

        // Draw the sweep frame directly to canvas (no React dependency)
        drawSweepFrame(sweepPos, exportSettings.sweepStyle)

        // Also update UI slider for visual feedback (only for horizontal mode)
        if (exportSettings.sweepStyle === 'horizontal') {
          setSliderPosition(sweepPos)
        }

        setProgress(Math.round(progressPct * 100))
        setExportProgress({ status: 'encoding', progress: Math.round(progressPct * 100), message: `Recording... ${Math.round(progressPct * 100)}%` })

        requestAnimationFrame(animate)
      }

      // Helper function to seek video and wait for it to be ready
      const seekVideoAndWait = async (video: HTMLVideoElement, time: number): Promise<void> => {
        return new Promise((resolve) => {
          if (Math.abs(video.currentTime - time) < 0.01) {
            resolve()
            return
          }
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
          video.currentTime = time
        })
      }

      // Handle MP4 export using WebCodecs + mp4-muxer
      if (exportSettings.format === 'mp4') {
        if (!isWebCodecsSupported()) {
          throw new Error('MP4 export requires a modern browser with WebCodecs support (Chrome, Edge)')
        }

        const fps = 30
        const totalExportDuration = loopDuration * exportSettings.videoLoops
        const totalFrames = Math.ceil(totalExportDuration * fps)
        const bitrate = exportSettings.quality === 'high' ? 10_000_000 : exportSettings.quality === 'medium' ? 5_000_000 : 2_500_000

        // Get individual video durations for looping
        const videoADuration = fileA?.duration || loopDuration
        const videoBDuration = fileB?.duration || loopDuration

        setExportProgress({ status: 'encoding', progress: 0, message: 'Initializing MP4 encoder...' })

        // Pause videos and prepare for seeking
        if (videoA) videoA.pause()
        if (videoB) videoB.pause()

        // Create muxer
        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: 1920,
            height: 1080,
          },
          fastStart: 'in-memory',
        })

        // Create video encoder
        let encodedFrames = 0
        const encoder = new VideoEncoder({
          output: (chunk, meta) => {
            muxer.addVideoChunk(chunk, meta)
            encodedFrames++
          },
          error: (e) => console.error('VideoEncoder error:', e),
        })

        encoder.configure({
          codec: 'avc1.640028',
          width: 1920,
          height: 1080,
          bitrate,
          framerate: fps,
        })

        const frameDuration = 1_000_000 / fps // microseconds

        // Encode frames - now with proper video seeking
        for (let i = 0; i < totalFrames; i++) {
          const frameProgress = i / totalFrames
          const currentTime = frameProgress * totalExportDuration

          // First, get time within the current sweep loop (videos restart each loop)
          const timeWithinLoop = currentTime % loopDuration

          // Seek videos to the correct time within the loop
          if (videoA) {
            // If video is shorter than loop, optionally loop it within the sweep
            const videoTimeA = (exportSettings.loopShorterVideo && videoADuration < loopDuration)
              ? timeWithinLoop % videoADuration
              : Math.min(timeWithinLoop, videoADuration - 0.001)
            await seekVideoAndWait(videoA, videoTimeA)
          }
          if (videoB) {
            const videoTimeB = (exportSettings.loopShorterVideo && videoBDuration < loopDuration)
              ? timeWithinLoop % videoBDuration
              : Math.min(timeWithinLoop, videoBDuration - 0.001)
            await seekVideoAndWait(videoB, videoTimeB)
          }

          // Calculate sweep position - multiple sweeps per video loop
          const loopProgress = timeWithinLoop / loopDuration // 0-1 within current video loop
          const sweepProgress = (loopProgress * exportSettings.sweepsPerLoop) % 1
          const sweepPos = Math.sin(sweepProgress * Math.PI) * 100

          // Draw the frame with current video positions
          drawSweepFrame(sweepPos, exportSettings.sweepStyle)

          // Create VideoFrame from canvas
          const frame = new VideoFrame(captureCanvas, {
            timestamp: i * frameDuration,
            duration: frameDuration,
          })

          encoder.encode(frame, { keyFrame: i % 30 === 0 })
          frame.close()

          if (i % 5 === 0) {
            const progress = Math.round((i / totalFrames) * 90)
            setProgress(progress)
            setExportProgress({
              status: 'encoding',
              progress,
              message: `Encoding frame ${i + 1}/${totalFrames}`
            })
          }

          // Small delay to prevent blocking and allow UI updates
          if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
        }

        setExportProgress({ status: 'encoding', progress: 95, message: 'Finalizing MP4...' })
        await encoder.flush()
        encoder.close()
        muxer.finalize()

        const { buffer } = muxer.target as ArrayBufferTarget
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(mp4Blob, `dualview-sweep-${timestamp}.mp4`)
        setExportProgress({ status: 'done', progress: 100, message: 'MP4 export complete!' })
        return
      }

      // Handle GIF export differently - capture frames directly
      if (exportSettings.format === 'gif') {
        const gifPreset = exportSettings.gifPreset || 'medium'
        const gifOptions = GIF_PRESETS[gifPreset]
        const totalExportDuration = loopDuration * exportSettings.videoLoops
        const totalFrames = Math.ceil(totalExportDuration * gifOptions.fps)
        const frames: ImageData[] = []

        // Get individual video durations for looping
        const videoADuration = fileA?.duration || loopDuration
        const videoBDuration = fileB?.duration || loopDuration

        setExportProgress({ status: 'encoding', progress: 0, message: 'Capturing frames for GIF...' })

        // Pause videos and prepare for seeking
        if (videoA) videoA.pause()
        if (videoB) videoB.pause()

        // Create smaller canvas for GIF
        const gifCanvas = document.createElement('canvas')
        gifCanvas.width = gifOptions.width
        gifCanvas.height = gifOptions.height
        const gifCtx = gifCanvas.getContext('2d')!

        // Capture frames - now with proper video seeking
        for (let i = 0; i < totalFrames; i++) {
          const frameProgress = i / totalFrames
          const currentTime = frameProgress * totalExportDuration

          // First, get time within the current sweep loop (videos restart each loop)
          const timeWithinLoop = currentTime % loopDuration

          // Seek videos to the correct time within the loop
          if (videoA) {
            // If video is shorter than loop, optionally loop it within the sweep
            const videoTimeA = (exportSettings.loopShorterVideo && videoADuration < loopDuration)
              ? timeWithinLoop % videoADuration
              : Math.min(timeWithinLoop, videoADuration - 0.001)
            await seekVideoAndWait(videoA, videoTimeA)
          }
          if (videoB) {
            const videoTimeB = (exportSettings.loopShorterVideo && videoBDuration < loopDuration)
              ? timeWithinLoop % videoBDuration
              : Math.min(timeWithinLoop, videoBDuration - 0.001)
            await seekVideoAndWait(videoB, videoTimeB)
          }

          // Calculate sweep position - multiple sweeps per video loop
          const loopProgress = timeWithinLoop / loopDuration // 0-1 within current video loop
          const sweepProgress = (loopProgress * exportSettings.sweepsPerLoop) % 1
          const sweepPos = Math.sin(sweepProgress * Math.PI) * 100

          // Draw the frame with current video positions
          drawSweepFrame(sweepPos, exportSettings.sweepStyle)

          // Scale down to GIF size
          gifCtx.drawImage(captureCanvas, 0, 0, gifOptions.width, gifOptions.height)
          frames.push(gifCtx.getImageData(0, 0, gifOptions.width, gifOptions.height))

          if (i % 5 === 0) {
            setProgress(Math.round((i / totalFrames) * 40))
            setExportProgress({
              status: 'encoding',
              progress: Math.round((i / totalFrames) * 40),
              message: `Capturing frame ${i + 1}/${totalFrames}`
            })
          }

          // Small delay to prevent blocking and allow UI updates
          if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
        }

        // Encode GIF using gif.js from CDN
        setExportProgress({ status: 'encoding', progress: 40, message: 'Loading GIF encoder...' })

        // Dynamically load gif.js
        if (!(window as any).GIF) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load GIF encoder'))
            document.head.appendChild(script)
          })
        }

        setExportProgress({ status: 'encoding', progress: 45, message: 'Encoding GIF...' })

        const GIF = (window as any).GIF
        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: gifOptions.width,
          height: gifOptions.height,
          workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
        })

        const frameDelay = Math.round(1000 / gifOptions.fps)
        frames.forEach((frame) => {
          gif.addFrame(frame, { delay: frameDelay })
        })

        const gifBlob = await new Promise<Blob>((resolve, reject) => {
          gif.on('progress', (p: number) => {
            setProgress(45 + Math.round(p * 55))
            setExportProgress({
              status: 'encoding',
              progress: 45 + Math.round(p * 55),
              message: `Encoding GIF... ${Math.round(p * 100)}%`
            })
          })
          gif.on('finished', (blob: Blob) => resolve(blob))
          gif.on('error', (err: Error) => reject(err))
          gif.render()
        })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(gifBlob, `dualview-sweep-${timestamp}.gif`)
        setExportProgress({ status: 'done', progress: 100, message: 'GIF export complete!' })
        return
      }

      // WebM export (default, fast)
      setTimeout(animate, 100)

      const webmBlob = await recordingPromise
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      downloadVideo(webmBlob, `dualview-sweep-${timestamp}.webm`)

      setExportProgress({ status: 'done', progress: 100, message: 'Export complete!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      setError(message)
      setExportProgress({ status: 'error', progress: 0, message })
    } finally {
      setIsExporting(false)
      setExporting(false) // Re-enable sync hooks
      setSliderPosition(50) // Reset slider
    }
  }

  const handleScreenshotExport = async (copyToClipboard = false) => {
    setIsExportingScreenshot(true)
    try {
      // Get resolution dimensions
      const resolutions = {
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
        '4k': { width: 3840, height: 2160 },
      }
      const { width, height } = resolutions[screenshotResolution]

      // Get video/image elements using data-track attributes
      const { videoA, videoB } = getVideoElements()
      const { imgA, imgB } = getImageElements()

      const mediaA = videoA || imgA
      const mediaB = videoB || imgB

      if (!mediaA && !mediaB) {
        throw new Error('No media to capture')
      }

      // Create canvas at target resolution
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!

      // Fill background
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)

      if (screenshotSource === 'a-only') {
        // Draw only media A
        if (mediaA) {
          ctx.drawImage(mediaA, 0, 0, width, height)
        }
      } else if (screenshotSource === 'b-only') {
        // Draw only media B
        if (mediaB) {
          ctx.drawImage(mediaB, 0, 0, width, height)
        }
      } else {
        // Comparison mode - draw with slider
        // Draw media B as background
        if (mediaB) {
          ctx.drawImage(mediaB, 0, 0, width, height)
        }

        // Draw media A with clip based on slider position
        if (mediaA) {
          const sliderX = (screenshotSliderPos / 100) * width
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, sliderX, height)
          ctx.clip()
          ctx.drawImage(mediaA, 0, 0, width, height)
          ctx.restore()

          // Draw slider line
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(sliderX - 1, 0, 2, height)
        }
      }

      // Convert to blob
      const mimeType = screenshotFormat === 'png' ? 'image/png' : 'image/jpeg'
      const quality = screenshotFormat === 'jpg' ? screenshotQuality / 100 : undefined

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          mimeType,
          quality
        )
      })

      if (copyToClipboard) {
        // Copy to clipboard
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [mimeType]: blob })
          ])
          setExportProgress({ status: 'done', progress: 100, message: 'Copied to clipboard!' })
        } catch (clipboardErr) {
          console.error('Clipboard write failed:', clipboardErr)
          // Fallback to download
          const filename = `dualview-${screenshotSource}-${Date.now()}.${screenshotFormat}`
          downloadBlob(blob, filename)
          setExportProgress({ status: 'done', progress: 100, message: 'Downloaded (clipboard not supported)' })
        }
      } else {
        const filename = `dualview-${screenshotSource}-${Date.now()}.${screenshotFormat}`
        downloadBlob(blob, filename)
        setExportProgress({ status: 'done', progress: 100, message: 'Screenshot saved!' })
      }
    } catch (err) {
      console.error('Screenshot export failed:', err)
      setError(err instanceof Error ? err.message : 'Screenshot failed')
    } finally {
      setIsExportingScreenshot(false)
    }
  }

  const handlePDFExport = async () => {
    if (!canvasRef.current) return

    setIsExportingPDF(true)
    try {
      // Capture screenshot first
      const screenshotBlob = await captureCanvasScreenshot(canvasRef.current, 'png')
      if (!screenshotBlob) throw new Error('Failed to capture screenshot')

      // Get media info
      const trackA = tracks.find(t => t.type === 'a')
      const trackB = tracks.find(t => t.type === 'b')
      const clipA = trackA?.clips[0]
      const clipB = trackB?.clips[0]
      const mediaA = clipA ? getFile(clipA.mediaId) : undefined
      const mediaB = clipB ? getFile(clipB.mediaId) : undefined

      const pdfBlob = await generatePDFReport({
        title: pdfTitle,
        includeMetadata,
        includeAnnotations: false,
        includeSettings,
        screenshotBlob,
        mediaA: mediaA ? {
          name: mediaA.name,
          type: mediaA.type,
          size: formatFileSize(mediaA.file.size),
          dimensions: mediaA.width && mediaA.height ? `${mediaA.width}×${mediaA.height}` : undefined,
        } : undefined,
        mediaB: mediaB ? {
          name: mediaB.name,
          type: mediaB.type,
          size: formatFileSize(mediaB.file.size),
          dimensions: mediaB.width && mediaB.height ? `${mediaB.width}×${mediaB.height}` : undefined,
        } : undefined,
        comparisonMode,
        metrics: {
          ssim: metricsSSIM ?? undefined,
          psnr: metricsPSNR ?? undefined,
        },
      })

      const filename = `dualview-report-${Date.now()}.pdf`
      downloadBlob(pdfBlob, filename)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setIsExportingPDF(false)
    }
  }

  // 3D Turntable Export Handler
  const handle3DExport = async () => {
    setIsExporting3D(true)
    setError(null)
    setProgress(0)

    try {
      // Get 3D model URLs from timeline
      const trackA = tracks.find(t => t.type === 'a')
      const trackB = tracks.find(t => t.type === 'b')
      const clipA = trackA?.clips[0]
      const clipB = trackB?.clips[0]
      const modelA = clipA ? getFile(clipA.mediaId) : null
      const modelB = clipB ? getFile(clipB.mediaId) : null

      // Filter to only 3D models
      const modelAUrl = modelA?.type === 'model' ? modelA.url : null
      const modelBUrl = modelB?.type === 'model' ? modelB.url : null

      if (!modelAUrl && !modelBUrl) {
        throw new Error('No 3D models loaded to export')
      }

      if (export3DSource === 'a-only' && !modelAUrl) {
        throw new Error('No 3D model in Track A')
      }
      if (export3DSource === 'b-only' && !modelBUrl) {
        throw new Error('No 3D model in Track B')
      }
      if (export3DSource === 'side-by-side' && (!modelAUrl || !modelBUrl)) {
        throw new Error('Both Track A and Track B need 3D models for side-by-side export')
      }

      // Determine canvas size based on export mode
      // Use square aspect ratio for single model, 2:1 for side-by-side
      const isSideBySide = export3DSource === 'side-by-side'
      const singleWidth = 1080  // Square for single model
      const singleHeight = 1080
      const canvasWidth = isSideBySide ? 1920 : singleWidth
      const canvasHeight = isSideBySide ? 1080 : singleHeight
      const viewportWidth = isSideBySide ? 960 : singleWidth

      setExportProgress({ status: 'encoding', progress: 0, message: 'Setting up 3D scene...' })

      // Helper to create a 3D scene for a model
      const createScene = async (modelUrl: string) => {
        const scene = new THREE.Scene()

        // Flat dark grey background
        scene.background = new THREE.Color(0x4a4a4a)

        // Ambient and directional lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.09)
        scene.add(ambientLight)

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.15)
        dirLight1.position.set(5, 8, 5)
        scene.add(dirLight1)

        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.08)
        dirLight2.position.set(-5, 5, -5)
        scene.add(dirLight2)

        // Load the model
        const loader = new GLTFLoader()
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(modelUrl, resolve, undefined, reject)
        })

        // Use SkeletonUtils.clone for proper skinned mesh support (characters with bones)
        const model = SkeletonUtils.clone(gltf.scene)

        // Calculate bounding box and center/scale model
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = maxDim > 0 ? 2 / maxDim : 1

        // Center and position the model, then add to rotation group
        model.position.set(-center.x, -box.min.y, -center.z)
        model.scale.setScalar(scale)

        const rotationGroup = new THREE.Group()
        rotationGroup.add(model)
        scene.add(rotationGroup)

        // Add lime grid floor
        const gridHelper = new THREE.GridHelper(10, 20, 0xcddc39, 0xb8cc24)
        scene.add(gridHelper)

        return { scene, rotationGroup }
      }

      // Create camera
      const camera = new THREE.PerspectiveCamera(45, viewportWidth / canvasHeight, 0.1, 1000)
      camera.position.set(3, 1.5, 3)
      camera.lookAt(0, 0.5, 0)

      // Create offscreen renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: false
      })
      renderer.setSize(canvasWidth, canvasHeight)
      renderer.setClearColor(0x1a1a2a)

      // Load scenes
      let sceneA: { scene: THREE.Scene; rotationGroup: THREE.Group } | null = null
      let sceneB: { scene: THREE.Scene; rotationGroup: THREE.Group } | null = null

      setExportProgress({ status: 'encoding', progress: 5, message: 'Loading 3D models...' })

      if (export3DSource === 'side-by-side' || export3DSource === 'a-only') {
        if (modelAUrl) sceneA = await createScene(modelAUrl)
      }
      if (export3DSource === 'side-by-side' || export3DSource === 'b-only') {
        if (modelBUrl) sceneB = await createScene(modelBUrl)
      }

      // Calculate total frames
      const totalFrames = Math.ceil(export3DRotations * (360 / 360) * export3DFps * 3) // 3 seconds per rotation
      const rotationPerFrame = (Math.PI * 2 * export3DRotations) / totalFrames

      setExportProgress({ status: 'encoding', progress: 10, message: 'Initializing encoder...' })

      // Handle MP4 export with WebCodecs
      if (export3DFormat === 'mp4') {
        if (!isWebCodecsSupported()) {
          throw new Error('MP4 export requires a modern browser with WebCodecs support (Chrome, Edge)')
        }

        const bitrate = export3DQuality === 'high' ? 10_000_000 : export3DQuality === 'medium' ? 5_000_000 : 2_500_000

        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: { codec: 'avc', width: canvasWidth, height: canvasHeight },
          fastStart: 'in-memory',
        })

        const encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (e) => console.error('VideoEncoder error:', e),
        })

        encoder.configure({
          codec: 'avc1.640028',
          width: canvasWidth,
          height: canvasHeight,
          bitrate,
          framerate: export3DFps,
        })

        const frameDuration = 1_000_000 / export3DFps

        // Render frames
        for (let i = 0; i < totalFrames; i++) {
          const rotation = i * rotationPerFrame

          // Clear the renderer
          renderer.setViewport(0, 0, canvasWidth, canvasHeight)
          renderer.clear()

          if (isSideBySide) {
            // Render model A on left half
            if (sceneA) {
              sceneA.rotationGroup.rotation.y = rotation
              renderer.setViewport(0, 0, viewportWidth, canvasHeight)
              renderer.setScissor(0, 0, viewportWidth, canvasHeight)
              renderer.setScissorTest(true)
              renderer.render(sceneA.scene, camera)
            }

            // Render model B on right half
            if (sceneB) {
              sceneB.rotationGroup.rotation.y = rotation
              renderer.setViewport(viewportWidth, 0, viewportWidth, canvasHeight)
              renderer.setScissor(viewportWidth, 0, viewportWidth, canvasHeight)
              renderer.setScissorTest(true)
              renderer.render(sceneB.scene, camera)
            }

            renderer.setScissorTest(false)

            // Draw divider line
            const ctx = renderer.domElement.getContext('2d')
            if (ctx) {
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(viewportWidth - 1, 0, 2, canvasHeight)
            }
          } else {
            // Single model export
            const targetScene = export3DSource === 'a-only' ? sceneA : sceneB
            if (targetScene) {
              targetScene.rotationGroup.rotation.y = rotation
              renderer.render(targetScene.scene, camera)
            }
          }

          // Create VideoFrame from renderer canvas
          const frame = new VideoFrame(renderer.domElement, {
            timestamp: i * frameDuration,
            duration: frameDuration,
          })
          encoder.encode(frame, { keyFrame: i % 30 === 0 })
          frame.close()

          if (i % 5 === 0) {
            const prog = 10 + Math.round((i / totalFrames) * 85)
            setProgress(prog)
            setExportProgress({ status: 'encoding', progress: prog, message: `Rendering frame ${i + 1}/${totalFrames}` })
          }

          if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
        }

        setExportProgress({ status: 'encoding', progress: 95, message: 'Finalizing MP4...' })
        await encoder.flush()
        encoder.close()
        muxer.finalize()

        const { buffer } = muxer.target as ArrayBufferTarget
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(mp4Blob, `dualview-3d-turntable-${export3DSource}-${timestamp}.mp4`)
      } else {
        // GIF export
        const gifPreset = 'medium'
        const gifOptions = GIF_PRESETS[gifPreset]
        const frames: ImageData[] = []

        const gifCanvas = document.createElement('canvas')
        gifCanvas.width = gifOptions.width
        gifCanvas.height = Math.round(gifOptions.width * (canvasHeight / canvasWidth))
        const gifCtx = gifCanvas.getContext('2d')!

        // Capture frames for GIF
        for (let i = 0; i < totalFrames; i++) {
          const rotation = i * rotationPerFrame

          renderer.setViewport(0, 0, canvasWidth, canvasHeight)
          renderer.clear()

          if (isSideBySide) {
            if (sceneA) {
              sceneA.rotationGroup.rotation.y = rotation
              renderer.setViewport(0, 0, viewportWidth, canvasHeight)
              renderer.setScissor(0, 0, viewportWidth, canvasHeight)
              renderer.setScissorTest(true)
              renderer.render(sceneA.scene, camera)
            }
            if (sceneB) {
              sceneB.rotationGroup.rotation.y = rotation
              renderer.setViewport(viewportWidth, 0, viewportWidth, canvasHeight)
              renderer.setScissor(viewportWidth, 0, viewportWidth, canvasHeight)
              renderer.setScissorTest(true)
              renderer.render(sceneB.scene, camera)
            }
            renderer.setScissorTest(false)
          } else {
            const targetScene = export3DSource === 'a-only' ? sceneA : sceneB
            if (targetScene) {
              targetScene.rotationGroup.rotation.y = rotation
              renderer.render(targetScene.scene, camera)
            }
          }

          gifCtx.drawImage(renderer.domElement, 0, 0, gifCanvas.width, gifCanvas.height)
          frames.push(gifCtx.getImageData(0, 0, gifCanvas.width, gifCanvas.height))

          if (i % 5 === 0) {
            const prog = 10 + Math.round((i / totalFrames) * 40)
            setProgress(prog)
            setExportProgress({ status: 'encoding', progress: prog, message: `Capturing frame ${i + 1}/${totalFrames}` })
          }

          if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
        }

        // Encode GIF
        setExportProgress({ status: 'encoding', progress: 50, message: 'Loading GIF encoder...' })

        if (!(window as any).GIF) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load GIF encoder'))
            document.head.appendChild(script)
          })
        }

        const GIF = (window as any).GIF
        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: gifCanvas.width,
          height: gifCanvas.height,
          workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
        })

        const frameDelay = Math.round(1000 / export3DFps)
        frames.forEach((frame) => gif.addFrame(frame, { delay: frameDelay }))

        const gifBlob = await new Promise<Blob>((resolve, reject) => {
          gif.on('progress', (p: number) => {
            setProgress(50 + Math.round(p * 50))
            setExportProgress({ status: 'encoding', progress: 50 + Math.round(p * 50), message: `Encoding GIF... ${Math.round(p * 100)}%` })
          })
          gif.on('finished', (blob: Blob) => resolve(blob))
          gif.on('error', (err: Error) => reject(err))
          gif.render()
        })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(gifBlob, `dualview-3d-turntable-${export3DSource}-${timestamp}.gif`)
      }

      // Cleanup
      renderer.dispose()
      if (sceneA) {
        sceneA.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })
      }
      if (sceneB) {
        sceneB.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })
      }

      setExportProgress({ status: 'done', progress: 100, message: '3D turntable export complete!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : '3D export failed'
      setError(message)
      setExportProgress({ status: 'error', progress: 0, message })
    } finally {
      setIsExporting3D(false)
    }
  }

  // Get available engines and variants for transition UI
  const transitionEngines = useMemo(() => getAllEngines(), [])
  const transitionVariants = useMemo(() => getAllVariants(transitionEngine), [transitionEngine])

  // Handle engine change - reset variant to first available
  const handleEngineChange = (engine: TransitionEngine) => {
    setTransitionEngine(engine)
    const variants = getAllVariants(engine)
    setTransitionVariant(variants[0] || 'crossfade')
  }

  // WebGL Transition Export Handler
  const handleTransitionExport = async () => {
    setIsExportingTransition(true)
    setExporting(true)
    setError(null)
    setProgress(0)

    try {
      // Get video/image elements
      const { videoA, videoB } = getVideoElements()
      const { imgA, imgB } = getImageElements()

      const mediaA = videoA || imgA
      const mediaB = videoB || imgB

      if (!mediaA || !mediaB) {
        throw new Error('Both media A and B are required for transition export')
      }

      // Check WebGL support
      if (!WebGLTransitionRenderer.isSupported()) {
        throw new Error('WebGL is not supported in this browser')
      }

      // Get media durations
      const trackA = tracks.find(t => t.type === 'a')
      const trackB = tracks.find(t => t.type === 'b')
      const clipA = trackA?.clips[0]
      const clipB = trackB?.clips[0]
      const fileA = clipA ? getFile(clipA.mediaId) : null
      const fileB = clipB ? getFile(clipB.mediaId) : null
      const durationA = fileA?.duration || 0
      const durationB = fileB?.duration || 0

      // Determine total export duration based on mode
      let totalDuration: number
      switch (transitionExportMode) {
        case 'sequential':
          // Full A + transition + Full B
          totalDuration = durationA + transitionDuration + durationB
          break
        case 'overlap':
          // Videos overlap during transition
          totalDuration = Math.max(durationA, durationB) + transitionDuration * 0.5
          break
        case 'loop':
          // A → B → A cycle
          totalDuration = (transitionDuration * 2) + Math.max(durationA, durationB)
          break
        case 'transition-only':
          // Just the transition
          totalDuration = transitionDuration
          break
        default:
          totalDuration = transitionDuration
      }

      // Ensure minimum duration
      if (totalDuration < 0.5) totalDuration = 0.5

      const fps = 30
      const totalFrames = Math.ceil(totalDuration * fps)
      const width = 1920
      const height = 1080

      setExportProgress({ status: 'encoding', progress: 0, message: 'Initializing WebGL...' })

      // Create WebGL renderer
      const renderer = new WebGLTransitionRenderer(width, height)

      // Load the selected shader
      const shaderLoaded = renderer.loadTransition(transitionEngine, transitionVariant)
      if (!shaderLoaded) {
        throw new Error(`Failed to load shader: ${transitionEngine}/${transitionVariant}`)
      }

      // Pause videos for seeking
      if (videoA) videoA.pause()
      if (videoB) videoB.pause()

      // Create capture canvas
      const captureCanvas = document.createElement('canvas')
      captureCanvas.width = width
      captureCanvas.height = height
      const ctx = captureCanvas.getContext('2d')!

      // Helper to seek video and wait
      const seekVideoAndWait = async (video: HTMLVideoElement, time: number): Promise<void> => {
        return new Promise((resolve) => {
          if (Math.abs(video.currentTime - time) < 0.01) {
            resolve()
            return
          }
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
          video.currentTime = Math.max(0, Math.min(time, video.duration - 0.001))
        })
      }

      // Helper to draw media to canvas
      const drawToCanvas = (source: HTMLVideoElement | HTMLImageElement) => {
        ctx.drawImage(source, 0, 0, width, height)
      }

      setExportProgress({ status: 'encoding', progress: 5, message: 'Starting encode...' })

      if (transitionFormat === 'mp4') {
        if (!isWebCodecsSupported()) {
          throw new Error('MP4 export requires WebCodecs support (Chrome, Edge)')
        }

        const bitrate = transitionQuality === 'high' ? 10_000_000 : transitionQuality === 'medium' ? 5_000_000 : 2_500_000

        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: { codec: 'avc', width, height },
          fastStart: 'in-memory',
        })

        const encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (e) => console.error('VideoEncoder error:', e),
        })

        encoder.configure({
          codec: 'avc1.640028',
          width,
          height,
          bitrate,
          framerate: fps,
        })

        const frameDuration = 1_000_000 / fps

        // Encode frames
        for (let i = 0; i < totalFrames; i++) {
          const currentTime = (i / totalFrames) * totalDuration
          let transitionProgress = 0
          let showA = true
          let showB = false
          let timeA = 0
          let timeB = 0

          // Calculate what to show based on export mode
          switch (transitionExportMode) {
            case 'sequential': {
              if (currentTime < durationA) {
                // Phase 1: Show A
                showA = true
                showB = false
                transitionProgress = 0
                timeA = currentTime
              } else if (currentTime < durationA + transitionDuration) {
                // Phase 2: Transition
                showA = true
                showB = true
                transitionProgress = (currentTime - durationA) / transitionDuration
                timeA = Math.min(durationA - 0.001, durationA)
                timeB = 0
              } else {
                // Phase 3: Show B
                showA = false
                showB = true
                transitionProgress = 1
                timeB = currentTime - durationA - transitionDuration
              }
              break
            }
            case 'overlap': {
              const midPoint = totalDuration / 2
              if (currentTime < midPoint - transitionDuration / 2) {
                showA = true
                showB = false
                transitionProgress = 0
                timeA = currentTime
              } else if (currentTime > midPoint + transitionDuration / 2) {
                showA = false
                showB = true
                transitionProgress = 1
                timeB = currentTime - (midPoint - transitionDuration / 2)
              } else {
                showA = true
                showB = true
                transitionProgress = (currentTime - (midPoint - transitionDuration / 2)) / transitionDuration
                timeA = currentTime
                timeB = currentTime - (midPoint - transitionDuration / 2)
              }
              break
            }
            case 'loop': {
              // A → transition → B → transition → loop
              const cycleTime = currentTime % (transitionDuration * 2 + 0.1)
              if (cycleTime < transitionDuration) {
                showA = true
                showB = true
                transitionProgress = cycleTime / transitionDuration
                timeA = 0
                timeB = 0
              } else {
                showA = true
                showB = true
                transitionProgress = 1 - (cycleTime - transitionDuration) / transitionDuration
                timeA = 0
                timeB = 0
              }
              break
            }
            case 'transition-only': {
              showA = true
              showB = true
              transitionProgress = currentTime / transitionDuration
              timeA = 0
              timeB = 0
              break
            }
          }

          // Seek videos if needed
          if (showA && videoA) {
            await seekVideoAndWait(videoA, timeA)
          }
          if (showB && videoB) {
            await seekVideoAndWait(videoB, timeB)
          }

          // Render frame
          if (showA && showB && transitionProgress > 0 && transitionProgress < 1) {
            // WebGL transition
            renderer.updateTexture('A', mediaA)
            renderer.updateTexture('B', mediaB)
            renderer.render(transitionProgress, transitionIntensity, currentTime)
            ctx.drawImage(renderer.getCanvas(), 0, 0)
          } else if (showB && (!showA || transitionProgress >= 1)) {
            // Show B only
            drawToCanvas(mediaB)
          } else {
            // Show A only
            drawToCanvas(mediaA)
          }

          // Encode frame
          const frame = new VideoFrame(captureCanvas, {
            timestamp: i * frameDuration,
            duration: frameDuration,
          })
          encoder.encode(frame, { keyFrame: i % 30 === 0 })
          frame.close()

          if (i % 5 === 0) {
            const prog = 5 + Math.round((i / totalFrames) * 90)
            setProgress(prog)
            setExportProgress({
              status: 'encoding',
              progress: prog,
              message: `Encoding frame ${i + 1}/${totalFrames}`
            })
          }

          if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
        }

        setExportProgress({ status: 'encoding', progress: 95, message: 'Finalizing MP4...' })
        await encoder.flush()
        encoder.close()
        muxer.finalize()

        const { buffer } = muxer.target as ArrayBufferTarget
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(mp4Blob, `dualview-transition-${transitionEngine}-${timestamp}.mp4`)

      } else {
        // GIF export
        const gifOptions = GIF_PRESETS.medium
        const gifFrames: ImageData[] = []

        const gifCanvas = document.createElement('canvas')
        gifCanvas.width = gifOptions.width
        gifCanvas.height = gifOptions.height
        const gifCtx = gifCanvas.getContext('2d')!

        const gifTotalFrames = Math.ceil(totalDuration * gifOptions.fps)

        for (let i = 0; i < gifTotalFrames; i++) {
          const currentTime = (i / gifTotalFrames) * totalDuration
          let transitionProgress = 0
          let showA = true
          let showB = false
          let timeA = 0
          let timeB = 0

          // Same logic as MP4 for calculating what to show
          switch (transitionExportMode) {
            case 'sequential': {
              if (currentTime < durationA) {
                showA = true; showB = false; transitionProgress = 0; timeA = currentTime
              } else if (currentTime < durationA + transitionDuration) {
                showA = true; showB = true
                transitionProgress = (currentTime - durationA) / transitionDuration
                timeA = durationA - 0.001; timeB = 0
              } else {
                showA = false; showB = true; transitionProgress = 1
                timeB = currentTime - durationA - transitionDuration
              }
              break
            }
            case 'transition-only': {
              showA = true; showB = true
              transitionProgress = currentTime / transitionDuration
              timeA = 0; timeB = 0
              break
            }
            default: {
              showA = true; showB = true
              transitionProgress = currentTime / totalDuration
              timeA = 0; timeB = 0
            }
          }

          if (showA && videoA) await seekVideoAndWait(videoA, timeA)
          if (showB && videoB) await seekVideoAndWait(videoB, timeB)

          if (showA && showB && transitionProgress > 0 && transitionProgress < 1) {
            renderer.updateTexture('A', mediaA)
            renderer.updateTexture('B', mediaB)
            renderer.render(transitionProgress, transitionIntensity, currentTime)
            ctx.drawImage(renderer.getCanvas(), 0, 0)
          } else if (showB && (!showA || transitionProgress >= 1)) {
            drawToCanvas(mediaB)
          } else {
            drawToCanvas(mediaA)
          }

          gifCtx.drawImage(captureCanvas, 0, 0, gifOptions.width, gifOptions.height)
          gifFrames.push(gifCtx.getImageData(0, 0, gifOptions.width, gifOptions.height))

          if (i % 5 === 0) {
            setProgress(5 + Math.round((i / gifTotalFrames) * 40))
            setExportProgress({
              status: 'encoding',
              progress: 5 + Math.round((i / gifTotalFrames) * 40),
              message: `Capturing frame ${i + 1}/${gifTotalFrames}`
            })
          }
          if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
        }

        // Encode GIF
        setExportProgress({ status: 'encoding', progress: 50, message: 'Encoding GIF...' })

        if (!(window as any).GIF) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load GIF encoder'))
            document.head.appendChild(script)
          })
        }

        const GIF = (window as any).GIF
        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: gifOptions.width,
          height: gifOptions.height,
          workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
        })

        const frameDelay = Math.round(1000 / gifOptions.fps)
        gifFrames.forEach((frame) => gif.addFrame(frame, { delay: frameDelay }))

        const gifBlob = await new Promise<Blob>((resolve, reject) => {
          gif.on('progress', (p: number) => {
            setProgress(50 + Math.round(p * 50))
            setExportProgress({
              status: 'encoding',
              progress: 50 + Math.round(p * 50),
              message: `Encoding GIF... ${Math.round(p * 100)}%`
            })
          })
          gif.on('finished', (blob: Blob) => resolve(blob))
          gif.on('error', (err: Error) => reject(err))
          gif.render()
        })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadVideo(gifBlob, `dualview-transition-${transitionEngine}-${timestamp}.gif`)
      }

      // Cleanup
      renderer.dispose()

      setExportProgress({ status: 'done', progress: 100, message: 'Transition export complete!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transition export failed'
      setError(message)
      setExportProgress({ status: 'error', progress: 0, message })
    } finally {
      setIsExportingTransition(false)
      setExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-surface border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Export Comparison
        </h2>

        {/* Zeigarnik Effect - Readiness indicator */}
        {(() => {
          const trackA = tracks.find(t => t.type === 'a')
          const trackB = tracks.find(t => t.type === 'b')
          const hasMediaA = trackA && trackA.clips.length > 0
          const hasMediaB = trackB && trackB.clips.length > 0
          const isReady = hasMediaA || hasMediaB

          if (!isReady) {
            return (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/30 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="text-sm text-warning">Add media to Track A or B to export</span>
              </div>
            )
          }

          if (!hasMediaA || !hasMediaB) {
            return (
              <div className="mb-4 p-2 bg-surface-alt border border-border flex items-center gap-3 text-xs">
                <div className={`flex items-center gap-1 ${hasMediaA ? 'text-accent' : 'text-text-muted'}`}>
                  <div className={`w-2 h-2 rounded-full ${hasMediaA ? 'bg-accent' : 'bg-border'}`} />
                  <span>Media A</span>
                </div>
                <div className={`flex items-center gap-1 ${hasMediaB ? 'text-secondary' : 'text-text-muted'}`}>
                  <div className={`w-2 h-2 rounded-full ${hasMediaB ? 'bg-secondary' : 'bg-border'}`} />
                  <span>Media B</span>
                </div>
                <span className="text-text-muted ml-auto">Single media export available</span>
              </div>
            )
          }

          return (
            <div className="mb-4 p-2 bg-accent/10 border border-accent/30 flex items-center gap-2 text-xs">
              <Check className="w-4 h-4 text-accent" />
              <span className="text-accent font-medium">Ready to export comparison</span>
            </div>
          )
        })()}

        {/* Export mode tabs */}
        <div className="grid grid-cols-6 gap-1 border-b border-border mb-4 pb-1">
          <button
            className={`py-2 px-1 text-xs font-medium transition-colors flex items-center justify-center gap-1 rounded-t ${
              exportMode === 'video'
                ? 'text-text-primary bg-surface-alt border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt/50'
            }`}
            onClick={() => setExportMode('video')}
          >
            <Download className="w-3.5 h-3.5" />
            Video
          </button>
          <button
            className={`py-2 px-1 text-xs font-medium transition-colors flex items-center justify-center gap-1 rounded-t ${
              exportMode === 'stitch'
                ? 'text-text-primary bg-surface-alt border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt/50'
            }`}
            onClick={() => setExportMode('stitch')}
            title="Stitch clips into a single video"
          >
            <Layers className="w-3.5 h-3.5" />
            Stitch
          </button>
          <button
            className={`py-2 px-1 text-xs font-medium transition-colors flex items-center justify-center gap-1 rounded-t ${
              exportMode === 'transition'
                ? 'text-text-primary bg-surface-alt border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt/50'
            }`}
            onClick={() => setExportMode('transition')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            FX
          </button>
          <button
            className={`py-2 px-1 text-xs font-medium transition-colors flex items-center justify-center gap-1 rounded-t ${
              exportMode === 'screenshot'
                ? 'text-text-primary bg-surface-alt border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt/50'
            }`}
            onClick={() => setExportMode('screenshot')}
          >
            <Camera className="w-3.5 h-3.5" />
            Image
          </button>
          <button
            className={`py-2 px-1 text-xs font-medium transition-colors flex items-center justify-center gap-1 rounded-t ${
              exportMode === '3d'
                ? 'text-text-primary bg-surface-alt border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt/50'
            }`}
            onClick={() => setExportMode('3d')}
          >
            <Box className="w-3.5 h-3.5" />
            3D
          </button>
          <button
            className={`py-2 px-1 text-xs font-medium transition-colors flex items-center justify-center gap-1 rounded-t ${
              exportMode === 'pdf'
                ? 'text-text-primary bg-surface-alt border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt/50'
            }`}
            onClick={() => setExportMode('pdf')}
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>

        <div className="space-y-4">
          {/* Video/GIF Export */}
          {exportMode === 'video' && (
            <>
              {/* Export Source Selection */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Export Source</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'comparison', label: 'Comparison' },
                    { value: 'a-only', label: 'A Only' },
                    { value: 'b-only', label: 'B Only' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExportSettings({ exportSource: option.value as ExportSource })}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        exportSettings.exportSource === option.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider Position - only for comparison mode */}
              {exportSettings.exportSource === 'comparison' && comparisonMode === 'slider' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Slider Position: {exportSettings.sliderPosition}%
                  </label>
                  <Slider
                    value={exportSettings.sliderPosition}
                    onChange={(e) => setExportSettings({ sliderPosition: Number(e.target.value) })}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>Full A</span>
                    <span>50/50</span>
                    <span>Full B</span>
                  </div>
                </div>
              )}

              {/* Loop shorter video option */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSettings.loopShorterVideo}
                  onChange={(e) => setExportSettings({ loopShorterVideo: e.target.checked })}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-text-primary">Loop shorter video to match longer</span>
              </label>

              {/* Sweep Settings for Comparison Export */}
              {exportSettings.exportSource === 'comparison' && (
                <>
                  {/* Sweep Style */}
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Sweep Style</label>
                    <div className="grid grid-cols-7 gap-1">
                      {[
                        { value: 'horizontal', label: '↔', title: 'Horizontal' },
                        { value: 'vertical', label: '↕', title: 'Vertical' },
                        { value: 'diagonal', label: '⤡', title: 'Diagonal' },
                        { value: 'circle', label: '◯', title: 'Circle' },
                        { value: 'rectangle', label: '▢', title: 'Rectangle' },
                        { value: 'spotlight', label: '◎', title: 'Spotlight Rect' },
                        { value: 'spotlight-circle', label: '●', title: 'Spotlight Circle' },
                      ].map((style) => (
                        <button
                          key={style.value}
                          onClick={() => setExportSettings({ sweepStyle: style.value as SweepStyle })}
                          title={style.title}
                          className={`px-2 py-2 text-lg border transition-colors ${
                            exportSettings.sweepStyle === style.value
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border text-text-secondary hover:border-text-muted'
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {exportSettings.sweepStyle === 'horizontal' && 'Left ↔ Right sweep'}
                      {exportSettings.sweepStyle === 'vertical' && 'Top ↔ Bottom sweep'}
                      {exportSettings.sweepStyle === 'diagonal' && 'Diagonal corner sweep'}
                      {exportSettings.sweepStyle === 'circle' && 'Expanding circle from center'}
                      {exportSettings.sweepStyle === 'rectangle' && 'Growing rectangle from center'}
                      {exportSettings.sweepStyle === 'spotlight' && 'Bouncing spotlight rectangle'}
                      {exportSettings.sweepStyle === 'spotlight-circle' && 'Bouncing spotlight circle'}
                    </p>
                  </div>

                  {/* Spotlight Size Controls */}
                  {(exportSettings.sweepStyle === 'spotlight' || exportSettings.sweepStyle === 'spotlight-circle') && (
                    <div className="space-y-3 p-3 bg-surface-alt border border-border rounded">
                      {exportSettings.sweepStyle === 'spotlight' ? (
                        <>
                          <div>
                            <label className="block text-xs text-text-secondary mb-1">
                              Width: {Math.round(exportSettings.spotlightWidth * 100)}%
                            </label>
                            <Slider
                              value={exportSettings.spotlightWidth * 100}
                              onChange={(e) => setExportSettings({ spotlightWidth: Number(e.target.value) / 100 })}
                              min={10}
                              max={90}
                              step={5}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-text-secondary mb-1">
                              Height: {Math.round(exportSettings.spotlightHeight * 100)}%
                            </label>
                            <Slider
                              value={exportSettings.spotlightHeight * 100}
                              onChange={(e) => setExportSettings({ spotlightHeight: Number(e.target.value) / 100 })}
                              min={10}
                              max={90}
                              step={5}
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-xs text-text-secondary mb-1">
                            Size: {Math.round(((exportSettings.spotlightWidth + exportSettings.spotlightHeight) / 2) * 100)}%
                          </label>
                          <Slider
                            value={((exportSettings.spotlightWidth + exportSettings.spotlightHeight) / 2) * 100}
                            onChange={(e) => {
                              const val = Number(e.target.value) / 100
                              setExportSettings({ spotlightWidth: val, spotlightHeight: val })
                            }}
                            min={10}
                            max={90}
                            step={5}
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">
                          Speed: {exportSettings.spotlightSpeed.toFixed(1)}x
                        </label>
                        <Slider
                          value={exportSettings.spotlightSpeed * 10}
                          onChange={(e) => setExportSettings({ spotlightSpeed: Number(e.target.value) / 10 })}
                          min={1}
                          max={50}
                          step={1}
                        />
                        <div className="flex justify-between text-[10px] text-text-muted mt-1">
                          <span>Very Slow</span>
                          <span>Fast</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Video Loops and Sweeps per Loop */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-secondary mb-2">
                        Video Loops: {exportSettings.videoLoops}
                      </label>
                      <Slider
                        value={exportSettings.videoLoops}
                        onChange={(e) => setExportSettings({ videoLoops: Number(e.target.value) })}
                        min={1}
                        max={10}
                        step={1}
                      />
                      <p className="text-[10px] text-text-muted mt-1">Times video plays</p>
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-2">
                        Sweeps per Loop: {exportSettings.sweepsPerLoop}
                      </label>
                      <Slider
                        value={exportSettings.sweepsPerLoop}
                        onChange={(e) => setExportSettings({ sweepsPerLoop: Number(e.target.value) })}
                        min={1}
                        max={10}
                        step={1}
                      />
                      <p className="text-[10px] text-text-muted mt-1">Sweeps per video</p>
                    </div>
                  </div>
                </>
              )}

              {/* Format Selection */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'webm', label: 'WebM' },
                    { value: 'mp4', label: 'MP4' },
                    { value: 'gif', label: 'GIF' },
                  ].map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => setExportSettings({ format: fmt.value as 'webm' | 'mp4' | 'gif' })}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        exportSettings.format === fmt.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {exportSettings.format === 'webm' && 'Fastest export, modern browsers'}
                  {exportSettings.format === 'mp4' && 'Universal compatibility, hardware accelerated'}
                  {exportSettings.format === 'gif' && 'Animated image, works everywhere'}
                </p>
              </div>

              {/* GIF Preset - only show for GIF format */}
              {exportSettings.format === 'gif' && (
                <Select
                  label="GIF Size"
                  value={exportSettings.gifPreset || 'medium'}
                  onChange={(e) => setExportSettings({ gifPreset: e.target.value as 'small' | 'medium' | 'large' | 'hd' })}
                  options={[
                    { value: 'small', label: 'Small (320px, 10fps)' },
                    { value: 'medium', label: 'Medium (480px, 12fps)' },
                    { value: 'large', label: 'Large (640px, 15fps)' },
                    { value: 'hd', label: 'HD (854px, 15fps)' },
                  ]}
                />
              )}

              {/* Quality - only show for video formats */}
              {exportSettings.format !== 'gif' && (
                <Select
                  label="Quality"
                  value={exportSettings.quality}
                  onChange={(e) => setExportSettings({ quality: e.target.value as 'low' | 'medium' | 'high' })}
                  options={[
                    { value: 'low', label: 'Low (faster, smaller file)' },
                    { value: 'medium', label: 'Medium (balanced)' },
                    { value: 'high', label: 'High (best quality)' },
                  ]}
                />
              )}

          {/* Progress with stages */}
          {isExporting && (
            <div className="space-y-3 p-4 bg-surface-alt border border-border">
              {/* Stage indicators */}
              <div className="flex items-center justify-between text-xs">
                <span className={`px-2 py-1 ${progress >= 0 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                  1. Preparing
                </span>
                <div className="flex-1 h-px bg-border mx-2" />
                <span className={`px-2 py-1 ${progress >= 30 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                  2. {exportSettings.format === 'gif' ? 'Capturing' : 'Encoding'}
                </span>
                <div className="flex-1 h-px bg-border mx-2" />
                <span className={`px-2 py-1 ${progress >= 90 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                  3. Finishing
                </span>
              </div>

              {/* Progress bar with Goal-Gradient Effect */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{exportProgress.message}</span>
                  <span className={`font-medium transition-all ${progress >= 90 ? 'text-secondary scale-110' : 'text-accent'}`}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 bg-background overflow-hidden relative">
                  {/* Animated gradient bar - speeds up visually near end */}
                  <div
                    className={`h-full bg-gradient-to-r from-accent via-accent to-secondary transition-all ${
                      progress >= 90 ? 'duration-150' : progress >= 70 ? 'duration-200' : 'duration-300'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                  {/* Shimmer effect when near completion */}
                  {progress >= 80 && progress < 100 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  )}
                </div>
                {/* Encouragement text near completion */}
                {progress >= 85 && progress < 100 && (
                  <p className="text-xs text-secondary animate-pulse">Almost there!</p>
                )}
              </div>
            </div>
          )}

          {/* Success state - Peak-End Rule: Celebrate the completion! */}
          {exportProgress.status === 'done' && (
            <div className="relative p-6 bg-gradient-to-br from-accent/20 via-accent/10 to-secondary/10 border border-accent/40 text-center space-y-4 overflow-hidden">
              {/* Celebration particles */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 left-4 w-2 h-2 bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="absolute top-4 right-8 w-1.5 h-1.5 bg-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="absolute bottom-6 left-12 w-1 h-1 bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                <div className="absolute top-8 left-1/4 w-1.5 h-1.5 bg-secondary animate-bounce" style={{ animationDelay: '100ms' }} />
                <div className="absolute bottom-4 right-1/4 w-2 h-2 bg-accent animate-bounce" style={{ animationDelay: '200ms' }} />
              </div>

              {/* Success icon with glow */}
              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto bg-accent/20 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(255,87,34,0.4)]">
                  <Check className="w-8 h-8 text-accent" strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-text-primary">Export Complete!</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Your {exportSettings.format.toUpperCase()} is ready in your downloads folder
                </p>
              </div>

              {/* Quick actions */}
              <div className="relative z-10 flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-accent text-white hover:bg-accent-hover transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    setExportProgress({ status: 'idle', progress: 0 })
                    setProgress(0)
                  }}
                  className="px-4 py-2 text-sm border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
                >
                  Export Another
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-error text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isExporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export
                </>
              )}
            </Button>
          </div>
            </>
          )}

          {/* Transition Export */}
          {exportMode === 'transition' && (
            <>
              {/* Header with shader count */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">
                  {getTotalShaderCount()} transition effects available
                </span>
                {!WebGLTransitionRenderer.isSupported() && (
                  <span className="text-xs text-error">WebGL not supported</span>
                )}
              </div>

              {/* Export Mode Selection */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Export Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'sequential', label: 'A → T → B', desc: 'Full A, then transition, then full B' },
                    { value: 'overlap', label: 'Overlap', desc: 'Videos overlap during transition' },
                    { value: 'loop', label: 'Loop A↔B', desc: 'Continuous A↔B transitions' },
                    { value: 'transition-only', label: 'Trans Only', desc: 'Just the transition effect' },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setTransitionExportMode(mode.value as TransitionExportMode)}
                      title={mode.desc}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        transitionExportMode === mode.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transition Engine Selection */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Effect Category</label>
                <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                  {transitionEngines.map((engine) => (
                    <button
                      key={engine.id}
                      onClick={() => handleEngineChange(engine.id)}
                      title={engine.description}
                      className={`px-2 py-1.5 text-xs border transition-colors flex flex-col items-center ${
                        transitionEngine === engine.id
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      <span className="text-base">{engine.icon}</span>
                      <span className="truncate w-full text-center">{engine.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant Selection */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Variant ({transitionVariants.length} options)
                </label>
                <div className="grid grid-cols-4 gap-1 max-h-24 overflow-y-auto">
                  {transitionVariants.map((variant) => {
                    const shader = getShader(transitionEngine, variant)
                    return (
                      <button
                        key={variant}
                        onClick={() => setTransitionVariant(variant)}
                        className={`px-2 py-1 text-xs border transition-colors truncate ${
                          transitionVariant === variant
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border text-text-secondary hover:border-text-muted'
                        }`}
                      >
                        {shader?.label || variant}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Transition Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Duration: {transitionDuration.toFixed(1)}s
                  </label>
                  <Slider
                    value={transitionDuration * 10}
                    onChange={(e) => setTransitionDuration(Number(e.target.value) / 10)}
                    min={5}
                    max={50}
                    step={1}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Intensity: {Math.round(transitionIntensity * 100)}%
                  </label>
                  <Slider
                    value={transitionIntensity * 100}
                    onChange={(e) => setTransitionIntensity(Number(e.target.value) / 100)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mp4', label: 'MP4' },
                    { value: 'gif', label: 'GIF' },
                  ].map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => setTransitionFormat(fmt.value as 'mp4' | 'gif')}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        transitionFormat === fmt.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality - only for MP4 */}
              {transitionFormat === 'mp4' && (
                <Select
                  label="Quality"
                  value={transitionQuality}
                  onChange={(e) => setTransitionQuality(e.target.value as 'low' | 'medium' | 'high')}
                  options={[
                    { value: 'low', label: 'Low (faster, smaller file)' },
                    { value: 'medium', label: 'Medium (balanced)' },
                    { value: 'high', label: 'High (best quality)' },
                  ]}
                />
              )}

              {/* Progress */}
              {isExportingTransition && (
                <div className="space-y-3 p-4 bg-surface-alt border border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 ${progress >= 0 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                      1. Initialize
                    </span>
                    <div className="flex-1 h-px bg-border mx-2" />
                    <span className={`px-2 py-1 ${progress >= 10 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                      2. Rendering
                    </span>
                    <div className="flex-1 h-px bg-border mx-2" />
                    <span className={`px-2 py-1 ${progress >= 90 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                      3. Encode
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{exportProgress.message}</span>
                      <span className={`font-medium ${progress >= 90 ? 'text-secondary' : 'text-accent'}`}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="h-2 bg-background overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent via-accent to-secondary transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Success state */}
              {exportProgress.status === 'done' && exportMode === 'transition' && (
                <div className="p-6 bg-gradient-to-br from-accent/20 via-accent/10 to-secondary/10 border border-accent/40 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-accent/20 flex items-center justify-center mb-3">
                    <Check className="w-8 h-8 text-accent" strokeWidth={3} />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary">Transition Export Complete!</h3>
                  <p className="text-sm text-text-secondary">
                    Your {transitionFormat.toUpperCase()} with {transitionEngine}/{transitionVariant} effect is ready
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm bg-accent text-white hover:bg-accent-hover transition-colors"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => {
                        setExportProgress({ status: 'idle', progress: 0 })
                        setProgress(0)
                      }}
                      className="px-4 py-2 text-sm border border-border text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Export Another
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-error text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose} disabled={isExportingTransition}>
                  Cancel
                </Button>
                <Button
                  onClick={handleTransitionExport}
                  disabled={isExportingTransition || !WebGLTransitionRenderer.isSupported()}
                >
                  {isExportingTransition ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Export FX
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Screenshot Export */}
          {exportMode === 'screenshot' && (
            <>
              {/* Export Source */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Export Source</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'comparison', label: 'Comparison' },
                    { value: 'a-only', label: 'A Only' },
                    { value: 'b-only', label: 'B Only' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setScreenshotSource(option.value as 'comparison' | 'a-only' | 'b-only')}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        screenshotSource === option.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider Position - only for comparison */}
              {screenshotSource === 'comparison' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Slider Position: {screenshotSliderPos}%
                  </label>
                  <Slider
                    value={screenshotSliderPos}
                    onChange={(e) => setScreenshotSliderPos(Number(e.target.value))}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>Full A</span>
                    <span>50/50</span>
                    <span>Full B</span>
                  </div>
                </div>
              )}

              {/* Resolution */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Resolution</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: '720p', label: '720p', desc: '1280×720' },
                    { value: '1080p', label: '1080p', desc: '1920×1080' },
                    { value: '4k', label: '4K', desc: '3840×2160' },
                  ].map((res) => (
                    <button
                      key={res.value}
                      onClick={() => setScreenshotResolution(res.value as '720p' | '1080p' | '4k')}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        screenshotResolution === res.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      <div className="font-medium">{res.label}</div>
                      <div className="text-xs opacity-70">{res.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <Select
                label="Format"
                value={screenshotFormat}
                onChange={(e) => setScreenshotFormat(e.target.value as 'png' | 'jpg')}
                options={[
                  { value: 'png', label: 'PNG (lossless)' },
                  { value: 'jpg', label: 'JPEG (smaller file)' },
                ]}
              />

              {/* Quality - only for JPEG */}
              {screenshotFormat === 'jpg' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Quality: {screenshotQuality}%
                  </label>
                  <Slider
                    value={screenshotQuality}
                    onChange={(e) => setScreenshotQuality(Number(e.target.value))}
                    min={10}
                    max={100}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-1">
                    <span>Smaller file</span>
                    <span>Better quality</span>
                  </div>
                </div>
              )}

              {/* Status message */}
              {exportProgress.status === 'done' && exportProgress.message && (
                <div className="flex items-center gap-2 text-green-500 text-sm">
                  <Check className="w-4 h-4" />
                  <span>{exportProgress.message}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-error text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleScreenshotExport(true)}
                  disabled={isExportingScreenshot}
                >
                  <Clipboard className="w-4 h-4" />
                  Copy
                </Button>
                <Button onClick={() => handleScreenshotExport(false)} disabled={isExportingScreenshot}>
                  {isExportingScreenshot ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Capturing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* 3D Turntable Export */}
          {exportMode === '3d' && (
            <>
              {/* Export Source */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Export Source</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'side-by-side', label: 'Side by Side' },
                    { value: 'a-only', label: 'A Only' },
                    { value: 'b-only', label: 'B Only' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExport3DSource(option.value as 'side-by-side' | 'a-only' | 'b-only')}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        export3DSource === option.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {export3DSource === 'side-by-side' && 'Both models rotate together in split view'}
                  {export3DSource === 'a-only' && 'Only Model A rotating'}
                  {export3DSource === 'b-only' && 'Only Model B rotating'}
                </p>
              </div>

              {/* Rotations */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Full Rotations: {export3DRotations}
                </label>
                <Slider
                  value={export3DRotations}
                  onChange={(e) => setExport3DRotations(Number(e.target.value))}
                  min={1}
                  max={5}
                  step={1}
                />
                <p className="text-xs text-text-muted mt-1">
                  Duration: ~{export3DRotations * 3} seconds
                </p>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mp4', label: 'MP4' },
                    { value: 'gif', label: 'GIF' },
                  ].map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => setExport3DFormat(fmt.value as 'mp4' | 'gif')}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        export3DFormat === fmt.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality - only for MP4 */}
              {export3DFormat === 'mp4' && (
                <Select
                  label="Quality"
                  value={export3DQuality}
                  onChange={(e) => setExport3DQuality(e.target.value as 'low' | 'medium' | 'high')}
                  options={[
                    { value: 'low', label: 'Low (faster, smaller file)' },
                    { value: 'medium', label: 'Medium (balanced)' },
                    { value: 'high', label: 'High (best quality)' },
                  ]}
                />
              )}

              {/* FPS */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Frame Rate: {export3DFps} fps
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[24, 30, 60].map((fps) => (
                    <button
                      key={fps}
                      onClick={() => setExport3DFps(fps)}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        export3DFps === fps
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {fps} fps
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              {isExporting3D && (
                <div className="space-y-3 p-4 bg-surface-alt border border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 ${progress >= 0 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                      1. Setup
                    </span>
                    <div className="flex-1 h-px bg-border mx-2" />
                    <span className={`px-2 py-1 ${progress >= 10 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                      2. Rendering
                    </span>
                    <div className="flex-1 h-px bg-border mx-2" />
                    <span className={`px-2 py-1 ${progress >= 90 ? 'bg-accent text-white' : 'bg-border text-text-muted'}`}>
                      3. Encoding
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{exportProgress.message}</span>
                      <span className={`font-medium ${progress >= 90 ? 'text-secondary' : 'text-accent'}`}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="h-2 bg-background overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent via-accent to-secondary transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Success state */}
              {exportProgress.status === 'done' && exportMode === '3d' && (
                <div className="p-6 bg-gradient-to-br from-accent/20 via-accent/10 to-secondary/10 border border-accent/40 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-accent/20 flex items-center justify-center mb-3">
                    <Check className="w-8 h-8 text-accent" strokeWidth={3} />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary">3D Export Complete!</h3>
                  <p className="text-sm text-text-secondary">
                    Your turntable video is ready in your downloads folder
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm bg-accent text-white hover:bg-accent-hover transition-colors"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => {
                        setExportProgress({ status: 'idle', progress: 0 })
                        setProgress(0)
                      }}
                      className="px-4 py-2 text-sm border border-border text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Export Another
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-error text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose} disabled={isExporting3D}>
                  Cancel
                </Button>
                <Button onClick={handle3DExport} disabled={isExporting3D}>
                  {isExporting3D ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Box className="w-4 h-4" />
                      Export 3D
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Stitch Export - Combine clips into single video */}
          {exportMode === 'stitch' && (
            <>
              {/* Track Selection */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Source Track</label>
                <div className="grid grid-cols-2 gap-2">
                  {tracks.filter(t => t.type === 'a' || t.type === 'b').map((track) => {
                    const trackInfo = getTrackExportInfo(track, getFile)
                    return (
                      <button
                        key={track.id}
                        onClick={() => setStitchTrackId(track.id)}
                        className={`p-3 text-left border transition-colors ${
                          stitchTrackId === track.id
                            ? 'border-accent bg-accent/10'
                            : 'border-border hover:border-text-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-3 h-3 rounded ${track.type === 'a' ? 'bg-orange-500' : 'bg-lime-400'}`} />
                          <span className="text-sm font-medium text-text-primary">{track.name}</span>
                        </div>
                        <div className="text-xs text-text-muted">
                          {trackInfo.clipCount} clip{trackInfo.clipCount !== 1 ? 's' : ''} • {formatTime(trackInfo.totalDuration)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Clip Preview */}
              {(() => {
                const selectedTrack = tracks.find(t => t.id === stitchTrackId)
                if (!selectedTrack) return null
                const trackInfo = getTrackExportInfo(selectedTrack, getFile)

                if (trackInfo.clipCount === 0) {
                  return (
                    <div className="p-4 bg-surface-alt border border-border text-center">
                      <Film className="w-8 h-8 mx-auto text-text-muted mb-2" />
                      <p className="text-sm text-text-secondary">No clips on this track</p>
                      <p className="text-xs text-text-muted mt-1">Add clips to the timeline to export</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    <label className="block text-sm text-text-secondary">Clips to Stitch ({trackInfo.clipCount})</label>
                    <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-surface-alt border border-border">
                      {trackInfo.clips.map((clip, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-text-muted w-5">{i + 1}.</span>
                          <Film className="w-3 h-3 text-text-muted" />
                          <span className="text-text-primary truncate flex-1">{clip.name}</span>
                          <span className="text-text-muted">{formatTime(clip.duration)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-text-muted text-right">
                      Total: {formatTime(trackInfo.totalDuration)}
                    </div>
                  </div>
                )
              })()}

              {/* Resolution */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Resolution</label>
                <div className="grid grid-cols-3 gap-2">
                  {['720p', '1080p', '4k'].map((res) => (
                    <button
                      key={res}
                      onClick={() => setStitchResolution(res as '720p' | '1080p' | '4k')}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        stitchResolution === res
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'low', label: 'Low', desc: '2 Mbps' },
                    { value: 'medium', label: 'Medium', desc: '5 Mbps' },
                    { value: 'high', label: 'High', desc: '10 Mbps' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStitchQuality(opt.value as 'low' | 'medium' | 'high')}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        stitchQuality === opt.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[10px] text-text-muted">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Frame Rate</label>
                <div className="grid grid-cols-3 gap-2">
                  {[24, 30, 60].map((fps) => (
                    <button
                      key={fps}
                      onClick={() => setStitchFps(fps as 24 | 30 | 60)}
                      className={`px-3 py-2 text-sm border transition-colors ${
                        stitchFps === fps
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {fps} fps
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              {stitchProgress.status === 'encoding' && (
                <div className="p-4 bg-surface-alt border border-border space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                      {stitchProgress.message}
                    </span>
                    <span className="text-accent font-medium">{stitchProgress.progress}%</span>
                  </div>
                  <div className="h-2 bg-background overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent via-accent to-secondary transition-all duration-200"
                      style={{ width: `${stitchProgress.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-text-muted">
                    Clip {stitchProgress.currentClip} of {stitchProgress.totalClips}
                  </div>
                </div>
              )}

              {/* Success */}
              {stitchProgress.status === 'done' && (
                <div className="p-6 bg-gradient-to-br from-accent/20 via-accent/10 to-secondary/10 border border-accent/40 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-accent/20 flex items-center justify-center mb-3">
                    <Check className="w-8 h-8 text-accent" strokeWidth={3} />
                  </div>
                  <h3 className="text-xl font-bold text-text-primary">Stitch Complete!</h3>
                  <p className="text-sm text-text-secondary">
                    Your combined video is ready in your downloads folder
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm bg-accent text-white hover:bg-accent-hover transition-colors"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => setStitchProgress({ status: 'idle', progress: 0, message: '', currentClip: 0, totalClips: 0 })}
                      className="px-4 py-2 text-sm border border-border text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Export Another
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {stitchProgress.status === 'error' && (
                <div className="flex items-center gap-2 text-error text-sm p-3 bg-error/10 border border-error/30">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{stitchProgress.message}</span>
                </div>
              )}

              {/* Export Button */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose} disabled={isExportingStitch}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const selectedTrack = tracks.find(t => t.id === stitchTrackId)
                    if (!selectedTrack || selectedTrack.clips.length === 0) return

                    setIsExportingStitch(true)
                    setStitchProgress({ status: 'preparing', progress: 0, message: 'Preparing...', currentClip: 0, totalClips: selectedTrack.clips.length })

                    try {
                      const blob = await exportStitchedVideo(
                        selectedTrack,
                        getFile,
                        {
                          trackId: stitchTrackId,
                          format: 'mp4',
                          resolution: stitchResolution,
                          quality: stitchQuality,
                          fps: stitchFps,
                          includeAudio: false,
                        },
                        setStitchProgress
                      )

                      if (blob) {
                        downloadStitchedVideo(blob, `${selectedTrack.name.toLowerCase().replace(/\s+/g, '-')}-stitched.mp4`)
                      }
                    } catch (err) {
                      console.error('Stitch export error:', err)
                      setStitchProgress({
                        status: 'error',
                        progress: 0,
                        message: err instanceof Error ? err.message : 'Export failed',
                        currentClip: 0,
                        totalClips: 0,
                      })
                    } finally {
                      setIsExportingStitch(false)
                    }
                  }}
                  disabled={isExportingStitch || !tracks.find(t => t.id === stitchTrackId)?.clips.length}
                >
                  {isExportingStitch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Stitching...
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      Export Stitched Video
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* PDF Report Export */}
          {exportMode === 'pdf' && (
            <>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Report Title</label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  <span className="text-sm text-text-primary">Include media metadata</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  <span className="text-sm text-text-primary">Include comparison settings</span>
                </label>
              </div>

              <div className="flex items-center gap-2 p-3 bg-surface-alt border border-border rounded text-sm text-text-secondary">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span>Generates a professional PDF report with screenshot, metadata, and quality metrics.</span>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handlePDFExport} disabled={isExportingPDF}>
                  {isExportingPDF ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generate PDF
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
