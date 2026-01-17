import { create } from 'zustand'
import type { MediaFile, MediaType } from '../types'
import { generateId } from '../lib/utils'
import { useTimelineStore } from './timelineStore'
import { generateModelThumbnail } from '../lib/modelThumbnail'
import { getDocumentType, parseDocument, generateDocumentThumbnail } from '../lib/documentParser'

interface MediaStore {
  files: MediaFile[]
  selectedIds: string[]

  addFile: (file: File) => Promise<MediaFile>
  addPrompt: (promptText: string, name?: string) => Promise<MediaFile>
  removeFile: (id: string) => void
  selectFile: (id: string) => void
  deselectFile: (id: string) => void
  clearSelection: () => void
  getFile: (id: string) => MediaFile | undefined
  clearFiles: () => void
  // MEDIA-012: Status management
  updateStatus: (id: string, status: MediaFile['status'], message?: string) => void
  retryProcessing: (id: string) => Promise<void>
}

async function processFile(file: File): Promise<MediaFile> {
  const id = generateId()
  const url = URL.createObjectURL(file)

  // Detect file type including 3D models and documents
  const extension = file.name.toLowerCase().split('.').pop()
  const isModel = extension === 'glb' || extension === 'gltf'
  const documentType = getDocumentType(file.name)

  const type: MediaType = documentType
    ? documentType
    : isModel
      ? 'model'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('image/')
          ? 'image'
          : 'audio'

  const mediaFile: MediaFile = {
    id,
    name: file.name,
    type,
    url,
    file,
    status: 'processing', // MEDIA-012: Initial status
    processingProgress: 0,
  }

  // Get video/image dimensions and duration
  if (type === 'video') {
    const video = document.createElement('video')
    video.src = url
    video.preload = 'metadata'

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        mediaFile.duration = video.duration
        mediaFile.width = video.videoWidth
        mediaFile.height = video.videoHeight
        resolve()
      }
    })

    // Generate thumbnail
    video.currentTime = 0
    await new Promise<void>((resolve) => {
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          mediaFile.thumbnail = canvas.toDataURL('image/jpeg', 0.7)
        }
        resolve()
      }
    })
  } else if (type === 'image') {
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve) => {
      img.onload = () => {
        mediaFile.width = img.naturalWidth
        mediaFile.height = img.naturalHeight

        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          mediaFile.thumbnail = canvas.toDataURL('image/jpeg', 0.7)
        }
        resolve()
      }
    })
  } else if (type === 'audio') {
    const audio = document.createElement('audio')
    audio.src = url
    audio.preload = 'metadata'

    await new Promise<void>((resolve) => {
      audio.onloadedmetadata = () => {
        mediaFile.duration = audio.duration
        resolve()
      }
    })

    // TL-006: Extract waveform peaks for timeline preview
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // Get channel data
      const channelData = audioBuffer.getChannelData(0)
      const samples = 100 // Number of peaks for timeline preview
      const blockSize = Math.floor(channelData.length / samples)
      const peaks: number[] = []

      for (let i = 0; i < samples; i++) {
        const start = i * blockSize
        let max = 0

        for (let j = 0; j < blockSize; j++) {
          const value = Math.abs(channelData[start + j] || 0)
          if (value > max) max = value
        }

        peaks.push(max)
      }

      audioContext.close()
      mediaFile.waveformPeaks = peaks
    } catch (error) {
      console.warn('Failed to extract waveform:', error)
    }
  } else if (type === 'model') {
    // Set default duration for 3D models (5 seconds = one full rotation)
    mediaFile.duration = 5

    // Generate thumbnail for 3D model
    try {
      const thumbnail = await generateModelThumbnail(url)
      if (thumbnail) {
        mediaFile.thumbnail = thumbnail
      }
    } catch (error) {
      console.warn('Failed to generate model thumbnail:', error)
    }
  } else if (type === 'csv' || type === 'excel' || type === 'docx' || type === 'pdf') {
    // Parse document and extract metadata
    try {
      const documentMeta = await parseDocument(file)
      if (documentMeta) {
        mediaFile.documentMeta = documentMeta
      }
      // Generate document thumbnail
      mediaFile.thumbnail = generateDocumentThumbnail(type)
      // Documents don't have duration, set a default for timeline
      mediaFile.duration = 10
    } catch (error) {
      console.warn('Failed to parse document:', error)
    }
  }

  // MEDIA-012: Mark as ready after all processing
  mediaFile.status = 'ready'
  mediaFile.processingProgress = 100

  return mediaFile
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  files: [],
  selectedIds: [],

  addFile: async (file: File) => {
    // MEDIA-012: Create pending entry first
    const pendingId = generateId()
    
    // Detect file type including 3D models and documents (same logic as processFile)
    const extension = file.name.toLowerCase().split('.').pop()
    const isModel = extension === 'glb' || extension === 'gltf'
    const documentType = getDocumentType(file.name)
    const pendingType: MediaType = documentType
      ? documentType
      : isModel
        ? 'model'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'model'
    
    const pendingFile: MediaFile = {
      id: pendingId,
      name: file.name,
      type: pendingType,
      url: '',
      file,
      status: 'pending',
      processingProgress: 0,
    }

    set((state) => ({
      files: [...state.files, pendingFile],
    }))

    // Update status to processing
    set((state) => ({
      files: state.files.map(f => 
        f.id === pendingId 
          ? { ...f, status: 'processing' as const, processingProgress: 10 }
          : f
      ),
    }))

    try {
      const mediaFile = await processFile(file)
      // Replace pending with processed file, keeping the pending ID
      set((state) => ({
        files: state.files.map(f => f.id === pendingId ? { ...mediaFile, id: pendingId } : f),
      }))
      return { ...mediaFile, id: pendingId }
    } catch (error) {
      // MEDIA-012: Mark as error
      set((state) => ({
        files: state.files.map(f => 
          f.id === pendingId 
            ? { ...f, status: 'error' as const, statusMessage: error instanceof Error ? error.message : 'Processing failed' }
            : f
        ),
      }))
      throw error
    }
  },

  addPrompt: async (promptText: string, name?: string) => {
    const id = generateId()
    const fileName = name || `prompt-${Date.now()}.txt`
    const file = new File([promptText], fileName, { type: 'text/plain' })
    const url = URL.createObjectURL(file)

    const mediaFile: MediaFile = {
      id,
      name: fileName,
      type: 'prompt',
      url,
      file,
      promptText,
      status: 'ready', // MEDIA-012: Prompts are immediately ready
    }

    set((state) => ({
      files: [...state.files, mediaFile],
    }))

    return mediaFile
  },

  removeFile: (id: string) => {
    const file = get().files.find(f => f.id === id)
    if (file) {
      URL.revokeObjectURL(file.url)
    }

    // Cascade delete: remove all clips using this media from the timeline
    useTimelineStore.getState().removeClipsByMediaId(id)

    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      selectedIds: state.selectedIds.filter((i) => i !== id),
    }))
  },

  selectFile: (id: string) => {
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds
        : [...state.selectedIds, id],
    }))
  },

  deselectFile: (id: string) => {
    set((state) => ({
      selectedIds: state.selectedIds.filter((i) => i !== id),
    }))
  },

  clearSelection: () => {
    set({ selectedIds: [] })
  },

  getFile: (id: string) => {
    return get().files.find((f) => f.id === id)
  },

  clearFiles: () => {
    // Revoke all blob URLs
    get().files.forEach(file => {
      if (file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url)
      }
    })
    set({ files: [], selectedIds: [] })
  },

  // MEDIA-012: Update file status
  updateStatus: (id: string, status: MediaFile['status'], message?: string) => {
    set((state) => ({
      files: state.files.map(f =>
        f.id === id
          ? { ...f, status, statusMessage: message }
          : f
      ),
    }))
  },

  // MEDIA-012: Retry failed processing
  retryProcessing: async (id: string) => {
    const file = get().files.find(f => f.id === id)
    if (!file || file.status !== 'error') return

    // Mark as pending
    set((state) => ({
      files: state.files.map(f =>
        f.id === id
          ? { ...f, status: 'pending' as const, statusMessage: undefined, processingProgress: 0 }
          : f
      ),
    }))

    try {
      const newMediaFile = await processFile(file.file)
      set((state) => ({
        files: state.files.map(f =>
          f.id === id
            ? { ...newMediaFile, id } // Keep original ID
            : f
        ),
      }))
    } catch (error) {
      set((state) => ({
        files: state.files.map(f =>
          f.id === id
            ? { ...f, status: 'error' as const, statusMessage: error instanceof Error ? error.message : 'Retry failed' }
            : f
        ),
      }))
    }
  },
}))
