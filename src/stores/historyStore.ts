/**
 * FIX-001: Undo/Redo System
 * Tracks history of timeline state for undo/redo operations
 */
import { create } from 'zustand'
import { useTimelineStore } from './timelineStore'
import type { TimelineTrack } from '../types'

interface HistoryState {
  tracks: TimelineTrack[]
  duration: number
}

interface HistoryStore {
  past: HistoryState[]
  future: HistoryState[]
  maxHistory: number

  // Actions
  pushState: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

const MAX_HISTORY = 50

// Deep clone tracks to avoid reference issues
const cloneTracks = (tracks: TimelineTrack[]): TimelineTrack[] => {
  return tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => ({ ...clip })),
  }))
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  maxHistory: MAX_HISTORY,

  pushState: () => {
    const timelineState = useTimelineStore.getState()
    const currentState: HistoryState = {
      tracks: cloneTracks(timelineState.tracks),
      duration: timelineState.duration,
    }

    set((state) => ({
      past: [...state.past.slice(-MAX_HISTORY + 1), currentState],
      future: [], // Clear future when new action is performed
    }))
  },

  undo: () => {
    const { past } = get()
    if (past.length === 0) return

    const timelineState = useTimelineStore.getState()
    const currentState: HistoryState = {
      tracks: cloneTracks(timelineState.tracks),
      duration: timelineState.duration,
    }

    const previousState = past[past.length - 1]
    const newPast = past.slice(0, -1)

    // Apply previous state to timeline
    useTimelineStore.setState({
      tracks: cloneTracks(previousState.tracks),
      duration: previousState.duration,
    })

    set({
      past: newPast,
      future: [currentState, ...get().future],
    })
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return

    const timelineState = useTimelineStore.getState()
    const currentState: HistoryState = {
      tracks: cloneTracks(timelineState.tracks),
      duration: timelineState.duration,
    }

    const nextState = future[0]
    const newFuture = future.slice(1)

    // Apply next state to timeline
    useTimelineStore.setState({
      tracks: cloneTracks(nextState.tracks),
      duration: nextState.duration,
    })

    set({
      past: [...get().past, currentState],
      future: newFuture,
    })
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clear: () => set({ past: [], future: [] }),
}))

// Hook to wrap timeline actions with history tracking
export function useHistoryAction() {
  const pushState = useHistoryStore((state) => state.pushState)

  return {
    withHistory: <T extends (...args: unknown[]) => unknown>(action: T) => {
      return ((...args: Parameters<T>) => {
        pushState()
        return action(...args)
      }) as T
    },
    pushState,
  }
}
