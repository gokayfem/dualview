import { useState, useCallback, useRef } from 'react'
import { useMediaStore } from '../stores/mediaStore'
import { useTimelineStore } from '../stores/timelineStore'

interface UseDropZoneOptions {
  trackType: 'a' | 'b'
}

export function useDropZone({ trackType }: UseDropZoneOptions) {
  const [isDragOver, setIsDragOver] = useState(false)
  const { addFile } = useMediaStore()
  const { addClip, tracks } = useTimelineStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    const track = tracks.find(t => t.type === trackType)
    if (!track) return

    // Track cumulative position for sequential placement
    let nextStartTime = 0

    // Process all dropped files
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type (including 3D models by extension)
      const extension = file.name.toLowerCase().split('.').pop()
      const isModel = extension === 'glb' || extension === 'gltf'
      if (
        !file.type.startsWith('video/') &&
        !file.type.startsWith('image/') &&
        !file.type.startsWith('audio/') &&
        !isModel
      ) {
        continue
      }

      try {
        const mediaFile = await addFile(file)
        const duration = mediaFile.duration || 10

        addClip(track.id, mediaFile.id, nextStartTime, duration)

        // Update next start time for sequential placement
        nextStartTime += duration
      } catch (err) {
        console.error('Failed to add dropped file:', err)
      }
    }
  }, [addFile, addClip, tracks, trackType])

  // Handle file input change (for click-to-upload) - supports multiple files
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const track = tracks.find(t => t.type === trackType)
    if (!track) return

    // Track cumulative position for sequential placement
    let nextStartTime = 0

    // Process all selected files
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type (including 3D models by extension)
      const ext = file.name.toLowerCase().split('.').pop()
      const is3DModel = ext === 'glb' || ext === 'gltf'
      if (
        !file.type.startsWith('video/') &&
        !file.type.startsWith('image/') &&
        !file.type.startsWith('audio/') &&
        !is3DModel
      ) {
        continue
      }

      try {
        const mediaFile = await addFile(file)
        const duration = mediaFile.duration || 10

        addClip(track.id, mediaFile.id, nextStartTime, duration)

        // Update next start time for sequential placement
        nextStartTime += duration
      } catch (err) {
        console.error('Failed to add file:', err)
      }
    }

    // Reset input so same file can be selected again
    e.target.value = ''
  }, [addFile, addClip, tracks, trackType])

  // Open file dialog
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return {
    isDragOver,
    fileInputRef,
    openFileDialog,
    handleFileInputChange,
    dropZoneProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  }
}
