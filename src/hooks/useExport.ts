import { useState, useCallback } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { useTimelineStore } from '../stores/timelineStore'
import { useMediaStore } from '../stores/mediaStore'
import { exportComparison, downloadBlob, type ExportOptions } from '../lib/ffmpeg'
import { exportComparisonToGIF, downloadGIF, GIF_PRESETS, type GIFPreset } from '../lib/gif'

export function useExport(captureFrame?: () => HTMLCanvasElement | null) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const { exportSettings, setExportProgress, setSliderPosition, sliderPosition: originalSliderPosition } = useProjectStore()
  const { duration, seek, tracks } = useTimelineStore()
  const { getFile } = useMediaStore()

  // Get media durations for loop calculation
  const getMediaDurations = useCallback(() => {
    const trackA = tracks.find(t => t.type === 'a')
    const trackB = tracks.find(t => t.type === 'b')
    const clipA = trackA?.clips[0]
    const clipB = trackB?.clips[0]
    const mediaA = clipA ? getFile(clipA.mediaId) : null
    const mediaB = clipB ? getFile(clipB.mediaId) : null

    return {
      durationA: mediaA?.duration || 0,
      durationB: mediaB?.duration || 0,
    }
  }, [tracks, getFile])

  const startExport = useCallback(
    async (canvas: HTMLCanvasElement) => {
      setIsExporting(true)
      setError(null)
      setProgress(0)

      // Save original slider position to restore after export
      const savedSliderPosition = originalSliderPosition

      try {
        // Apply export-specific slider position
        if (exportSettings.exportSource === 'a-only') {
          setSliderPosition(100) // Show full A
        } else if (exportSettings.exportSource === 'b-only') {
          setSliderPosition(0) // Show full B
        } else if (exportSettings.exportSource === 'comparison') {
          setSliderPosition(exportSettings.sliderPosition)
        }

        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 100))

        // Calculate export duration based on loop setting
        const { durationA, durationB } = getMediaDurations()
        let exportDuration = duration

        console.log('[Export] Duration A:', durationA, 'Duration B:', durationB, 'Timeline duration:', duration)

        if (exportSettings.loopShorterVideo && durationA > 0 && durationB > 0) {
          // Use the longer duration
          exportDuration = Math.max(durationA, durationB)
        }

        console.log('[Export] Export duration:', exportDuration, 'FPS:', exportSettings.fps)

        if (!exportDuration || exportDuration <= 0) {
          throw new Error('No video duration available. Please add media to the timeline.')
        }

        // FIX-005: Create seekTo function for frame capture
        const seekTo = async (time: number): Promise<void> => {
          seek(time)
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // Use captureFrame if provided, otherwise fall back to canvas
        const getFrameCanvas = (): HTMLCanvasElement | null => {
          if (captureFrame) {
            return captureFrame()
          }
          return canvas
        }

        // Handle GIF export separately
        if (exportSettings.format === 'gif') {
          setExportProgress({ status: 'preparing', progress: 0, message: 'Preparing GIF export...' })

          const preset = exportSettings.gifPreset || 'medium'
          const gifSettings = GIF_PRESETS[preset as GIFPreset]

          // FIX-005: Use frame capture function with seekTo
          const getGifFrame = (): ImageData | null => {
            const frameCanvas = getFrameCanvas()
            if (!frameCanvas) return null
            const ctx = frameCanvas.getContext('2d')
            if (!ctx) return null
            return ctx.getImageData(0, 0, frameCanvas.width, frameCanvas.height)
          }

          const blob = await exportComparisonToGIF(
            getGifFrame,
            exportDuration || 0,
            gifSettings,
            (gifProgress) => {
              setProgress(gifProgress.progress)
              setExportProgress({
                status: gifProgress.phase === 'done' ? 'done' : 'encoding',
                progress: gifProgress.progress,
                message: gifProgress.message,
              })
            },
            seekTo
          )

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const sourceSuffix = exportSettings.exportSource === 'a-only' ? '-A' : exportSettings.exportSource === 'b-only' ? '-B' : ''
          const filename = `dualview-export${sourceSuffix}-${timestamp}.gif`
          downloadGIF(blob, filename)

          setExportProgress({ status: 'done', progress: 100, message: 'GIF export complete!' })
        } else {
          // Video export (MP4/WebM)
          setExportProgress({ status: 'preparing', progress: 0, message: 'Loading FFmpeg...' })

          const options: ExportOptions = {
            format: exportSettings.format as 'mp4' | 'webm',
            resolution: exportSettings.resolution,
            quality: exportSettings.quality,
            fps: exportSettings.fps,
          }

          setExportProgress({ status: 'encoding', message: 'Capturing frames...' })

          const blob = await exportComparison(
            getFrameCanvas,
            exportDuration,
            options.fps,
            options,
            (p) => {
              setProgress(p)
              const phase = p < 70 ? 'Capturing frames' : 'Encoding video'
              setExportProgress({ progress: p, message: `${phase}... ${p}%` })
            },
            seekTo
          )

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const sourceSuffix = exportSettings.exportSource === 'a-only' ? '-A' : exportSettings.exportSource === 'b-only' ? '-B' : ''
          const filename = `dualview-export${sourceSuffix}-${timestamp}.${options.format}`
          downloadBlob(blob, filename)

          setExportProgress({ status: 'done', progress: 100, message: 'Export complete!' })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed'
        setError(message)
        setExportProgress({ status: 'error', message })
      } finally {
        // Restore original slider position
        setSliderPosition(savedSliderPosition)
        setIsExporting(false)
      }
    },
    [exportSettings, duration, setExportProgress, seek, setSliderPosition, originalSliderPosition, getMediaDurations, captureFrame]
  )

  return {
    isExporting,
    progress,
    error,
    startExport,
  }
}
