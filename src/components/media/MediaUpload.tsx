import { useCallback, useState, useEffect } from 'react'
import { useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { cn } from '../../lib/utils'
import { Upload, Film, Image, Music, AlertCircle, Link, Clipboard, Monitor, Box, FileSpreadsheet } from 'lucide-react'
import { URLImport } from './URLImport'
import { captureScreenAsFile, isScreenCaptureSupported } from '../../lib/screenCapture'

interface MediaUploadProps {
  className?: string
  onUpload?: () => void
}

export function MediaUpload({ className, onUpload }: MediaUploadProps) {
  const [isDragOverA, setIsDragOverA] = useState(false)
  const [isDragOverB, setIsDragOverB] = useState(false)
  const [isDragOverGeneral, setIsDragOverGeneral] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [isURLImportOpen, setIsURLImportOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  const { addFile } = useMediaStore()
  const { addClip, tracks } = useTimelineStore()

  // Clipboard paste handler (IMPORT-002)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // Handle image paste
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            setIsUploading(true)
            try {
              const mediaFile = await addFile(file)

              // Auto-add to timeline
              const trackA = tracks.find(t => t.type === 'a')
              const trackB = tracks.find(t => t.type === 'b')

              if (trackA && trackA.clips.length === 0) {
                addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
              } else if (trackB && trackB.clips.length === 0) {
                addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
              }

              onUpload?.()
            } catch (err) {
              console.error('Failed to paste image:', err)
              setError('Failed to paste image')
              setTimeout(() => setError(null), 3000)
            } finally {
              setIsUploading(false)
            }
          }
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addFile, addClip, tracks, onUpload])

  // Handle files with optional target track ('a', 'b', or 'auto' for alternating)
  const handleFiles = useCallback(
    async (files: FileList | null, targetTrack: 'a' | 'b' | 'auto' = 'auto') => {
      if (!files || files.length === 0) return

      setIsUploading(true)
      setError(null)
      setUploadProgress({ current: 0, total: files.length })

      const invalidFiles: string[] = []

      // Track cumulative positions for sequential placement
      let nextStartTimeA = 0
      let nextStartTimeB = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Validate file type (including 3D models and documents by extension)
        const extension = file.name.toLowerCase().split('.').pop()
        const isModel = extension === 'glb' || extension === 'gltf'
        const isDocument = extension === 'csv' || extension === 'xlsx' || extension === 'xls' || extension === 'docx' || extension === 'pdf'
        if (
          !file.type.startsWith('video/') &&
          !file.type.startsWith('image/') &&
          !file.type.startsWith('audio/') &&
          !isModel &&
          !isDocument
        ) {
          invalidFiles.push(file.name)
          setUploadProgress(prev => ({ ...prev, current: i + 1 }))
          continue
        }

        try {
          setUploadProgress({ current: i + 1, total: files.length })
          const mediaFile = await addFile(file)
          const duration = mediaFile.duration || 10

          // Auto-add to timeline based on target track
          const trackA = tracks.find(t => t.type === 'a')
          const trackB = tracks.find(t => t.type === 'b')

          if (targetTrack === 'a' && trackA) {
            // Add all files to Track A sequentially
            addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
            nextStartTimeA += duration
          } else if (targetTrack === 'b' && trackB) {
            // Add all files to Track B sequentially
            addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
            nextStartTimeB += duration
          } else {
            // Auto mode: first file to A, second to B
            if (i === 0 && trackA) {
              addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
              nextStartTimeA += duration
            } else if (i === 1 && trackB) {
              addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
              nextStartTimeB += duration
            } else if (i % 2 === 0 && trackA) {
              addClip(trackA.id, mediaFile.id, nextStartTimeA, duration)
              nextStartTimeA += duration
            } else if (trackB) {
              addClip(trackB.id, mediaFile.id, nextStartTimeB, duration)
              nextStartTimeB += duration
            }
          }
        } catch (error) {
          console.error('Failed to add file:', error)
          invalidFiles.push(file.name)
        }
      }

      if (invalidFiles.length > 0) {
        setError(`Unsupported files: ${invalidFiles.join(', ')}`)
        setTimeout(() => setError(null), 5000)
      }

      setIsUploading(false)
      setUploadProgress({ current: 0, total: 0 })
      onUpload?.()
    },
    [addFile, addClip, tracks, onUpload]
  )

  // General drop handler (auto mode)
  const handleDropGeneral = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOverGeneral(false)
      handleFiles(e.dataTransfer.files, 'auto')
    },
    [handleFiles]
  )

  // Track A drop handler
  const handleDropA = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOverA(false)
      handleFiles(e.dataTransfer.files, 'a')
    },
    [handleFiles]
  )

  // Track B drop handler
  const handleDropB = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOverB(false)
      handleFiles(e.dataTransfer.files, 'b')
    },
    [handleFiles]
  )

  const handleDragOverGeneral = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverGeneral(true)
  }

  const handleDragLeaveGeneral = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverGeneral(false)
  }

  const handleDragOverA = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverA(true)
  }

  const handleDragLeaveA = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverA(false)
  }

  const handleDragOverB = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverB(true)
  }

  const handleDragLeaveB = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverB(false)
  }

  const handleClickA = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'video/*,image/*,audio/*,.glb,.gltf,.csv,.xlsx,.xls,.docx,.pdf'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleFiles(target.files, 'a')
    }
    input.click()
  }

  const handleClickB = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'video/*,image/*,audio/*,.glb,.gltf,.csv,.xlsx,.xls,.docx,.pdf'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleFiles(target.files, 'b')
    }
    input.click()
  }

  const handleClickGeneral = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'video/*,image/*,audio/*,.glb,.gltf,.csv,.xlsx,.xls,.docx,.pdf'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleFiles(target.files, 'auto')
    }
    input.click()
  }

  const handleScreenCapture = async () => {
    if (!isScreenCaptureSupported()) {
      setError('Screen capture is not supported in this browser')
      setTimeout(() => setError(null), 3000)
      return
    }

    setIsCapturing(true)
    setError(null)

    try {
      const file = await captureScreenAsFile()
      const mediaFile = await addFile(file)

      // Auto-add to timeline
      const trackA = tracks.find(t => t.type === 'a')
      const trackB = tracks.find(t => t.type === 'b')

      if (trackA && trackA.clips.length === 0) {
        addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
      } else if (trackB && trackB.clips.length === 0) {
        addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
      }

      onUpload?.()
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        console.error('Screen capture failed:', err)
        setError('Screen capture failed')
        setTimeout(() => setError(null), 3000)
      }
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Track A and Track B drop zones side by side */}
      <div className="grid grid-cols-2 gap-2">
        {/* Media A Drop Zone */}
        <div
          className={cn(
            'border-2 border-dashed transition-all duration-200 cursor-pointer group',
            isDragOverA
              ? 'border-orange-500 bg-orange-500/20 scale-[1.02]'
              : 'border-orange-500/40 hover:border-orange-500 hover:bg-orange-500/10',
            isUploading && 'opacity-50 pointer-events-none'
          )}
          onDrop={handleDropA}
          onDragOver={handleDragOverA}
          onDragLeave={handleDragLeaveA}
          onClick={handleClickA}
        >
          <div className="flex flex-col items-center justify-center py-4 px-2">
            <div className={cn(
              'p-1.5 mb-1 transition-colors',
              isDragOverA ? 'bg-orange-500/30' : 'bg-orange-500/10 group-hover:bg-orange-500/20'
            )}>
              <Upload className={cn('w-5 h-5', isDragOverA ? 'text-orange-500' : 'text-orange-500/70 group-hover:text-orange-500')} />
            </div>
            <p className={cn(
              'text-xs text-center font-medium',
              isDragOverA ? 'text-orange-500' : 'text-text-primary'
            )}>
              {isDragOverA ? 'Drop for A' : 'Media A'}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">Track A</p>
          </div>
        </div>

        {/* Media B Drop Zone */}
        <div
          className={cn(
            'border-2 border-dashed transition-all duration-200 cursor-pointer group',
            isDragOverB
              ? 'border-lime-400 bg-lime-400/20 scale-[1.02]'
              : 'border-lime-400/40 hover:border-lime-400 hover:bg-lime-400/10',
            isUploading && 'opacity-50 pointer-events-none'
          )}
          onDrop={handleDropB}
          onDragOver={handleDragOverB}
          onDragLeave={handleDragLeaveB}
          onClick={handleClickB}
        >
          <div className="flex flex-col items-center justify-center py-4 px-2">
            <div className={cn(
              'p-1.5 mb-1 transition-colors',
              isDragOverB ? 'bg-lime-400/30' : 'bg-lime-400/10 group-hover:bg-lime-400/20'
            )}>
              <Upload className={cn('w-5 h-5', isDragOverB ? 'text-lime-400' : 'text-lime-400/70 group-hover:text-lime-400')} />
            </div>
            <p className={cn(
              'text-xs text-center font-medium',
              isDragOverB ? 'text-lime-400' : 'text-text-primary'
            )}>
              {isDragOverB ? 'Drop for B' : 'Media B'}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">Track B</p>
          </div>
        </div>
      </div>

      {/* General drop zone for both */}
      <div
        className={cn(
          'border-2 border-dashed transition-all duration-200 cursor-pointer group',
          isDragOverGeneral
            ? 'border-accent bg-accent/10 scale-[1.01]'
            : 'border-border hover:border-accent/60 hover:bg-accent/5',
          isUploading && 'opacity-50 pointer-events-none'
        )}
        onDrop={handleDropGeneral}
        onDragOver={handleDragOverGeneral}
        onDragLeave={handleDragLeaveGeneral}
        onClick={handleClickGeneral}
      >
        <div className="flex flex-col items-center justify-center py-4 px-4">
          <p className={cn(
            'text-xs text-center',
            isDragOverGeneral ? 'text-accent' : 'text-text-muted'
          )}>
            {isUploading
              ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
              : isDragOverGeneral
                ? 'Drop to add to both tracks'
                : 'Drop multiple files (auto A/B)'}
          </p>
          <div className="flex gap-2 mt-2">
            <Film className="w-3 h-3 text-text-muted/50" />
            <Image className="w-3 h-3 text-text-muted/50" />
            <Music className="w-3 h-3 text-text-muted/50" />
            <Box className="w-3 h-3 text-text-muted/50" />
            <FileSpreadsheet className="w-3 h-3 text-text-muted/50" />
          </div>
        </div>
      </div>

      {/* Import options */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setIsURLImportOpen(true) }}
          className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-text-secondary hover:text-text-primary bg-surface-hover hover:bg-surface border border-border rounded transition-colors"
        >
          <Link className="w-3 h-3" />
          URL
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.read().catch(() => {}) }}
          className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-text-secondary hover:text-text-primary bg-surface-hover hover:bg-surface border border-border rounded transition-colors"
          title="Ctrl+V to paste images"
        >
          <Clipboard className="w-3 h-3" />
          Paste
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleScreenCapture() }}
          disabled={isCapturing}
          className={cn(
            "flex items-center justify-center gap-1 px-2 py-2 text-xs text-text-secondary hover:text-text-primary bg-surface-hover hover:bg-surface border border-border rounded transition-colors",
            isCapturing && "opacity-50 cursor-wait"
          )}
          title="Capture screen region"
        >
          <Monitor className="w-3 h-3" />
          {isCapturing ? '...' : 'Screen'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-error/10 border border-error/30 rounded text-error text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* URL Import Modal */}
      <URLImport isOpen={isURLImportOpen} onClose={() => setIsURLImportOpen(false)} />
    </div>
  )
}
