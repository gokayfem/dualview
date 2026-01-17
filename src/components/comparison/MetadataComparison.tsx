import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import { Info, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { MediaFile } from '../../types'

interface MetadataComparisonProps {
  mediaA: MediaFile | null
  mediaB: MediaFile | null
  isOpen: boolean
  onClose: () => void
}

interface MediaMetadata {
  basic: {
    name: string
    type: string
    size: string
    format: string
  }
  dimensions?: {
    width: number
    height: number
    aspectRatio: string
  }
  duration?: string
  exif?: Record<string, string>
  video?: {
    codec?: string
    bitrate?: string
    frameRate?: string
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(width, height)
  return `${width / divisor}:${height / divisor}`
}

async function extractMetadata(media: MediaFile): Promise<MediaMetadata> {
  const metadata: MediaMetadata = {
    basic: {
      name: media.name,
      type: media.type,
      size: formatFileSize(media.file.size),
      format: media.file.type || 'Unknown',
    },
  }

  if (media.width && media.height) {
    metadata.dimensions = {
      width: media.width,
      height: media.height,
      aspectRatio: getAspectRatio(media.width, media.height),
    }
  }

  if (media.duration) {
    metadata.duration = formatDuration(media.duration)
  }

  // Try to extract EXIF data for images
  if (media.type === 'image' && media.file) {
    try {
      const exif = await extractExif(media.file)
      if (Object.keys(exif).length > 0) {
        metadata.exif = exif
      }
    } catch (err) {
      console.error('Failed to extract EXIF:', err)
    }
  }

  return metadata
}

async function extractExif(file: File): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result as ArrayBuffer
      if (!data) {
        resolve({})
        return
      }

      const exif: Record<string, string> = {}

      // Basic EXIF parsing for JPEG
      const view = new DataView(data)
      if (view.getUint16(0) !== 0xffd8) {
        resolve({})
        return
      }

      let offset = 2
      while (offset < view.byteLength) {
        const marker = view.getUint16(offset)
        offset += 2

        if (marker === 0xffe1) {
          // EXIF marker found
          const length = view.getUint16(offset)

          // Check for "Exif\0\0" signature
          const exifSignature = String.fromCharCode(
            view.getUint8(offset + 2),
            view.getUint8(offset + 3),
            view.getUint8(offset + 4),
            view.getUint8(offset + 5)
          )

          if (exifSignature === 'Exif') {
            exif['Format'] = 'JPEG with EXIF'
          }

          offset += length
        } else if ((marker & 0xff00) === 0xff00) {
          const length = view.getUint16(offset)
          offset += length
        } else {
          break
        }
      }

      // Add file-based metadata
      exif['Last Modified'] = new Date(file.lastModified).toLocaleString()

      resolve(exif)
    }
    reader.onerror = () => resolve({})
    reader.readAsArrayBuffer(file.slice(0, 65536)) // Read first 64KB
  })
}

export function MetadataComparison({
  mediaA,
  mediaB,
  isOpen,
  onClose,
}: MetadataComparisonProps) {
  const [metadataA, setMetadataA] = useState<MediaMetadata | null>(null)
  const [metadataB, setMetadataB] = useState<MediaMetadata | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'dimensions']))

  useEffect(() => {
    if (mediaA) {
      extractMetadata(mediaA).then(setMetadataA)
    } else {
      setMetadataA(null)
    }
  }, [mediaA])

  useEffect(() => {
    if (mediaB) {
      extractMetadata(mediaB).then(setMetadataB)
    } else {
      setMetadataB(null)
    }
  }, [mediaB])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Info className="w-5 h-5" />
            Metadata Comparison
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {/* Header */}
            <div className="text-sm font-medium text-orange-400">Track A</div>
            <div className="text-sm font-medium text-lime-400">Track B</div>

            {/* Basic Info */}
            <MetadataSection
              title="Basic Info"
                            isExpanded={expandedSections.has('basic')}
              onToggle={() => toggleSection('basic')}
            >
              <MetadataRow label="Name" valueA={metadataA?.basic.name} valueB={metadataB?.basic.name} />
              <MetadataRow label="Type" valueA={metadataA?.basic.type} valueB={metadataB?.basic.type} />
              <MetadataRow label="Size" valueA={metadataA?.basic.size} valueB={metadataB?.basic.size} highlight />
              <MetadataRow label="Format" valueA={metadataA?.basic.format} valueB={metadataB?.basic.format} />
            </MetadataSection>

            {/* Dimensions */}
            {(metadataA?.dimensions || metadataB?.dimensions) && (
              <MetadataSection
                title="Dimensions"
                                isExpanded={expandedSections.has('dimensions')}
                onToggle={() => toggleSection('dimensions')}
              >
                <MetadataRow
                  label="Resolution"
                  valueA={metadataA?.dimensions ? `${metadataA.dimensions.width} × ${metadataA.dimensions.height}` : undefined}
                  valueB={metadataB?.dimensions ? `${metadataB.dimensions.width} × ${metadataB.dimensions.height}` : undefined}
                  highlight
                />
                <MetadataRow
                  label="Aspect Ratio"
                  valueA={metadataA?.dimensions?.aspectRatio}
                  valueB={metadataB?.dimensions?.aspectRatio}
                />
              </MetadataSection>
            )}

            {/* Duration (for video/audio) */}
            {(metadataA?.duration || metadataB?.duration) && (
              <MetadataSection
                title="Duration"
                                isExpanded={expandedSections.has('duration')}
                onToggle={() => toggleSection('duration')}
              >
                <MetadataRow
                  label="Length"
                  valueA={metadataA?.duration}
                  valueB={metadataB?.duration}
                  highlight
                />
              </MetadataSection>
            )}

            {/* EXIF Data */}
            {(metadataA?.exif || metadataB?.exif) && (
              <MetadataSection
                title="EXIF Data"
                                isExpanded={expandedSections.has('exif')}
                onToggle={() => toggleSection('exif')}
              >
                {Object.keys({ ...metadataA?.exif, ...metadataB?.exif }).map(key => (
                  <MetadataRow
                    key={key}
                    label={key}
                    valueA={metadataA?.exif?.[key]}
                    valueB={metadataB?.exif?.[key]}
                  />
                ))}
              </MetadataSection>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetadataSection({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className="col-span-2 flex items-center gap-2 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border-b border-border"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {title}
      </button>
      {isExpanded && children}
    </>
  )
}

function MetadataRow({
  label,
  valueA,
  valueB,
  highlight,
}: {
  label: string
  valueA?: string
  valueB?: string
  highlight?: boolean
}) {
  const isDifferent = valueA !== valueB && valueA && valueB

  return (
    <>
      <div className="col-span-2 text-xs text-text-muted py-1 border-b border-border/50">
        {label}
      </div>
      <div
        className={cn(
          "text-sm py-1 border-b border-border/50 font-mono",
          isDifferent && highlight ? "text-orange-400" : "text-text-primary"
        )}
      >
        {valueA || <span className="text-text-muted">—</span>}
      </div>
      <div
        className={cn(
          "text-sm py-1 border-b border-border/50 font-mono",
          isDifferent && highlight ? "text-lime-400" : "text-text-primary"
        )}
      >
        {valueB || <span className="text-text-muted">—</span>}
      </div>
    </>
  )
}
