import { useState } from 'react'
import { useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { cn } from '../../lib/utils'
import { Link, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '../ui'

interface URLImportProps {
  isOpen: boolean
  onClose: () => void
}

export function URLImport({ isOpen, onClose }: URLImportProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { addFile } = useMediaStore()
  const { addClip, tracks } = useTimelineStore()

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const getMediaType = (contentType: string, url: string): 'video' | 'image' | 'audio' | null => {
    if (contentType.startsWith('video/')) return 'video'
    if (contentType.startsWith('image/')) return 'image'
    if (contentType.startsWith('audio/')) return 'audio'

    // Check file extension as fallback
    const ext = url.split('.').pop()?.toLowerCase()
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '')) return 'video'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) return 'image'
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext || '')) return 'audio'

    return null
  }

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    if (!validateUrl(url)) {
      setError('Invalid URL format')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Fetch the media
      const response = await fetch(url, {
        mode: 'cors',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      const mediaType = getMediaType(contentType, url)

      if (!mediaType) {
        throw new Error('Unsupported media type. Please use video, image, or audio URLs.')
      }

      // Get the blob
      const blob = await response.blob()

      // Create a file from the blob
      const fileName = url.split('/').pop()?.split('?')[0] || `imported-${Date.now()}`
      const file = new File([blob], fileName, { type: blob.type || contentType })

      // Add to media store
      const mediaFile = await addFile(file)

      // Auto-add to timeline if tracks are empty
      const trackA = tracks.find(t => t.type === 'a')
      const trackB = tracks.find(t => t.type === 'b')

      if (trackA && trackA.clips.length === 0 && trackA.acceptedTypes.includes(mediaFile.type)) {
        addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
      } else if (trackB && trackB.clips.length === 0 && trackB.acceptedTypes.includes(mediaFile.type)) {
        addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
      }

      setSuccess(true)
      setUrl('')
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 1000)
    } catch (err) {
      console.error('URL import error:', err)
      setError(err instanceof Error ? err.message : 'Failed to import from URL')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Link className="w-5 h-5" />
            Import from URL
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Media URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className={cn(
                "w-full px-3 py-2 bg-background border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1",
                error ? "border-error focus:ring-error" : "border-border focus:ring-accent"
              )}
              disabled={isLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
            <p className="text-xs text-text-muted mt-1">
              Supports video, image, and audio URLs
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-error text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <CheckCircle className="w-4 h-4" />
              Successfully imported!
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isLoading || !url.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
