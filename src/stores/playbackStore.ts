/**
 * Playback Store (TL-001: OpenCut Pattern)
 *
 * Separate playback state management with:
 * - requestAnimationFrame for smooth time updates
 * - Delta time calculation for accuracy
 * - Custom events for sync (playback-seek, playback-update)
 * - Stop one frame before end to show final frame
 * - Effective duration from timeline content
 */
import { create } from 'zustand'
import { useTimelineStore } from './timelineStore'

interface PlaybackStore {
  // State
  currentTime: number
  isPlaying: boolean
  playbackSpeed: number
  volume: number
  isMuted: boolean
  previousVolume: number
  isExporting: boolean // Flag to disable sync hooks during export

  // Internal
  _animationFrameId: number | null
  _lastUpdateTime: number | null

  // Actions
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setExporting: (exporting: boolean) => void // Enable/disable export mode

  // Frame-accurate operations
  stepFrame: (direction: 1 | -1) => void
  getCurrentFrame: () => number
  snapTimeToFrame: (time: number) => number

  // Getters
  getEffectiveDuration: () => number
}

// Custom event types
declare global {
  interface WindowEventMap {
    'playback-seek': CustomEvent<{ time: number }>
    'playback-update': CustomEvent<{ time: number; isPlaying: boolean }>
    'playback-speed': CustomEvent<{ speed: number }>
  }
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => {
  // Animation loop function
  const updatePlayback = (now: number) => {
    const state = get()

    if (!state.isPlaying) {
      set({ _animationFrameId: null, _lastUpdateTime: null })
      return
    }

    const lastUpdate = state._lastUpdateTime || now
    const deltaSeconds = (now - lastUpdate) / 1000

    // Get effective duration from timeline
    const effectiveDuration = state.getEffectiveDuration()
    const frameRate = useTimelineStore.getState().frameRate || 30
    const frameOffset = 1 / frameRate

    // Calculate new time with speed
    let newTime = state.currentTime + deltaSeconds * state.playbackSpeed

    // Handle loop region
    const loopRegion = useTimelineStore.getState().loopRegion
    if (loopRegion && loopRegion.inPoint < loopRegion.outPoint) {
      if (newTime >= loopRegion.outPoint) {
        newTime = loopRegion.inPoint
      }
    } else {
      // Stop one frame before end to show final frame (OpenCut pattern)
      if (newTime >= effectiveDuration - frameOffset) {
        newTime = effectiveDuration - frameOffset
        set({ isPlaying: false, currentTime: Math.max(0, newTime), _animationFrameId: null, _lastUpdateTime: null })

        // Sync with timeline store
        useTimelineStore.getState().pause()

        // Dispatch update event
        window.dispatchEvent(new CustomEvent('playback-update', {
          detail: { time: newTime, isPlaying: false }
        }))

        return
      }
    }

    // Clamp time
    newTime = Math.max(0, Math.min(newTime, effectiveDuration))

    set({ currentTime: newTime, _lastUpdateTime: now })

    // Sync currentTime with timeline store for components that use it
    useTimelineStore.setState({ currentTime: newTime })

    // Dispatch update event for video sync
    window.dispatchEvent(new CustomEvent('playback-update', {
      detail: { time: newTime, isPlaying: true }
    }))

    // Schedule next frame
    const frameId = requestAnimationFrame(updatePlayback)
    set({ _animationFrameId: frameId })
  }

  return {
    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1,
    volume: 1,
    isMuted: false,
    previousVolume: 1,
    isExporting: false,
    _animationFrameId: null,
    _lastUpdateTime: null,

    play: () => {
      const state = get()
      if (state.isPlaying) return

      // If at or near the end, seek to beginning before playing
      const effectiveDuration = state.getEffectiveDuration()
      const frameRate = useTimelineStore.getState().frameRate || 30
      const frameOffset = 1 / frameRate

      if (state.currentTime >= effectiveDuration - frameOffset) {
        // Seek to beginning
        set({ currentTime: 0 })
        useTimelineStore.setState({ currentTime: 0 })
        window.dispatchEvent(new CustomEvent('playback-seek', {
          detail: { time: 0 }
        }))
      }

      set({ isPlaying: true, _lastUpdateTime: null })

      // Sync with timeline store
      useTimelineStore.getState().play()

      // Start animation loop
      const frameId = requestAnimationFrame(updatePlayback)
      set({ _animationFrameId: frameId })
    },

    pause: () => {
      const state = get()
      if (!state.isPlaying) return

      // Cancel animation frame
      if (state._animationFrameId) {
        cancelAnimationFrame(state._animationFrameId)
      }

      set({ isPlaying: false, _animationFrameId: null, _lastUpdateTime: null })

      // Sync with timeline store
      useTimelineStore.getState().pause()

      // Dispatch update event
      window.dispatchEvent(new CustomEvent('playback-update', {
        detail: { time: state.currentTime, isPlaying: false }
      }))
    },

    togglePlay: () => {
      const state = get()
      if (state.isPlaying) {
        state.pause()
      } else {
        state.play()
      }
    },

    seek: (time: number) => {
      const state = get()
      const effectiveDuration = state.getEffectiveDuration()

      // Snap to frame boundary
      const snappedTime = state.snapTimeToFrame(Math.max(0, Math.min(time, effectiveDuration)))

      set({ currentTime: snappedTime })

      // Sync with timeline store
      useTimelineStore.setState({ currentTime: snappedTime })

      // Dispatch seek event for video sync
      window.dispatchEvent(new CustomEvent('playback-seek', {
        detail: { time: snappedTime }
      }))
    },

    setSpeed: (speed: number) => {
      const clampedSpeed = Math.max(0.1, Math.min(4, speed))
      set({ playbackSpeed: clampedSpeed })

      // Sync with timeline store
      useTimelineStore.setState({ playbackSpeed: clampedSpeed })

      // Dispatch speed event
      window.dispatchEvent(new CustomEvent('playback-speed', {
        detail: { speed: clampedSpeed }
      }))
    },

    setVolume: (volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume))
      set({ volume: clampedVolume, isMuted: clampedVolume === 0 })
    },

    toggleMute: () => {
      const state = get()
      if (state.isMuted) {
        set({ isMuted: false, volume: state.previousVolume || 1 })
      } else {
        set({ isMuted: true, previousVolume: state.volume, volume: 0 })
      }
    },

    setExporting: (exporting: boolean) => {
      set({ isExporting: exporting })
      // When entering export mode, pause playback
      if (exporting) {
        const state = get()
        if (state.isPlaying) {
          state.pause()
        }
      }
    },

    stepFrame: (direction: 1 | -1) => {
      const state = get()
      const frameRate = useTimelineStore.getState().frameRate || 30
      const frameTime = 1 / frameRate
      const effectiveDuration = state.getEffectiveDuration()

      const newTime = state.snapTimeToFrame(
        Math.max(0, Math.min(state.currentTime + direction * frameTime, effectiveDuration))
      )

      set({ currentTime: newTime })

      // Sync with timeline store
      useTimelineStore.setState({ currentTime: newTime })

      // Dispatch seek event
      window.dispatchEvent(new CustomEvent('playback-seek', {
        detail: { time: newTime }
      }))
    },

    getCurrentFrame: () => {
      const state = get()
      const frameRate = useTimelineStore.getState().frameRate || 30
      return Math.floor(state.currentTime * frameRate)
    },

    snapTimeToFrame: (time: number) => {
      const frameRate = useTimelineStore.getState().frameRate || 30
      const frame = Math.round(time * frameRate)
      return frame / frameRate
    },

    getEffectiveDuration: () => {
      const timelineState = useTimelineStore.getState()

      // Calculate actual content duration from clips
      let maxEndTime = 0
      for (const track of timelineState.tracks) {
        for (const clip of track.clips) {
          if (clip.endTime > maxEndTime) {
            maxEndTime = clip.endTime
          }
        }
      }

      // Use timeline duration as minimum, but actual content duration if longer
      return Math.max(timelineState.duration, maxEndTime, 1)
    },
  }
})

// Subscribe to timeline store changes to keep in sync
useTimelineStore.subscribe((state, prevState) => {
  // Sync currentTime if changed externally (e.g., by seek in timeline)
  if (state.currentTime !== prevState.currentTime) {
    const playbackState = usePlaybackStore.getState()
    if (Math.abs(state.currentTime - playbackState.currentTime) > 0.01) {
      usePlaybackStore.setState({ currentTime: state.currentTime })
    }
  }

  // Sync isPlaying if changed externally
  if (state.isPlaying !== prevState.isPlaying) {
    const playbackState = usePlaybackStore.getState()
    if (state.isPlaying !== playbackState.isPlaying) {
      if (state.isPlaying) {
        playbackState.play()
      } else {
        playbackState.pause()
      }
    }
  }
})
