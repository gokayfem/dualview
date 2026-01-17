/**
 * SaveIndicator Component (PERSIST-002)
 * 
 * Shows the current save status with visual indicator and last saved timestamp.
 */

import { Cloud, CloudOff, Loader2, Check, AlertCircle } from 'lucide-react'
import { usePersistenceStore } from '../../stores/persistenceStore'

export function SaveIndicator() {
  const { saveStatus, lastSavedAt, projectMetadata, isIndexedDBSupported } = usePersistenceStore()

  if (!isIndexedDBSupported) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-400" title="IndexedDB not available">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Not saved</span>
      </div>
    )
  }

  if (!projectMetadata) {
    return null
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) {
      return 'Just now'
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000)
      return `${mins}m ago`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {saveStatus === 'saving' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span className="text-zinc-400">Saving...</span>
        </>
      )}
      {saveStatus === 'saved' && (
        <>
          <Cloud className="w-3.5 h-3.5 text-green-400" />
          <span className="text-zinc-400">
            Saved {lastSavedAt ? formatTime(lastSavedAt) : ''}
          </span>
        </>
      )}
      {saveStatus === 'unsaved' && (
        <>
          <Check className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-zinc-400">Unsaved changes</span>
        </>
      )}
      {saveStatus === 'error' && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400">Save failed</span>
        </>
      )}
    </div>
  )
}
