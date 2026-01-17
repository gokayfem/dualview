import { useState, useEffect } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { ChevronDown, FileSearch, Equal, ArrowUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { MediaFile } from '../../types'

interface ExtendedMetadata {
  name: string
  size: string
  sizeBytes: number
  format: string
  type: string
  lastModified: string
  resolution?: string
  width?: number
  height?: number
  aspectRatio?: string
  duration?: string
  durationSeconds?: number
  bitrate?: string
  frameRate?: string
  sampleRate?: string
  channels?: string
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function formatBitrate(bytes: number, seconds: number): string {
  if (!seconds || seconds === 0) return '—'
  const bitsPerSecond = (bytes * 8) / seconds
  if (bitsPerSecond >= 1000000) {
    return `${(bitsPerSecond / 1000000).toFixed(2)} Mbps`
  }
  return `${(bitsPerSecond / 1000).toFixed(0)} kbps`
}

function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height)
  const w = width / divisor
  const h = height / divisor
  // Common aspect ratios
  if (Math.abs(w/h - 16/9) < 0.01) return '16:9'
  if (Math.abs(w/h - 4/3) < 0.01) return '4:3'
  if (Math.abs(w/h - 21/9) < 0.01) return '21:9'
  if (Math.abs(w/h - 1) < 0.01) return '1:1'
  if (Math.abs(w/h - 9/16) < 0.01) return '9:16'
  return `${w}:${h}`
}

async function extractMetadata(media: MediaFile): Promise<ExtendedMetadata> {
  const base: ExtendedMetadata = {
    name: media.name,
    size: formatFileSize(media.file?.size || 0),
    sizeBytes: media.file?.size || 0,
    format: media.file?.name.split('.').pop()?.toUpperCase() || 'Unknown',
    type: media.type,
    lastModified: media.file ? new Date(media.file.lastModified).toLocaleDateString() : '—',
  }

  if (media.type === 'video' || media.type === 'image') {
    if (media.width && media.height) {
      base.resolution = `${media.width} × ${media.height}`
      base.width = media.width
      base.height = media.height
      base.aspectRatio = calculateAspectRatio(media.width, media.height)
    }
  }

  if (media.type === 'video' || media.type === 'audio') {
    if (media.duration) {
      base.duration = formatDuration(media.duration)
      base.durationSeconds = media.duration
      if (media.file?.size) {
        base.bitrate = formatBitrate(media.file.size, media.duration)
      }
    }
  }

  // Try to get more video info from video element
  if (media.type === 'video' && media.url) {
    try {
      const video = document.createElement('video')
      video.src = media.url
      video.preload = 'metadata'
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve()
        setTimeout(resolve, 2000) // Timeout fallback
      })
      if (video.videoWidth && video.videoHeight) {
        base.resolution = `${video.videoWidth} × ${video.videoHeight}`
        base.width = video.videoWidth
        base.height = video.videoHeight
        base.aspectRatio = calculateAspectRatio(video.videoWidth, video.videoHeight)
      }
      // Estimate frame rate from video (approximate)
      base.frameRate = '—' // Can't reliably get this from browser
    } catch (e) {
      // Ignore errors
    }
  }

  // Try to get audio info from AudioContext
  if (media.type === 'audio' && media.url) {
    try {
      const response = await fetch(media.url)
      const arrayBuffer = await response.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      base.sampleRate = `${audioBuffer.sampleRate} Hz`
      base.channels = audioBuffer.numberOfChannels === 1 ? 'Mono' : audioBuffer.numberOfChannels === 2 ? 'Stereo' : `${audioBuffer.numberOfChannels} channels`
      base.duration = formatDuration(audioBuffer.duration)
      base.durationSeconds = audioBuffer.duration
      if (media.file?.size) {
        base.bitrate = formatBitrate(media.file.size, audioBuffer.duration)
      }
      audioContext.close()
    } catch (e) {
      // Ignore errors
    }
  }

  return base
}

interface ComparisonRowProps {
  label: string
  valueA?: string | number | null
  valueB?: string | number | null
  unit?: string
}

function ComparisonRow({ label, valueA, valueB, unit }: ComparisonRowProps) {
  const strA = valueA?.toString() || '—'
  const strB = valueB?.toString() || '—'
  const isSame = strA === strB && strA !== '—'
  const isDifferent = strA !== strB && strA !== '—' && strB !== '—'

  return (
    <div className="grid grid-cols-[100px_1fr_24px_1fr] gap-2 items-center py-1.5 border-b border-border/50 last:border-0">
      <span className="text-[11px] text-text-muted font-medium">{label}</span>
      <div className="text-xs font-mono bg-surface-alt px-2 py-1 text-accent truncate" title={strA}>
        {strA}{unit && strA !== '—' ? ` ${unit}` : ''}
      </div>
      <div className="flex justify-center">
        {isSame ? (
          <Equal className="w-3 h-3 text-green-500" />
        ) : isDifferent ? (
          <ArrowUpDown className="w-3 h-3 text-amber-500" />
        ) : (
          <span className="w-3 h-3" />
        )}
      </div>
      <div className={cn(
        "text-xs font-mono px-2 py-1 truncate",
        isDifferent ? "bg-secondary/20 text-secondary" : "bg-surface-alt text-secondary"
      )} title={strB}>
        {strB}{unit && strB !== '—' ? ` ${unit}` : ''}
      </div>
    </div>
  )
}

