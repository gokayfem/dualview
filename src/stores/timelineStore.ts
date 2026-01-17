import { create } from 'zustand'
import type { TimelineTrack, TimelineClip, MediaType, TrackType } from '../types'
import { generateId, snapTimeToFrame } from '../lib/utils'

// Track colors for visual distinction
const TRACK_COLORS: Record<TrackType, string> = {
  'a': '#f97316', // orange
  'b': '#a3e635', // lime
  'audio': '#60a5fa', // blue
  'text': '#c084fc', // purple
  'media': '#4ade80', // green
}

// Helper to calculate the maximum end time from all clips
function calculateMaxDuration(tracks: TimelineTrack[]): number {
  let maxEndTime = 0
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.endTime > maxEndTime) {
        maxEndTime = clip.endTime
      }
    }
  }
  // Return at least 1 second if no clips, otherwise the max end time
  return maxEndTime > 0 ? maxEndTime : 1
}

interface LoopRegion {
  inPoint: number
  outPoint: number
}

export interface TimelineMarker {
  id: string
  time: number
  label: string
  color?: string
}

interface TimelineStore {
  tracks: TimelineTrack[]
  currentTime: number
  duration: number
  isPlaying: boolean
  zoom: number
  selectedClipId: string | null
  selectedClipIds: string[] // TL-004: Multi-clip selection
  playbackSpeed: number
  loopRegion: LoopRegion | null
  frameRate: number
  markers: TimelineMarker[]
  shuttleSpeed: number // For J/K/L controls: negative = reverse, 0 = pause
  snapEnabled: boolean // TL-003: Snap to grid
  snapThreshold: number // TL-003: Snap threshold in seconds
  rippleEnabled: boolean // TL-007: Ripple edit mode
  clipboardClipId: string | null // TL-002: Copy/paste clipboard

  // Playback controls
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setDuration: (duration: number) => void

  // Frame navigation (VID-001)
  stepFrame: (direction: 1 | -1) => void
  getCurrentFrame: () => number

  // Speed control (VID-002)
  setPlaybackSpeed: (speed: number) => void

  // Loop region (VID-003)
  setLoopIn: () => void
  setLoopOut: () => void
  clearLoop: () => void

  // J/K/L Shuttle controls (TL-005)
  shuttleForward: () => void
  shuttleBackward: () => void
  shuttleStop: () => void

  // Zoom controls
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void

  // Track operations
  addTrack: (type: TrackType, name?: string) => TimelineTrack
  removeTrack: (id: string) => void
  toggleTrackMute: (id: string) => void
  toggleTrackLock: (id: string) => void
  setTrackAcceptedTypes: (id: string, types: MediaType[]) => void
  renameTrack: (id: string, name: string) => void
  reorderTracks: (fromIndex: number, toIndex: number) => void

  // Clip operations
  addClip: (trackId: string, mediaId: string, startTime: number, duration: number) => TimelineClip
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void
  selectClip: (clipId: string | null) => void
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void
  trimClip: (clipId: string, side: 'start' | 'end', newTime: number) => void
  splitClip: (clipId: string, splitTime: number) => TimelineClip | null // TL-001
  splitAndKeepLeft: (clipId: string, splitTime: number) => void // TL-001: Split and delete right portion
  splitAndKeepRight: (clipId: string, splitTime: number) => void // TL-001: Split and delete left portion
  duplicateClip: (clipId: string) => TimelineClip | null // TL-002
  copyClip: (clipId: string) => void // TL-002
  pasteClip: (trackId: string, time: number) => TimelineClip | null // TL-002
  pasteAtPlayhead: () => TimelineClip | null // Paste at current playhead with overlap resolution
  replaceClipMedia: (clipId: string, newMediaId: string, newDuration?: number) => void // Replace media keeping position
  separateAudio: (clipId: string) => string | null // Extract audio to new track, returns new clip id

