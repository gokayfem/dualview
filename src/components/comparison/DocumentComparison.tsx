import { useMemo, useCallback, useRef } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { CSVComparison } from './CSVComparison'
import { ExcelComparison } from './ExcelComparison'
import { DOCXComparison } from './DOCXComparison'
import { PDFComparison } from './PDFComparison'
import { FileText, FileSpreadsheet, Table, Upload, File } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { MediaType } from '../../types'

interface DocumentTypeConfig {
  type: string
  accept: string
  label: string
  icon: typeof FileText
  color: string
  bgColor: string
  borderColor: string
  description: string
}

const documentTypes: DocumentTypeConfig[] = [
  {
    type: 'csv',
    accept: '.csv',
    label: 'CSV',
    icon: Table,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 hover:bg-green-500/20',
    borderColor: 'border-green-500/30 hover:border-green-500/50',
    description: 'Spreadsheet data'
  },
  {
    type: 'excel',
    accept: '.xlsx,.xls',
    label: 'Excel',
    icon: FileSpreadsheet,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/50',
    description: 'Workbooks & sheets'
  },
  {
    type: 'docx',
    accept: '.docx',
    label: 'Word',
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
    borderColor: 'border-blue-500/30 hover:border-blue-500/50',
    description: 'Word documents'
  },
  {
    type: 'pdf',
    accept: '.pdf',
    label: 'PDF',
    icon: File,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20',
    borderColor: 'border-red-500/30 hover:border-red-500/50',
    description: 'PDF files'
  }
]

/**
 * DocumentComparison - Wrapper component that detects document types
 * and renders the appropriate comparison component
 */
export function DocumentComparison() {
  const { tracks, addClip } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile, addFile } = useMediaStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentUploadTarget = useRef<{ track: 'a' | 'b', accept: string } | null>(null)

  // Get current clips at playhead
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')

  const clipA = trackA?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)
  const clipB = trackB?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)

  const mediaA = clipA ? getFile(clipA.mediaId) : null
  const mediaB = clipB ? getFile(clipB.mediaId) : null

  // Determine document type from media files
  const documentType = useMemo((): MediaType | null => {
    const typeA = mediaA?.type
    const typeB = mediaB?.type

    // Both files should be document types
    const docTypes: MediaType[] = ['csv', 'excel', 'docx', 'pdf']

    if (typeA && docTypes.includes(typeA)) return typeA
    if (typeB && docTypes.includes(typeB)) return typeB

    return null
  }, [mediaA, mediaB])

  // Handle file upload
  const handleUpload = useCallback(async (files: FileList | null, targetTrack: 'a' | 'b') => {
    if (!files || files.length === 0) return

    const file = files[0]
    try {
      const mediaFile = await addFile(file)
      const track = targetTrack === 'a' ? trackA : trackB

      if (track) {
        // Remove existing clips if any
        const duration = mediaFile.duration || 10
        addClip(track.id, mediaFile.id, 0, duration)
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
    }
  }, [addFile, addClip, trackA, trackB])

  // Trigger file input
  const triggerUpload = useCallback((track: 'a' | 'b', accept: string) => {
    currentUploadTarget.current = { track, accept }
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept
      fileInputRef.current.click()
    }
  }, [])

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentUploadTarget.current) {
      handleUpload(e.target.files, currentUploadTarget.current.track)
      e.target.value = '' // Reset for re-upload
    }
  }, [handleUpload])

  // If no document files are loaded, show empty state with upload buttons
  if (!documentType) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted p-4">
        <div className="text-center max-w-3xl w-full">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          <h2 className="text-lg font-semibold text-text-primary mb-1">Document Comparison</h2>
          <p className="text-xs text-text-muted mb-4">
            Upload CSV, Excel, Word, or PDF files to compare
          </p>

          {/* Upload sections for Track A and Track B - side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Track A Upload */}
            <div className="p-3 bg-surface-alt border border-orange-500/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 font-bold text-xs">A</span>
                </div>
                <span className="text-sm font-medium text-orange-400">Document A</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {documentTypes.map((doc) => {
                  const Icon = doc.icon
                  return (
                    <button
                      key={`a-${doc.type}`}
                      onClick={() => triggerUpload('a', doc.accept)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 border transition-all',
                        doc.bgColor,
                        doc.borderColor
                      )}
                    >
                      <Icon className={cn('w-5 h-5', doc.color)} />
                      <span className={cn('text-[10px] font-medium', doc.color)}>{doc.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Track B Upload */}
            <div className="p-3 bg-surface-alt border border-lime-400/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-lime-400/20 flex items-center justify-center">
                  <span className="text-lime-400 font-bold text-xs">B</span>
                </div>
                <span className="text-sm font-medium text-lime-400">Document B</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {documentTypes.map((doc) => {
                  const Icon = doc.icon
                  return (
                    <button
                      key={`b-${doc.type}`}
                      onClick={() => triggerUpload('b', doc.accept)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 border transition-all',
                        doc.bgColor,
                        doc.borderColor
                      )}
                    >
                      <Icon className={cn('w-5 h-5', doc.color)} />
                      <span className={cn('text-[10px] font-medium', doc.color)}>{doc.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Drag and drop hint */}
          <p className="text-[10px] text-text-muted/50 mt-3">
            <Upload className="w-3 h-3 inline mr-1" />
            Or drag and drop files anywhere
          </p>
        </div>
      </div>
    )
  }

  // Render appropriate comparison component based on document type
  switch (documentType) {
    case 'csv':
      return <CSVComparison />
    case 'excel':
      return <ExcelComparison />
    case 'docx':
      return <DOCXComparison />
    case 'pdf':
      return <PDFComparison />
    default:
      return (
        <div className="w-full h-full flex items-center justify-center text-text-muted">
          <p>Unsupported document type: {documentType}</p>
        </div>
      )
  }
}
