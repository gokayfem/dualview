/**
 * Persistence Store (PERSIST-001, PERSIST-002, PERSIST-003, PERSIST-004, PROJECT-001)
 * 
 * Manages project persistence to IndexedDB with:
 * - Auto-save with debouncing
 * - Project load/restore
 * - Project export/import as .dualview files
 * - Project metadata (title, description, tags)
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  initDB,
  saveProject,
  getProject,
  getAllProjects,
  deleteProject as deleteProjectFromDB,
  saveMediaBlob,
  getProjectMediaBlobs,
  estimateStorageUsage,
  isIndexedDBAvailable,
  type ProjectRecord,
  type MediaManifestEntry,
} from '../lib/indexedDB'
import { useTimelineStore } from './timelineStore'
import { useProjectStore } from './projectStore'
import { useMediaStore } from './mediaStore'
import { useKeyframeStore } from './keyframeStore'
import type { ClipKeyframes } from '../lib/keyframes'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export interface ProjectMetadata {
  id: string
  name: string
  description: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  thumbnail: string | null
}

interface PersistenceStore {
  // State
  currentProjectId: string | null
  projectMetadata: ProjectMetadata | null
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  isLoading: boolean
  error: string | null
  projects: ProjectMetadata[] // List of all saved projects
  storageUsage: { used: number; quota: number; percentUsed: number }
  isIndexedDBSupported: boolean

  // Auto-save timer
  _autoSaveTimeoutId: ReturnType<typeof setTimeout> | null
  _autoSaveDelay: number // ms

  // Actions
  init: () => Promise<void>
  createNewProject: (name?: string) => Promise<string>
  saveCurrentProject: () => Promise<void>
  loadProject: (projectId: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  duplicateProject: (projectId: string) => Promise<string>
  updateProjectMetadata: (updates: Partial<Pick<ProjectMetadata, 'name' | 'description' | 'tags'>>) => void
  refreshProjectList: () => Promise<void>
  updateStorageUsage: () => Promise<void>
  
  // Export/Import
  exportProject: (projectId?: string) => Promise<Blob>
  importProject: (file: File) => Promise<string>

  // PROJECT-002: Templates
  applyTemplate: (templateConfig: {
    aspectRatioSettings: import('../types').AspectRatioSettings
    trackCount: number
    trackNames: string[]
    trackTypes: ('a' | 'b' | 'c' | 'd')[]
    comparisonMode: import('../types').ComparisonMode
    blendMode: import('../types').BlendMode
    sliderOrientation: 'vertical' | 'horizontal'
    sliderPosition: number
  }) => Promise<void>

  // Auto-save
  triggerAutoSave: () => void
  cancelAutoSave: () => void

  // Internal
  _markUnsaved: () => void
  _captureProjectThumbnail: () => Promise<string | null>
}

// Serialize timeline state for storage
function serializeTimelineState(): string {
  const state = useTimelineStore.getState()
  return JSON.stringify({
    tracks: state.tracks,
    currentTime: state.currentTime,
    duration: state.duration,
    zoom: state.zoom,
    playbackSpeed: state.playbackSpeed,
    loopRegion: state.loopRegion,
    frameRate: state.frameRate,
    markers: state.markers,
    snapEnabled: state.snapEnabled,
    snapThreshold: state.snapThreshold,
    rippleEnabled: state.rippleEnabled,
  })
}

// Serialize project settings for storage
function serializeProjectSettings(): string {
  const state = useProjectStore.getState()
  return JSON.stringify({
    comparisonMode: state.comparisonMode,
    blendMode: state.blendMode,
    splitLayout: state.splitLayout,
    sliderPosition: state.sliderPosition,
    sliderOrientation: state.sliderOrientation,
    hideSlider: state.hideSlider,
    aspectRatioSettings: state.aspectRatioSettings,
    webglComparisonSettings: state.webglComparisonSettings,
    scopesSettings: state.scopesSettings,
    quadViewSettings: state.quadViewSettings,
    radialLoupeSettings: state.radialLoupeSettings,
    gridTileSettings: state.gridTileSettings,
    pixelGridSettings: state.pixelGridSettings,
    morphologicalSettings: state.morphologicalSettings,
    exportSettings: state.exportSettings,
  })
}

// KEYFRAME-001: Serialize keyframe data for storage
// Map doesn't serialize to JSON, so we convert to array of tuples
function serializeKeyframeData(): string {
  const state = useKeyframeStore.getState()
  const entries = Array.from(state.clipKeyframes.entries())
  return JSON.stringify(entries)
}

// KEYFRAME-001: Deserialize keyframe data from storage
function deserializeKeyframeData(json: string): Map<string, ClipKeyframes> {
  try {
    const entries = JSON.parse(json) as [string, ClipKeyframes][]
    return new Map(entries)
  } catch {
    return new Map()
  }
}

// Get media manifest (metadata without blobs)
function getMediaManifest(): MediaManifestEntry[] {
  const files = useMediaStore.getState().files
  return files.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    duration: f.duration,
    width: f.width,
    height: f.height,
    promptText: f.promptText,
    waveformPeaks: f.waveformPeaks,
    // MEDIA-012: Include status (stored files should always be 'ready')
    status: f.status || 'ready',
  }))
}

export const usePersistenceStore = create<PersistenceStore>((set, get) => ({
  currentProjectId: null,
  projectMetadata: null,
  saveStatus: 'saved',
  lastSavedAt: null,
  isLoading: false,
  error: null,
  projects: [],
  storageUsage: { used: 0, quota: 0, percentUsed: 0 },
  isIndexedDBSupported: isIndexedDBAvailable(),
  _autoSaveTimeoutId: null,
  _autoSaveDelay: 500, // 500ms debounce

  init: async () => {
    if (!isIndexedDBAvailable()) {
      console.warn('IndexedDB is not available. Projects will not be persisted.')
      return
    }

    try {
      await initDB()
      await get().refreshProjectList()
      await get().updateStorageUsage()
    } catch (error) {
      console.error('Failed to initialize persistence:', error)
      set({ error: 'Failed to initialize project storage' })
    }
  },

  createNewProject: async (name?: string) => {
    const projectId = uuidv4()
    const now = new Date()
    
    const metadata: ProjectMetadata = {
      id: projectId,
      name: name || `Project ${now.toLocaleDateString()}`,
      description: '',
      tags: [],
      createdAt: now,
      updatedAt: now,
      thumbnail: null,
    }

    set({
      currentProjectId: projectId,
      projectMetadata: metadata,
      saveStatus: 'unsaved',
      lastSavedAt: null,
    })

    // Clear existing media, timeline, and keyframes
    useMediaStore.getState().clearFiles()
    useTimelineStore.setState({
      tracks: [
        { id: 'track-a', name: 'Track A', type: 'a', acceptedTypes: ['video', 'image', 'audio', 'model'], clips: [], muted: false, locked: false },
        { id: 'track-b', name: 'Track B', type: 'b', acceptedTypes: ['video', 'image', 'audio', 'model'], clips: [], muted: false, locked: false },
      ],
      currentTime: 0,
      duration: 30,
      markers: [],
      selectedClipId: null,
      selectedClipIds: [],
    })
    // KEYFRAME-001: Clear keyframes for new project
    useKeyframeStore.setState({ clipKeyframes: new Map() })

    // Save initial project
    await get().saveCurrentProject()

    return projectId
  },

  saveCurrentProject: async () => {
    const state = get()
    if (!state.currentProjectId || !state.projectMetadata) {
      console.warn('No active project to save')
      return
    }

    if (!isIndexedDBAvailable()) {
      set({ saveStatus: 'error', error: 'IndexedDB not available' })
      return
    }

    set({ saveStatus: 'saving' })

    try {
      // Capture thumbnail
      const thumbnail = await state._captureProjectThumbnail()

      // Build project record
      const projectRecord: ProjectRecord = {
        id: state.currentProjectId,
        name: state.projectMetadata.name,
        description: state.projectMetadata.description,
        tags: state.projectMetadata.tags,
        createdAt: state.projectMetadata.createdAt.getTime(),
        updatedAt: Date.now(),
        thumbnail,
        timelineState: serializeTimelineState(),
        projectSettings: serializeProjectSettings(),
        mediaManifest: getMediaManifest(),
        // KEYFRAME-001: Include keyframe data
        keyframeData: serializeKeyframeData(),
      }

      // Save project record
      await saveProject(projectRecord)

      // Save media blobs
      const mediaFiles = useMediaStore.getState().files
      for (const file of mediaFiles) {
        if (file.file) {
          await saveMediaBlob(state.currentProjectId, file.id, file.file)
        }
      }

      const now = new Date()
      set({
        saveStatus: 'saved',
        lastSavedAt: now,
        projectMetadata: {
          ...state.projectMetadata,
          updatedAt: now,
          thumbnail,
        },
      })

      // Refresh project list
      await get().refreshProjectList()
      await get().updateStorageUsage()
    } catch (error) {
      console.error('Failed to save project:', error)
      set({ saveStatus: 'error', error: 'Failed to save project' })
    }
  },

  loadProject: async (projectId: string) => {
    if (!isIndexedDBAvailable()) {
      set({ error: 'IndexedDB not available' })
      return
    }

    set({ isLoading: true, error: null })

    try {
      // Get project record
      const projectRecord = await getProject(projectId)
      if (!projectRecord) {
        throw new Error('Project not found')
      }

      // Get media blobs
      const mediaBlobs = await getProjectMediaBlobs(projectId)

      // Clear current media
      useMediaStore.getState().clearFiles()

      // Restore media files
      const mediaStore = useMediaStore.getState()
      for (const entry of projectRecord.mediaManifest) {
        const blob = mediaBlobs.get(entry.id)
        if (blob) {
          // Create a File from the blob
          const file = new File([blob], entry.name, { type: blob.type })
          const mediaFile = await mediaStore.addFile(file)
          
          // The addFile creates a new ID, but we need to use the original ID
          // So we need to update the store directly
          useMediaStore.setState(state => ({
            files: state.files.map(f => 
              f.name === entry.name && f.id === mediaFile.id
                ? { ...f, id: entry.id, promptText: entry.promptText, waveformPeaks: entry.waveformPeaks }
                : f
            )
          }))
        } else if (entry.type === 'prompt' && entry.promptText) {
          // Restore prompt entries
          await mediaStore.addPrompt(entry.promptText, entry.name)
        }
      }

      // Restore timeline state
      const timelineState = JSON.parse(projectRecord.timelineState)
      useTimelineStore.setState({
        tracks: timelineState.tracks,
        currentTime: timelineState.currentTime || 0,
        duration: timelineState.duration || 30,
        zoom: timelineState.zoom || 1,
        playbackSpeed: timelineState.playbackSpeed || 1,
        loopRegion: timelineState.loopRegion || null,
        frameRate: timelineState.frameRate || 30,
        markers: timelineState.markers || [],
        snapEnabled: timelineState.snapEnabled ?? true,
        snapThreshold: timelineState.snapThreshold || 0.1,
        rippleEnabled: timelineState.rippleEnabled ?? false,
      })

      // Restore project settings
      const projectSettings = JSON.parse(projectRecord.projectSettings)
      useProjectStore.setState({
        comparisonMode: projectSettings.comparisonMode || 'slider',
        blendMode: projectSettings.blendMode || 'difference',
        splitLayout: projectSettings.splitLayout || '2x1',
        sliderPosition: projectSettings.sliderPosition ?? 50,
        sliderOrientation: projectSettings.sliderOrientation || 'vertical',
        hideSlider: projectSettings.hideSlider ?? false,
        aspectRatioSettings: projectSettings.aspectRatioSettings || { preset: '16:9' },
        webglComparisonSettings: projectSettings.webglComparisonSettings,
        scopesSettings: projectSettings.scopesSettings,
        quadViewSettings: projectSettings.quadViewSettings,
        radialLoupeSettings: projectSettings.radialLoupeSettings,
        gridTileSettings: projectSettings.gridTileSettings,
        pixelGridSettings: projectSettings.pixelGridSettings,
        morphologicalSettings: projectSettings.morphologicalSettings,
        exportSettings: projectSettings.exportSettings,
      })

      // KEYFRAME-001: Restore keyframe data
      if (projectRecord.keyframeData) {
        const keyframeMap = deserializeKeyframeData(projectRecord.keyframeData)
        useKeyframeStore.setState({ clipKeyframes: keyframeMap })
      } else {
        // Clear keyframes if project has none
        useKeyframeStore.setState({ clipKeyframes: new Map() })
      }

      // Update persistence state
      set({
        currentProjectId: projectId,
        projectMetadata: {
          id: projectRecord.id,
          name: projectRecord.name,
          description: projectRecord.description,
          tags: projectRecord.tags,
          createdAt: new Date(projectRecord.createdAt),
          updatedAt: new Date(projectRecord.updatedAt),
          thumbnail: projectRecord.thumbnail,
        },
        saveStatus: 'saved',
        lastSavedAt: new Date(projectRecord.updatedAt),
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to load project:', error)
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load project',
      })
    }
  },

  deleteProject: async (projectId: string) => {
    if (!isIndexedDBAvailable()) {
      set({ error: 'IndexedDB not available' })
      return
    }

    try {
      await deleteProjectFromDB(projectId)

      // If deleting current project, clear state
      if (get().currentProjectId === projectId) {
        set({
          currentProjectId: null,
          projectMetadata: null,
          saveStatus: 'saved',
          lastSavedAt: null,
        })
        useMediaStore.getState().clearFiles()
      }

      await get().refreshProjectList()
      await get().updateStorageUsage()
    } catch (error) {
      console.error('Failed to delete project:', error)
      set({ error: 'Failed to delete project' })
    }
  },

  duplicateProject: async (projectId: string) => {
    if (!isIndexedDBAvailable()) {
      throw new Error('IndexedDB not available')
    }

    // Load the original project
    const original = await getProject(projectId)
    if (!original) {
      throw new Error('Project not found')
    }

    // Create new project with duplicated data
    const newId = uuidv4()
    const now = Date.now()

    const duplicateRecord: ProjectRecord = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    }

    await saveProject(duplicateRecord)

    // Duplicate media blobs
    const mediaBlobs = await getProjectMediaBlobs(projectId)
    for (const [mediaId, blob] of mediaBlobs) {
      await saveMediaBlob(newId, mediaId, blob)
    }

    await get().refreshProjectList()
    return newId
  },

  updateProjectMetadata: (updates) => {
    const state = get()
    if (!state.projectMetadata) return

    set({
      projectMetadata: {
        ...state.projectMetadata,
        ...updates,
      },
    })

    // Trigger auto-save
    state.triggerAutoSave()
  },

  refreshProjectList: async () => {
    if (!isIndexedDBAvailable()) return

    try {
      const records = await getAllProjects()
      const projects: ProjectMetadata[] = records.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        tags: r.tags,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
        thumbnail: r.thumbnail,
      }))
      set({ projects })
    } catch (error) {
      console.error('Failed to refresh project list:', error)
    }
  },

  updateStorageUsage: async () => {
    const usage = await estimateStorageUsage()
    set({ storageUsage: usage })
  },

  exportProject: async (projectId?: string) => {
    const id = projectId || get().currentProjectId
    if (!id) {
      throw new Error('No project to export')
    }

    const projectRecord = await getProject(id)
    if (!projectRecord) {
      throw new Error('Project not found')
    }

    const mediaBlobs = await getProjectMediaBlobs(id)

    // Build export package
    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      project: projectRecord,
      mediaFiles: [] as Array<{ id: string; name: string; type: string; data: string }>,
    }

    // Convert media blobs to base64
    for (const entry of projectRecord.mediaManifest) {
      const blob = mediaBlobs.get(entry.id)
      if (blob) {
        const base64 = await blobToBase64(blob)
        exportData.mediaFiles.push({
          id: entry.id,
          name: entry.name,
          type: blob.type,
          data: base64,
        })
      }
    }

    // Create JSON blob
    const json = JSON.stringify(exportData)
    return new Blob([json], { type: 'application/json' })
  },

  importProject: async (file: File) => {
    const text = await file.text()
    const exportData = JSON.parse(text)

    if (exportData.version !== 1) {
      throw new Error('Unsupported project file version')
    }

    // Create new project ID
    const newId = uuidv4()
    const now = Date.now()

    const projectRecord: ProjectRecord = {
      ...exportData.project,
      id: newId,
      createdAt: now,
      updatedAt: now,
    }

    await saveProject(projectRecord)

    // Restore media blobs
    for (const mediaFile of exportData.mediaFiles) {
      const blob = base64ToBlob(mediaFile.data, mediaFile.type)
      await saveMediaBlob(newId, mediaFile.id, blob)
    }

    await get().refreshProjectList()
    return newId
  },

  // PROJECT-002: Apply template to current project
  applyTemplate: async (templateConfig) => {
    // Apply to project store
    useProjectStore.setState({
      aspectRatioSettings: templateConfig.aspectRatioSettings,
      comparisonMode: templateConfig.comparisonMode,
      blendMode: templateConfig.blendMode,
      sliderOrientation: templateConfig.sliderOrientation,
      sliderPosition: templateConfig.sliderPosition,
    })

    // Update timeline tracks if needed
    const currentTracks = useTimelineStore.getState().tracks
    const newTracks = templateConfig.trackTypes.map((type, index) => {
      const existingTrack = currentTracks[index]
      return {
        id: existingTrack?.id || `track-${type}`,
        name: templateConfig.trackNames[index] || `Track ${type.toUpperCase()}`,
        type,
        acceptedTypes: existingTrack?.acceptedTypes || ['video', 'image', 'audio', 'model'] as const,
        clips: existingTrack?.clips || [],
        muted: existingTrack?.muted || false,
        locked: existingTrack?.locked || false,
      }
    })

    useTimelineStore.setState({ tracks: newTracks as any })
    
    // Trigger a save after applying template
    get().triggerAutoSave()
  },

  triggerAutoSave: () => {
    const state = get()
    
    // Cancel existing timeout
    if (state._autoSaveTimeoutId) {
      clearTimeout(state._autoSaveTimeoutId)
    }

    // Mark as unsaved
    set({ saveStatus: 'unsaved' })

    // Schedule auto-save
    const timeoutId = setTimeout(() => {
      get().saveCurrentProject()
    }, state._autoSaveDelay)

    set({ _autoSaveTimeoutId: timeoutId })
  },

  cancelAutoSave: () => {
    const state = get()
    if (state._autoSaveTimeoutId) {
      clearTimeout(state._autoSaveTimeoutId)
      set({ _autoSaveTimeoutId: null })
    }
  },

  _markUnsaved: () => {
    set({ saveStatus: 'unsaved' })
    get().triggerAutoSave()
  },

  _captureProjectThumbnail: async () => {
    // Try to capture a thumbnail from the comparison view
    try {
      const canvas = document.querySelector('.comparison-canvas') as HTMLCanvasElement
      if (canvas) {
        // Create a smaller thumbnail
        const thumbCanvas = document.createElement('canvas')
        thumbCanvas.width = 320
        thumbCanvas.height = 180
        const ctx = thumbCanvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
          return thumbCanvas.toDataURL('image/jpeg', 0.7)
        }
      }
    } catch {
      // Fallback: no thumbnail
    }
    return null
  },
}))

// Helper: Convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Helper: Convert base64 to blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  // Handle data URLs
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

// Subscribe to store changes to trigger auto-save
// These subscriptions are set up when the module loads

// Timeline changes
useTimelineStore.subscribe((state, prevState) => {
  const persistence = usePersistenceStore.getState()
  if (!persistence.currentProjectId) return

  // Check for meaningful changes
  if (
    state.tracks !== prevState.tracks ||
    state.markers !== prevState.markers ||
    state.duration !== prevState.duration
  ) {
    persistence._markUnsaved()
  }
})

// Project settings changes
useProjectStore.subscribe((state, prevState) => {
  const persistence = usePersistenceStore.getState()
  if (!persistence.currentProjectId) return

  // Check for meaningful changes (excluding transient state)
  if (
    state.comparisonMode !== prevState.comparisonMode ||
    state.blendMode !== prevState.blendMode ||
    state.sliderOrientation !== prevState.sliderOrientation ||
    state.aspectRatioSettings !== prevState.aspectRatioSettings ||
    state.exportSettings !== prevState.exportSettings
  ) {
    persistence._markUnsaved()
  }
})

// Media library changes
useMediaStore.subscribe((state, prevState) => {
  const persistence = usePersistenceStore.getState()
  if (!persistence.currentProjectId) return

  if (state.files.length !== prevState.files.length) {
    persistence._markUnsaved()
  }
})