  // TL-003: Snap
  toggleSnap: () => void
  setSnapThreshold: (threshold: number) => void
  getSnapPoint: (time: number, excludeClipId?: string) => number | null
  getZoomAwareSnapThreshold: () => number // Snap threshold adjusted for zoom level

  // Overlap detection
  checkOverlap: (trackId: string, startTime: number, endTime: number, excludeClipId?: string) => boolean
  getOverlappingClips: (trackId: string, startTime: number, endTime: number, excludeClipId?: string) => TimelineClip[]

  // TL-004: Multi-clip selection
  selectClips: (clipIds: string[]) => void
  addToSelection: (clipId: string) => void
  toggleSelection: (clipId: string) => void
  selectAllClips: () => void
  clearSelection: () => void

  // TL-007: Ripple edit
  toggleRipple: () => void

  // Cascade operations (for media deletion)
  removeClipsByMediaId: (mediaId: string) => void

  // Getters
  getClipAtTime: (trackId: string, time: number) => TimelineClip | undefined
  getTrack: (id: string) => TimelineTrack | undefined

  // Markers (VID-006)
  addMarker: (label?: string) => TimelineMarker
  removeMarker: (id: string) => void
  updateMarker: (id: string, updates: Partial<TimelineMarker>) => void
  jumpToMarker: (id: string) => void
  getMarkerAtTime: (time: number) => TimelineMarker | undefined
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  tracks: [
    { id: 'track-a', name: 'Track A', type: 'a', acceptedTypes: ['video', 'image', 'audio', 'model'], clips: [], muted: false, locked: false },
    { id: 'track-b', name: 'Track B', type: 'b', acceptedTypes: ['video', 'image', 'audio', 'model'], clips: [], muted: false, locked: false },
  ],
  currentTime: 0,
  duration: 30,
  isPlaying: false,
  zoom: 1,
  selectedClipId: null,
  selectedClipIds: [],
  playbackSpeed: 1,
  loopRegion: null,
  frameRate: 30, // Default framerate, can be updated based on video
  markers: [],
  shuttleSpeed: 0,
  snapEnabled: true,
  snapThreshold: 0.1, // 100ms snap threshold
  rippleEnabled: false,
  clipboardClipId: null,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  seek: (time: number) => {
    const { duration, frameRate } = get()
    // TL-002: Snap to frame boundary
    const snappedTime = snapTimeToFrame(Math.max(0, Math.min(time, duration)), frameRate)
    set({ currentTime: snappedTime })
  },

  setDuration: (duration: number) => set({ duration }),

  // Frame navigation (VID-001)
  stepFrame: (direction: 1 | -1) => {
    const { currentTime, duration, frameRate } = get()
    const frameTime = 1 / frameRate
    const newTime = currentTime + direction * frameTime
    set({ currentTime: Math.max(0, Math.min(newTime, duration)) })
  },

  getCurrentFrame: () => {
    const { currentTime, frameRate } = get()
    return Math.floor(currentTime * frameRate)
  },

