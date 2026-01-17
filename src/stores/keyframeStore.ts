/**
 * Keyframe Store (KEYFRAME-001, KEYFRAME-002)
 * 
 * Manages keyframe data for all clips.
 */

import { create } from 'zustand'
import {
  type ClipKeyframes,
  type AnimatableProperty,
  type EasingType,
  type Keyframe,
  addKeyframe,
  removeKeyframe,
  updateKeyframe,
  resetProperty,
  createClipKeyframes,
  getAnimatedValues,
  getKeyframesAtTime,
} from '../lib/keyframes'

interface KeyframeStore {
  // All clip keyframes indexed by clip ID
  clipKeyframes: Map<string, ClipKeyframes>

  // Currently selected keyframe
  selectedKeyframeId: string | null

  // Clipboard for copy/paste
  clipboardKeyframes: Keyframe[] | null

  // Actions
  getClipKeyframes: (clipId: string) => ClipKeyframes | undefined
  getAnimatedValuesAtTime: (clipId: string, time: number) => Record<AnimatableProperty, number>

  addKeyframeToClip: (
    clipId: string,
    property: AnimatableProperty,
    time: number,
    value: number,
    easing?: EasingType
  ) => void

  removeKeyframeById: (clipId: string, keyframeId: string) => void

  updateKeyframeById: (
    clipId: string,
    keyframeId: string,
    updates: Partial<Omit<Keyframe, 'id'>>
  ) => void

  copyKeyframesAtTime: (clipId: string, time: number) => void
  pasteKeyframesAtTime: (clipId: string, time: number) => void

  selectKeyframe: (keyframeId: string | null) => void

  resetPropertyKeyframes: (clipId: string, property: AnimatableProperty) => void
  clearClipKeyframes: (clipId: string) => void

  // Get keyframes at time for display
  getKeyframesAt: (clipId: string, time: number) => Keyframe[]

  // Bulk operations
  deleteKeyframesInRange: (clipId: string, startTime: number, endTime: number) => void
  shiftKeyframes: (clipId: string, offset: number) => void
}

export const useKeyframeStore = create<KeyframeStore>((set, get) => ({
  clipKeyframes: new Map(),
  selectedKeyframeId: null,
  clipboardKeyframes: null,

  getClipKeyframes: (clipId: string) => {
    return get().clipKeyframes.get(clipId)
  },

  getAnimatedValuesAtTime: (clipId: string, time: number) => {
    const clipKf = get().clipKeyframes.get(clipId)
    return getAnimatedValues(clipKf, time)
  },

  addKeyframeToClip: (clipId, property, time, value, easing = 'ease-in-out') => {
    const state = get()
    let clipKf = state.clipKeyframes.get(clipId)

    if (!clipKf) {
      clipKf = createClipKeyframes(clipId)
    }

    const updated = addKeyframe(clipKf, property, time, value, easing)

    set({
      clipKeyframes: new Map(state.clipKeyframes).set(clipId, updated),
    })
  },

  removeKeyframeById: (clipId, keyframeId) => {
    const state = get()
    const clipKf = state.clipKeyframes.get(clipId)
    if (!clipKf) return

    const updated = removeKeyframe(clipKf, keyframeId)

    const newMap = new Map(state.clipKeyframes)
    if (updated.tracks.length === 0) {
      newMap.delete(clipId)
    } else {
      newMap.set(clipId, updated)
    }

    set({
      clipKeyframes: newMap,
      selectedKeyframeId: state.selectedKeyframeId === keyframeId ? null : state.selectedKeyframeId,
    })
  },

  updateKeyframeById: (clipId, keyframeId, updates) => {
    const state = get()
    const clipKf = state.clipKeyframes.get(clipId)
    if (!clipKf) return

    const updated = updateKeyframe(clipKf, keyframeId, updates)

    set({
      clipKeyframes: new Map(state.clipKeyframes).set(clipId, updated),
    })
  },

  copyKeyframesAtTime: (clipId, time) => {
    const state = get()
    const clipKf = state.clipKeyframes.get(clipId)
    if (!clipKf) return

    const keyframes = getKeyframesAtTime(clipKf, time)
    set({ clipboardKeyframes: keyframes.length > 0 ? keyframes : null })
  },

  pasteKeyframesAtTime: (clipId, time) => {
    const state = get()
    if (!state.clipboardKeyframes || state.clipboardKeyframes.length === 0) return

    let clipKf = state.clipKeyframes.get(clipId) || createClipKeyframes(clipId)

    for (const kf of state.clipboardKeyframes) {
      // Find which property this keyframe belongs to
      const sourceClipKf = Array.from(state.clipKeyframes.values()).find(ckf =>
        ckf.tracks.some(t => t.keyframes.some(k => k.id === kf.id))
      )

      if (sourceClipKf) {
        const track = sourceClipKf.tracks.find(t => t.keyframes.some(k => k.id === kf.id))
        if (track) {
          clipKf = addKeyframe(clipKf, track.property, time, kf.value, kf.easing)
        }
      }
    }

    set({
      clipKeyframes: new Map(state.clipKeyframes).set(clipId, clipKf),
    })
  },

  selectKeyframe: (keyframeId) => {
    set({ selectedKeyframeId: keyframeId })
  },

  resetPropertyKeyframes: (clipId, property) => {
    const state = get()
    const clipKf = state.clipKeyframes.get(clipId)
    if (!clipKf) return

    const updated = resetProperty(clipKf, property)

    const newMap = new Map(state.clipKeyframes)
    if (updated.tracks.length === 0) {
      newMap.delete(clipId)
    } else {
      newMap.set(clipId, updated)
    }

    set({ clipKeyframes: newMap })
  },

  clearClipKeyframes: (clipId) => {
    const newMap = new Map(get().clipKeyframes)
    newMap.delete(clipId)
    set({ clipKeyframes: newMap })
  },

  getKeyframesAt: (clipId, time) => {
    const clipKf = get().clipKeyframes.get(clipId)
    if (!clipKf) return []
    return getKeyframesAtTime(clipKf, time)
  },

  deleteKeyframesInRange: (clipId, startTime, endTime) => {
    const state = get()
    const clipKf = state.clipKeyframes.get(clipId)
    if (!clipKf) return

    const updated: ClipKeyframes = {
      ...clipKf,
      tracks: clipKf.tracks.map(track => ({
        ...track,
        keyframes: track.keyframes.filter(
          kf => kf.time < startTime || kf.time > endTime
        ),
      })).filter(track => track.keyframes.length > 0),
    }

    const newMap = new Map(state.clipKeyframes)
    if (updated.tracks.length === 0) {
      newMap.delete(clipId)
    } else {
      newMap.set(clipId, updated)
    }

    set({ clipKeyframes: newMap })
  },

  shiftKeyframes: (clipId, offset) => {
    const state = get()
    const clipKf = state.clipKeyframes.get(clipId)
    if (!clipKf) return

    const updated: ClipKeyframes = {
      ...clipKf,
      tracks: clipKf.tracks.map(track => ({
        ...track,
        keyframes: track.keyframes.map(kf => ({
          ...kf,
          time: Math.max(0, kf.time + offset),
        })),
      })),
    }

    set({
      clipKeyframes: new Map(state.clipKeyframes).set(clipId, updated),
    })
  },
}))
