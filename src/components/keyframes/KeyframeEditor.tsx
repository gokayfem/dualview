/**
 * KeyframeEditor Component (KEYFRAME-001, KEYFRAME-002)
 * 
 * Panel for editing keyframe animations on the selected clip.
 */

import { useState, useMemo } from 'react'
import {
  Diamond,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Copy,
  Clipboard,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useKeyframeStore } from '../../stores/keyframeStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import {
  PROPERTY_CONFIGS,
  EASING_PRESETS,
  type AnimatableProperty,
  type EasingType,
} from '../../lib/keyframes'

interface KeyframeEditorProps {
  clipId: string
  className?: string
}

// Group properties by category
const PROPERTY_GROUPS: Record<string, AnimatableProperty[]> = {
  Transform: ['positionX', 'positionY', 'scale', 'scaleX', 'scaleY', 'rotation'],
  Crop: ['cropTop', 'cropBottom', 'cropLeft', 'cropRight'],
  Effects: ['opacity', 'blur', 'brightness', 'contrast', 'saturation'],
}

export function KeyframeEditor({ clipId, className }: KeyframeEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Effects']))
  const [selectedEasing, setSelectedEasing] = useState<EasingType>('ease-in-out')

  const currentTime = usePlaybackStore(state => state.currentTime)
  const clip = useTimelineStore(state => 
    state.tracks.flatMap(t => t.clips).find(c => c.id === clipId)
  )

  const {
    addKeyframeToClip,
    removeKeyframeById,
    resetPropertyKeyframes,
    copyKeyframesAtTime,
    pasteKeyframesAtTime,
    clipboardKeyframes,
    selectedKeyframeId,
    selectKeyframe,
  } = useKeyframeStore()

  // Use stable selectors to avoid re-renders
  const clipKeyframes = useKeyframeStore(state => state.clipKeyframes.get(clipId))
  const getAnimatedValuesAtTime = useKeyframeStore(state => state.getAnimatedValuesAtTime)
  
  // Calculate animated values - memoize with stable inputs
  const relativeTimeForValues = currentTime - (clip?.startTime || 0)
  const animatedValues = useMemo(
    () => getAnimatedValuesAtTime(clipId, relativeTimeForValues),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clipId, relativeTimeForValues, clipKeyframes] // Include clipKeyframes to recalc when keyframes change
  )

  // Get relative time within clip
  const relativeTime = clip ? currentTime - clip.startTime : 0

  // Check if there's a keyframe at current time for a property
  const hasKeyframeAtTime = (property: AnimatableProperty): boolean => {
    if (!clipKeyframes) return false
    const track = clipKeyframes.tracks.find(t => t.property === property)
    if (!track) return false
    return track.keyframes.some(kf => Math.abs(kf.time - relativeTime) < 0.05)
  }

  // Get keyframe at current time for a property
  const getKeyframeAtTime = (property: AnimatableProperty) => {
    if (!clipKeyframes) return null
    const track = clipKeyframes.tracks.find(t => t.property === property)
    if (!track) return null
    return track.keyframes.find(kf => Math.abs(kf.time - relativeTime) < 0.05)
  }

  // Toggle keyframe at current time
  const toggleKeyframe = (property: AnimatableProperty) => {
    const existing = getKeyframeAtTime(property)
    if (existing) {
      removeKeyframeById(clipId, existing.id)
    } else {
      addKeyframeToClip(clipId, property, relativeTime, animatedValues[property], selectedEasing)
    }
  }

  // Update property value (and add keyframe if at keyframe position)
  const updatePropertyValue = (property: AnimatableProperty, value: number) => {
    addKeyframeToClip(clipId, property, relativeTime, value, selectedEasing)
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  if (!clip) {
    return (
      <div className={cn('p-4 text-center text-zinc-500 text-sm', className)}>
        Select a clip to edit keyframes
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-2">
          <Diamond className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white">Keyframes</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => copyKeyframesAtTime(clipId, relativeTime)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
            title="Copy keyframes at current time"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => pasteKeyframesAtTime(clipId, relativeTime)}
            className={cn(
              'p-1.5 rounded transition-colors',
              clipboardKeyframes
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                : 'text-zinc-600 cursor-not-allowed'
            )}
            disabled={!clipboardKeyframes}
            title="Paste keyframes at current time"
          >
            <Clipboard className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Easing selector */}
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 uppercase">Easing:</span>
        <select
          value={selectedEasing}
          onChange={(e) => setSelectedEasing(e.target.value as EasingType)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
        >
          {Object.entries(EASING_PRESETS).map(([key, preset]) => (
            <option key={key} value={preset.easing}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Property groups */}
      <div className="flex-1 overflow-auto">
        {Object.entries(PROPERTY_GROUPS).map(([group, properties]) => (
          <div key={group} className="border-b border-zinc-800 last:border-b-0">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {expandedGroups.has(group) ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              {group}
            </button>

            {/* Properties */}
            {expandedGroups.has(group) && (
              <div className="px-3 pb-2 space-y-2">
                {properties.map((property) => {
                  const config = PROPERTY_CONFIGS[property]
                  const value = animatedValues[property]
                  const hasKf = hasKeyframeAtTime(property)
                  const hasAnyKf = clipKeyframes?.tracks.some(t => t.property === property && t.keyframes.length > 0)

                  return (
                    <div key={property} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-zinc-500">
                          {config.label}
                        </label>
                        <div className="flex items-center gap-1">
                          {/* Keyframe toggle */}
                          <button
                            onClick={() => toggleKeyframe(property)}
                            className={cn(
                              'p-1 rounded transition-colors',
                              hasKf
                                ? 'text-amber-400 bg-amber-400/20'
                                : hasAnyKf
                                  ? 'text-amber-400/50 hover:text-amber-400'
                                  : 'text-zinc-600 hover:text-zinc-400'
                            )}
                            title={hasKf ? 'Remove keyframe' : 'Add keyframe'}
                          >
                            <Diamond className="w-3 h-3" />
                          </button>
                          {/* Reset */}
                          {hasAnyKf && (
                            <button
                              onClick={() => resetPropertyKeyframes(clipId, property)}
                              className="p-1 text-zinc-600 hover:text-red-400 rounded transition-colors"
                              title="Reset (remove all keyframes)"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={config.min}
                          max={config.max}
                          step={config.step}
                          value={value}
                          onChange={(e) => updatePropertyValue(property, parseFloat(e.target.value))}
                          className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                        />
                        <input
                          type="number"
                          min={config.min}
                          max={config.max}
                          step={config.step}
                          value={value.toFixed(2)}
                          onChange={(e) => updatePropertyValue(property, parseFloat(e.target.value) || config.defaultValue)}
                          className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white text-right focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-[10px] text-zinc-600 w-4">{config.unit}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Timeline preview of keyframes */}
      {clipKeyframes && clipKeyframes.tracks.length > 0 && (
        <div className="border-t border-zinc-700 p-2">
          <div className="text-[10px] text-zinc-500 mb-1">Keyframe Timeline</div>
          <div className="space-y-1">
            {clipKeyframes.tracks.map((track) => (
              <div key={track.property} className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-500 w-16 truncate">
                  {PROPERTY_CONFIGS[track.property].label}
                </span>
                <div className="flex-1 h-4 bg-zinc-800 rounded relative">
                  {/* Keyframe markers */}
                  {track.keyframes.map((kf) => {
                    const clipDuration = clip ? clip.endTime - clip.startTime : 1
                    const position = (kf.time / clipDuration) * 100

                    return (
                      <button
                        key={kf.id}
                        onClick={() => selectKeyframe(kf.id)}
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-sm rotate-45 transition-colors',
                          selectedKeyframeId === kf.id
                            ? 'bg-blue-500'
                            : 'bg-amber-400 hover:bg-amber-300'
                        )}
                        style={{ left: `calc(${position}% - 4px)` }}
                        title={`${PROPERTY_CONFIGS[track.property].label}: ${kf.value.toFixed(2)} @ ${kf.time.toFixed(2)}s`}
                      />
                    )
                  })}
                  {/* Current time indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-500"
                    style={{
                      left: `${(relativeTime / (clip ? clip.endTime - clip.startTime : 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact keyframe indicator for timeline clips
 */
export function KeyframeIndicator({ clipId }: { clipId: string }) {
  const clipKeyframes = useKeyframeStore(state => state.getClipKeyframes(clipId))

  if (!clipKeyframes || clipKeyframes.tracks.length === 0) {
    return null
  }

  const totalKeyframes = clipKeyframes.tracks.reduce(
    (sum, track) => sum + track.keyframes.length,
    0
  )

  return (
    <div className="absolute bottom-1 left-1 flex items-center gap-0.5 text-amber-400">
      <Diamond className="w-2.5 h-2.5" />
      <span className="text-[8px]">{totalKeyframes}</span>
    </div>
  )
}