  // Speed control (VID-002)
  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: Math.max(0.25, Math.min(4, speed)) })
  },

  // Loop region (VID-003)
  setLoopIn: () => {
    const { currentTime, loopRegion } = get()
    if (loopRegion) {
      set({ loopRegion: { ...loopRegion, inPoint: currentTime } })
    } else {
      set({ loopRegion: { inPoint: currentTime, outPoint: currentTime + 1 } })
    }
  },

  setLoopOut: () => {
    const { currentTime, loopRegion } = get()
    if (loopRegion) {
      set({ loopRegion: { ...loopRegion, outPoint: currentTime } })
    } else {
      set({ loopRegion: { inPoint: Math.max(0, currentTime - 1), outPoint: currentTime } })
    }
  },

  clearLoop: () => set({ loopRegion: null }),

  // J/K/L Shuttle controls (TL-005)
  shuttleForward: () => {
    const { shuttleSpeed } = get()
    // Speed progression: 1, 2, 4, 8
    let newSpeed: number
    if (shuttleSpeed <= 0) {
      newSpeed = 1
    } else if (shuttleSpeed < 8) {
      newSpeed = shuttleSpeed * 2
    } else {
      newSpeed = 8
    }
    set({ shuttleSpeed: newSpeed, playbackSpeed: newSpeed, isPlaying: true })
  },

  shuttleBackward: () => {
    const { shuttleSpeed } = get()
    // Speed progression: -1, -2, -4, -8
    let newSpeed: number
    if (shuttleSpeed >= 0) {
      newSpeed = -1
    } else if (shuttleSpeed > -8) {
      newSpeed = shuttleSpeed * 2
    } else {
      newSpeed = -8
    }
    set({ shuttleSpeed: newSpeed, playbackSpeed: Math.abs(newSpeed), isPlaying: true })
  },

  shuttleStop: () => {
    set({ shuttleSpeed: 0, isPlaying: false, playbackSpeed: 1 })
  },

  setZoom: (zoom: number) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  zoomIn: () => set((state) => ({ zoom: Math.min(10, state.zoom * 1.2) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(0.1, state.zoom / 1.2) })),

  // Add new track
  addTrack: (type: TrackType, name?: string) => {
    const state = get()
    const existingTracks = state.tracks.filter(t => t.type === type || (type === 'media' && !['a', 'b'].includes(t.type)))
    const trackNumber = existingTracks.length + 1

    // Generate track name if not provided
    const trackName = name || (() => {
      switch (type) {
        case 'media': return `Track ${state.tracks.length + 1}`
        case 'audio': return `Audio ${trackNumber}`
        case 'text': return `Text ${trackNumber}`
        default: return `Track ${trackNumber}`
      }
    })()

    // Determine accepted types based on track type
    const acceptedTypes: MediaType[] = (() => {
      switch (type) {
        case 'audio': return ['audio']
        case 'text': return ['prompt'] // Text/prompts for captions
        case 'media': return ['video', 'image', 'model']
        default: return ['video', 'image', 'audio', 'model']
      }
    })()

    const newTrack: TimelineTrack = {
      id: generateId(),
      name: trackName,
      type,
      acceptedTypes,
      clips: [],
      muted: false,
      locked: false,
      color: TRACK_COLORS[type],
    }

    set({ tracks: [...state.tracks, newTrack] })
    return newTrack
  },

  removeTrack: (id: string) => {
    const state = get()
    // Prevent removing the last comparison track
    const track = state.tracks.find(t => t.id === id)
    if (track && (track.type === 'a' || track.type === 'b')) {
      const comparisonTracks = state.tracks.filter(t => t.type === 'a' || t.type === 'b')
      if (comparisonTracks.length <= 2) {
        console.warn('Cannot remove comparison tracks A or B')
        return
      }
    }
    set({ tracks: state.tracks.filter((t) => t.id !== id) })
  },

  toggleTrackMute: (id: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, muted: !t.muted } : t
      ),
    }))
  },

  toggleTrackLock: (id: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, locked: !t.locked } : t
      ),
    }))
  },

  setTrackAcceptedTypes: (id: string, types: MediaType[]) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, acceptedTypes: types } : t
      ),
    }))
  },

  renameTrack: (id: string, name: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, name } : t
      ),
    }))
  },

  reorderTracks: (fromIndex: number, toIndex: number) => {
    const state = get()
    const newTracks = [...state.tracks]
    const [removed] = newTracks.splice(fromIndex, 1)
    newTracks.splice(toIndex, 0, removed)
    set({ tracks: newTracks })
  },

  addClip: (trackId: string, mediaId: string, startTime: number, clipDuration: number) => {
    const { frameRate } = get()
    // TL-002: Snap clip times to frame boundaries
    const snappedStart = snapTimeToFrame(startTime, frameRate)
    const snappedDuration = snapTimeToFrame(clipDuration, frameRate)

    const clip: TimelineClip = {
      id: generateId(),
      mediaId,
      trackId,
      startTime: snappedStart,
      endTime: snappedStart + snappedDuration,
      inPoint: 0,
      outPoint: snappedDuration,
    }

    const updatedTracks = get().tracks.map((t) =>
      t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
    )

    // Recalculate duration based on all clips
    const newDuration = calculateMaxDuration(updatedTracks)
    set({ tracks: updatedTracks, duration: newDuration })

    return clip
  },

  removeClip: (clipId: string) => {
    const state = get()

    // TL-012: Find the clip being removed for ripple calculation
    let removedClip: TimelineClip | undefined
    let removedTrackId: string | undefined

    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        removedClip = clip
        removedTrackId = track.id
        break
      }
    }

    const updatedTracks = state.tracks.map((t) => {
      // Remove the clip
      let clips = t.clips.filter((c) => c.id !== clipId)

      // TL-012: Ripple edit - shift subsequent clips left on same track
      if (state.rippleEnabled && removedClip && t.id === removedTrackId) {
        const removedDuration = removedClip.endTime - removedClip.startTime
        clips = clips.map(c => {
          if (c.startTime >= removedClip!.endTime) {
            // Shift clip left by the removed clip's duration
            return {
              ...c,
              startTime: c.startTime - removedDuration,
              endTime: c.endTime - removedDuration,
            }
          }
          return c
        })
      }

      return { ...t, clips }
    })

    // Recalculate duration based on remaining clips
    const newDuration = calculateMaxDuration(updatedTracks)

    set({
      tracks: updatedTracks,
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
      duration: newDuration,
    })
  },

  updateClip: (clipId: string, updates: Partial<TimelineClip>) => {
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, ...updates } : c
        ),
      })),
    }))
  },

  selectClip: (clipId: string | null) => {
    set({ selectedClipId: clipId })
  },

  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => {
    const state = get()
    const { frameRate } = state
    let clip: TimelineClip | undefined

    // Find and remove clip from current track
    const tracks = state.tracks.map((t) => {
      const foundClip = t.clips.find((c) => c.id === clipId)
      if (foundClip) {
        clip = { ...foundClip }
        return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
      }
      return t
    })

    if (!clip) return

    // TL-002: Snap to frame boundary
    const clipDuration = clip.endTime - clip.startTime
    clip.startTime = snapTimeToFrame(Math.max(0, newStartTime), frameRate)
    clip.endTime = clip.startTime + clipDuration
    clip.trackId = newTrackId

    // Add to new track
    const updatedTracks = tracks.map((t) =>
      t.id === newTrackId ? { ...t, clips: [...t.clips, clip!] } : t
    )

    // Recalculate duration based on all clips
    const newDuration = calculateMaxDuration(updatedTracks)

    set({ tracks: updatedTracks, duration: newDuration })
  },

  trimClip: (clipId: string, side: 'start' | 'end', newTime: number) => {
    const state = get()
    const { frameRate, rippleEnabled } = state
    const minClipDuration = 1 / frameRate // Minimum one frame

    // Find the clip and its track for ripple calculation
    let originalClip: TimelineClip | undefined
    let clipTrackId: string | undefined

    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        originalClip = clip
        clipTrackId = track.id
        break
      }
    }

    if (!originalClip) return

    // Calculate trim delta first for ripple
    let trimDelta = 0
    const snappedTime = snapTimeToFrame(newTime, frameRate)

    if (side === 'end') {
      const constrainedNewTime = Math.max(originalClip.startTime + minClipDuration, snappedTime)
      trimDelta = constrainedNewTime - originalClip.endTime
    }

    const updatedTracks = state.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => {
        // TL-012: Ripple edit - shift subsequent clips when trimming end
        if (c.id !== clipId && rippleEnabled && t.id === clipTrackId && side === 'end' && c.startTime >= originalClip!.endTime) {
          return {
            ...c,
            startTime: Math.max(0, c.startTime + trimDelta),
            endTime: c.endTime + trimDelta,
          }
        }

        if (c.id !== clipId) return c

        if (side === 'start') {
          // TL-002: Snap to frame boundary
          const constrainedNewTime = Math.max(0, Math.min(snappedTime, c.endTime - minClipDuration))
          const delta = constrainedNewTime - c.startTime
          const newInPoint = c.inPoint + delta

          // Don't allow inPoint to go negative or past outPoint
          if (newInPoint < 0 || newInPoint >= c.outPoint) {
            return c // Invalid trim, return unchanged
          }

          return {
            ...c,
            startTime: constrainedNewTime,
            inPoint: newInPoint,
          }
        } else {
          // TL-002: Snap to frame boundary
          const constrainedNewTime = Math.max(c.startTime + minClipDuration, snappedTime)
          const delta = constrainedNewTime - c.endTime
          const newOutPoint = c.outPoint + delta

          // Don't allow outPoint to go negative or before inPoint
          if (newOutPoint <= c.inPoint) {
            return c // Invalid trim, return unchanged
          }

          return {
            ...c,
            endTime: constrainedNewTime,
            outPoint: newOutPoint,
          }
        }
      }),
    }))

    // Recalculate duration based on all clips
    const newDuration = calculateMaxDuration(updatedTracks)

    set({ tracks: updatedTracks, duration: newDuration })
  },

  // TL-001: Split Clip at Playhead
  splitClip: (clipId: string, splitTime: number) => {
    const state = get()
    const { frameRate } = state
    let newClip: TimelineClip | null = null

    // TL-002: Snap split time to frame boundary
    const snappedSplitTime = snapTimeToFrame(splitTime, frameRate)

    // Find the clip and its track
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (!clip) continue

      // Check if split time is within the clip
      if (snappedSplitTime <= clip.startTime || snappedSplitTime >= clip.endTime) {
        return null // Can't split outside clip bounds
      }

      // Calculate split position in media time
      const relativeTime = snappedSplitTime - clip.startTime
      const mediaSplitPoint = clip.inPoint + relativeTime

      // Create second clip (after split)
      newClip = {
        id: generateId(),
        mediaId: clip.mediaId,
        trackId: track.id,
        startTime: snappedSplitTime,
        endTime: clip.endTime,
        inPoint: mediaSplitPoint,
        outPoint: clip.outPoint,
      }

      // Update first clip (before split) and add new clip
      set({
        tracks: state.tracks.map(t => {
          if (t.id !== track.id) return t
          return {
            ...t,
            clips: [
              ...t.clips.map(c => {
                if (c.id !== clipId) return c
                return {
                  ...c,
                  endTime: snappedSplitTime,
                  outPoint: mediaSplitPoint,
                }
              }),
              newClip!,
            ],
          }
        }),
      })

      return newClip
    }

    return null
  },

  // TL-001: Split and keep left (delete everything after split point)
  splitAndKeepLeft: (clipId: string, splitTime: number) => {
    const state = get()
    const { frameRate } = state
    const snappedSplitTime = snapTimeToFrame(splitTime, frameRate)

    // Find the clip
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (!clip) continue

      // Check if split time is within the clip
      if (snappedSplitTime <= clip.startTime || snappedSplitTime >= clip.endTime) {
        return // Can't split outside clip bounds
      }

      // Calculate new out point
      const relativeTime = snappedSplitTime - clip.startTime
      const newOutPoint = clip.inPoint + relativeTime

      // Update clip to end at split point
      set({
        tracks: state.tracks.map(t => {
          if (t.id !== track.id) return t
          return {
            ...t,
            clips: t.clips.map(c => {
              if (c.id !== clipId) return c
              return {
                ...c,
                endTime: snappedSplitTime,
                outPoint: newOutPoint,
              }
            }),
          }
        }),
      })

      return
    }
  },

  // TL-001: Split and keep right (delete everything before split point)
  splitAndKeepRight: (clipId: string, splitTime: number) => {
    const state = get()
    const { frameRate, rippleEnabled } = state
    const snappedSplitTime = snapTimeToFrame(splitTime, frameRate)

    // Find the clip
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (!clip) continue

      // Check if split time is within the clip
      if (snappedSplitTime <= clip.startTime || snappedSplitTime >= clip.endTime) {
        return // Can't split outside clip bounds
      }

      // Calculate new in point and duration change for ripple
      const relativeTime = snappedSplitTime - clip.startTime
      const newInPoint = clip.inPoint + relativeTime

      // Update clip to start at split point
      set({
        tracks: state.tracks.map(t => {
          if (t.id !== track.id) return t
          return {
            ...t,
            clips: t.clips.map(c => {
              if (c.id !== clipId) return c
              // If ripple is enabled, keep the clip at its original start and shift the in point
              if (rippleEnabled) {
                return {
                  ...c,
                  endTime: c.endTime - relativeTime,
                  inPoint: newInPoint,
                }
              }
              // Otherwise, move the clip start to the split point
              return {
                ...c,
                startTime: snappedSplitTime,
                inPoint: newInPoint,
              }
            }),
          }
        }),
      })

      return
    }
  },

  // TL-002: Duplicate Clip
  duplicateClip: (clipId: string) => {
    const state = get()
    let newClip: TimelineClip | null = null

    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (!clip) continue

      // Create duplicate immediately after the original
      newClip = {
        id: generateId(),
        mediaId: clip.mediaId,
        trackId: track.id,
        startTime: clip.endTime,
        endTime: clip.endTime + (clip.endTime - clip.startTime),
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
      }

      set({
        tracks: state.tracks.map(t => {
          if (t.id !== track.id) return t
          return {
            ...t,
            clips: [...t.clips, newClip!],
          }
        }),
      })

      // Extend duration if needed
      if (newClip.endTime > state.duration) {
        set({ duration: newClip.endTime })
      }

      return newClip
    }

    return null
  },

  // TL-002: Copy/Paste
  copyClip: (clipId: string) => {
    set({ clipboardClipId: clipId })
  },

  pasteClip: (trackId: string, time: number) => {
    const state = get()
    if (!state.clipboardClipId) return null

    // Find the original clip
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === state.clipboardClipId)
      if (!clip) continue

      const newClip: TimelineClip = {
        id: generateId(),
        mediaId: clip.mediaId,
        trackId: trackId,
        startTime: time,
        endTime: time + (clip.endTime - clip.startTime),
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
      }

      set({
        tracks: state.tracks.map(t => {
          if (t.id !== trackId) return t
          return { ...t, clips: [...t.clips, newClip] }
        }),
      })

      if (newClip.endTime > state.duration) {
        set({ duration: newClip.endTime })
      }

      return newClip
    }

    return null
  },

  // Paste at playhead with overlap resolution
  pasteAtPlayhead: () => {
    const state = get()
    if (!state.clipboardClipId) return null

    // Find the original clip and its track type
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === state.clipboardClipId)
      if (!clip) continue

      // Find a compatible track (same type or first available)
      const targetTrack = state.tracks.find(t => t.type === track.type) || state.tracks[0]
      if (!targetTrack) return null

      const clipDuration = clip.endTime - clip.startTime
      let pasteTime = state.currentTime

      // Check for overlaps and nudge forward if needed
      const overlappingClips = targetTrack.clips.filter(c =>
        c.id !== clip.id &&
        c.startTime < pasteTime + clipDuration &&
        c.endTime > pasteTime
      )

      if (overlappingClips.length > 0) {
        // Find the latest end time of overlapping clips
        const latestEnd = Math.max(...overlappingClips.map(c => c.endTime))
        pasteTime = latestEnd
      }

      const newClip: TimelineClip = {
        id: generateId(),
        mediaId: clip.mediaId,
        trackId: targetTrack.id,
        startTime: pasteTime,
        endTime: pasteTime + clipDuration,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
      }

      const updatedTracks = state.tracks.map(t => {
        if (t.id !== targetTrack.id) return t
        return { ...t, clips: [...t.clips, newClip] }
      })

      const newDuration = calculateMaxDuration(updatedTracks)
      set({ tracks: updatedTracks, duration: newDuration })

      return newClip
    }

    return null
  },

  // Replace clip media keeping position and trim
  replaceClipMedia: (clipId: string, newMediaId: string, newDuration?: number) => {
    const state = get()

    set({
      tracks: state.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => {
          if (clip.id !== clipId) return clip

          // Keep position, update media and optionally duration
          if (newDuration !== undefined) {
            const clipDuration = clip.endTime - clip.startTime
            const scale = newDuration / (clip.outPoint - clip.inPoint)
            return {
              ...clip,
              mediaId: newMediaId,
              outPoint: newDuration,
              endTime: clip.startTime + (clipDuration * scale),
            }
          }

          return {
            ...clip,
            mediaId: newMediaId,
          }
        }),
      })),
    })
  },

  // Separate audio from video clip to new audio track
  separateAudio: (clipId: string) => {
    const state = get()

    // Find the clip
    let sourceClip: TimelineClip | undefined
    let sourceTrack: TimelineTrack | undefined

    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        sourceClip = clip
        sourceTrack = track
        break
      }
    }

    if (!sourceClip || !sourceTrack) return null

    // Find or create an audio track
    let audioTrack = state.tracks.find(t => t.type === 'audio')

    if (!audioTrack) {
      // Create a new audio track
      audioTrack = {
        id: generateId(),
        name: 'Audio',
        type: 'audio',
        acceptedTypes: ['audio'],
        clips: [],
        muted: false,
        locked: false,
        color: TRACK_COLORS['audio'],
      }
    }

    // Create new audio clip with same timing
    const newClip: TimelineClip = {
      id: generateId(),
      mediaId: sourceClip.mediaId, // Same media, player will extract audio
      trackId: audioTrack.id,
      startTime: sourceClip.startTime,
      endTime: sourceClip.endTime,
      inPoint: sourceClip.inPoint,
      outPoint: sourceClip.outPoint,
      label: `${sourceClip.label || 'Clip'} (audio)`,
    }

    // Update tracks
    const existingAudioTrack = state.tracks.find(t => t.type === 'audio')
    let updatedTracks: TimelineTrack[]

    if (existingAudioTrack) {
      updatedTracks = state.tracks.map(t => {
        if (t.id === audioTrack!.id) {
          return { ...t, clips: [...t.clips, newClip] }
        }
        return t
      })
    } else {
      updatedTracks = [...state.tracks, { ...audioTrack, clips: [newClip] }]
    }

    set({ tracks: updatedTracks })

    return newClip.id
  },

  // TL-003: Snap
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  setSnapThreshold: (threshold: number) => set({ snapThreshold: threshold }),

  getSnapPoint: (time: number, excludeClipId?: string) => {
    const state = get()
    if (!state.snapEnabled) return null

    const snapPoints: number[] = [
      0, // Start of timeline
      state.currentTime, // Playhead
      ...state.markers.map(m => m.time), // Markers
    ]

    // Add clip edges
    for (const track of state.tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue
        snapPoints.push(clip.startTime, clip.endTime)
      }
    }

    // Find closest snap point
    for (const point of snapPoints) {
      if (Math.abs(time - point) <= state.snapThreshold) {
        return point
      }
    }

    return null
  },

  // Zoom-aware snap threshold (threshold in pixels / pixels per second)
  getZoomAwareSnapThreshold: () => {
    const state = get()
    const pixelsPerSecond = 50 * state.zoom
    const thresholdPixels = 10 // 10 pixels snap threshold
    return thresholdPixels / pixelsPerSecond
  },

  // Check if a time range overlaps with existing clips on a track
  checkOverlap: (trackId: string, startTime: number, endTime: number, excludeClipId?: string) => {
    const state = get()
    const track = state.tracks.find(t => t.id === trackId)
    if (!track) return false

    return track.clips.some(clip =>
      clip.id !== excludeClipId &&
      clip.startTime < endTime &&
      clip.endTime > startTime
    )
  },

  // Get all clips that overlap with a time range
  getOverlappingClips: (trackId: string, startTime: number, endTime: number, excludeClipId?: string) => {
    const state = get()
    const track = state.tracks.find(t => t.id === trackId)
    if (!track) return []

    return track.clips.filter(clip =>
      clip.id !== excludeClipId &&
      clip.startTime < endTime &&
      clip.endTime > startTime
    )
  },

  // TL-004: Multi-clip selection
  selectClips: (clipIds: string[]) => set({ selectedClipIds: clipIds, selectedClipId: clipIds[0] || null }),

  addToSelection: (clipId: string) => {
    const { selectedClipIds } = get()
    if (!selectedClipIds.includes(clipId)) {
      set({ selectedClipIds: [...selectedClipIds, clipId], selectedClipId: clipId })
    }
  },

  toggleSelection: (clipId: string) => {
    const { selectedClipIds } = get()
    if (selectedClipIds.includes(clipId)) {
      const newSelection = selectedClipIds.filter(id => id !== clipId)
      set({ selectedClipIds: newSelection, selectedClipId: newSelection[0] || null })
    } else {
      set({ selectedClipIds: [...selectedClipIds, clipId], selectedClipId: clipId })
    }
  },

  selectAllClips: () => {
    const { tracks } = get()
    const allClipIds = tracks.flatMap(t => t.clips.map(c => c.id))
    set({ selectedClipIds: allClipIds, selectedClipId: allClipIds[0] || null })
  },

  clearSelection: () => set({ selectedClipIds: [], selectedClipId: null }),

  // TL-007: Ripple edit
  toggleRipple: () => set((state) => ({ rippleEnabled: !state.rippleEnabled })),

  // Cascade delete: remove all clips using a specific mediaId
  removeClipsByMediaId: (mediaId: string) => {
    const state = get()

    // Find all clip IDs that use this media and clear from selection
    const clipIdsToRemove = state.tracks.flatMap(t =>
      t.clips.filter(c => c.mediaId === mediaId).map(c => c.id)
    )

    set({
      tracks: state.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(c => c.mediaId !== mediaId),
      })),
      selectedClipId: clipIdsToRemove.includes(state.selectedClipId || '') ? null : state.selectedClipId,
      selectedClipIds: state.selectedClipIds.filter(id => !clipIdsToRemove.includes(id)),
    })
  },

  getClipAtTime: (trackId: string, time: number) => {
    const track = get().tracks.find((t) => t.id === trackId)
    return track?.clips.find((c) => time >= c.startTime && time < c.endTime)
  },

  getTrack: (id: string) => {
    return get().tracks.find((t) => t.id === id)
  },

  // Markers (VID-006)
  addMarker: (label?: string) => {
    const { currentTime, markers } = get()
    const marker: TimelineMarker = {
      id: generateId(),
      time: currentTime,
      label: label || `Marker ${markers.length + 1}`,
    }
    set({ markers: [...markers, marker].sort((a, b) => a.time - b.time) })
    return marker
  },

  removeMarker: (id: string) => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    }))
  },

  updateMarker: (id: string, updates: Partial<TimelineMarker>) => {
    set((state) => ({
      markers: state.markers.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ).sort((a, b) => a.time - b.time),
    }))
  },

  jumpToMarker: (id: string) => {
    const marker = get().markers.find((m) => m.id === id)
    if (marker) {
      get().seek(marker.time)
    }
  },

  getMarkerAtTime: (time: number) => {
    return get().markers.find((m) => Math.abs(m.time - time) < 0.1)
  },
}))