export function MetadataComparison() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [metadataA, setMetadataA] = useState<ExtendedMetadata | null>(null)
  const [metadataB, setMetadataB] = useState<ExtendedMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { tracks } = useTimelineStore()
  const { getFile } = useMediaStore()

  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const clipA = trackA?.clips[0]
  const clipB = trackB?.clips[0]
  const mediaA = clipA ? getFile(clipA.mediaId) ?? null : null
  const mediaB = clipB ? getFile(clipB.mediaId) ?? null : null

  // Extract metadata when media changes
  useEffect(() => {
    const extract = async () => {
      setIsLoading(true)
      const [mA, mB] = await Promise.all([
        mediaA ? extractMetadata(mediaA) : Promise.resolve(null),
        mediaB ? extractMetadata(mediaB) : Promise.resolve(null),
      ])
      setMetadataA(mA)
      setMetadataB(mB)
      setIsLoading(false)
    }
    extract()
  }, [mediaA?.id, mediaB?.id])

  if (!mediaA && !mediaB) {
    return null
  }

  const primaryType = mediaA?.type || mediaB?.type

  // Count differences
  const countDifferences = () => {
    if (!metadataA || !metadataB) return 0
    let count = 0
    const keys: (keyof ExtendedMetadata)[] = ['resolution', 'duration', 'size', 'format', 'bitrate', 'aspectRatio', 'sampleRate', 'channels']
    keys.forEach(key => {
      const vA = metadataA[key]
      const vB = metadataB[key]
      if (vA && vB && vA !== vB) count++
    })
    return count
  }

  const diffCount = countDifferences()

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 transition-colors text-sm border",
          isExpanded
            ? "bg-surface-alt border-accent/50"
            : "bg-background hover:bg-surface-alt border-border"
        )}
      >
        <FileSearch className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-medium text-text-secondary hidden lg:inline">Metadata</span>
        {/* Keep header compact: avoid showing filenames / diff count here */}

        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-text-muted transition-transform",
          isExpanded && "rotate-180"
        )} />
      </button>

      {isExpanded && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-surface border border-border shadow-2xl z-50 w-[480px] max-h-[70vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-border bg-surface-alt">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileSearch className="w-4 h-4" />
                File Metadata Comparison
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-surface rounded transition-colors"
              >
                <ChevronDown className="w-4 h-4 rotate-180" />
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[100px_1fr_24px_1fr] gap-2 mt-3 text-[10px] uppercase tracking-wider text-text-muted font-medium">
              <span>Property</span>
              <span className="text-accent">Media A</span>
              <span></span>
              <span className="text-secondary">Media B</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {/* Common metadata */}
                <ComparisonRow label="File Name" valueA={metadataA?.name} valueB={metadataB?.name} />
                <ComparisonRow label="Format" valueA={metadataA?.format} valueB={metadataB?.format} />
                <ComparisonRow label="File Size" valueA={metadataA?.size} valueB={metadataB?.size} />
                <ComparisonRow label="Modified" valueA={metadataA?.lastModified} valueB={metadataB?.lastModified} />

                {/* Video/Image metadata */}
                {(primaryType === 'video' || primaryType === 'image') && (
                  <>
                    <div className="h-2" />
                    <ComparisonRow label="Resolution" valueA={metadataA?.resolution} valueB={metadataB?.resolution} />
                    <ComparisonRow label="Aspect Ratio" valueA={metadataA?.aspectRatio} valueB={metadataB?.aspectRatio} />
                  </>
                )}

                {/* Video/Audio metadata */}
                {(primaryType === 'video' || primaryType === 'audio') && (
                  <>
                    <div className="h-2" />
                    <ComparisonRow label="Duration" valueA={metadataA?.duration} valueB={metadataB?.duration} />
                    <ComparisonRow label="Bitrate" valueA={metadataA?.bitrate} valueB={metadataB?.bitrate} />
                  </>
                )}

                {/* Audio specific */}
                {primaryType === 'audio' && (
                  <>
                    <ComparisonRow label="Sample Rate" valueA={metadataA?.sampleRate} valueB={metadataB?.sampleRate} />
                    <ComparisonRow label="Channels" valueA={metadataA?.channels} valueB={metadataB?.channels} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border bg-surface-alt flex items-center justify-between text-[10px] text-text-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Equal className="w-3 h-3 text-green-500" /> Same
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-amber-500" /> Different
              </span>
            </div>
            {diffCount > 0 && (
              <span className="text-amber-500 font-medium">{diffCount} differences found</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
