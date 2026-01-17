/**
 * STITCH-001: Multi-Video Stitching Editor
 * Upload, reorder, and stitch multiple video clips
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useMediaStore } from '../../stores/mediaStore'
import {
  Film, Upload, GripVertical, Play, Pause, Trash2, X, ChevronUp, ChevronDown,
  Download, Settings, Clock, Ratio, Spline, Sparkles, Gauge
} from 'lucide-react'
import { EaseCurveEditor, EASE_PRESETS } from './EaseCurveEditor'
import type { EaseCurve } from './EaseCurveEditor'
import { TransitionEditor, DEFAULT_TRANSITION } from './TransitionEditor'
import type { ClipTransition } from './TransitionEditor'
import { SpeedRampEditor, DEFAULT_SPEED_RAMP } from './SpeedRampEditor'
import type { SpeedRamp } from './SpeedRampEditor'

interface StitchClip {
  id: string
  mediaId: string
  name: string
  duration: number
  url: string
  thumbnail?: string
  order: number
  aspectRatio?: number
  frameRate?: number
  easeCurve?: EaseCurve
  speedRamp?: SpeedRamp
}

interface StitchSettings {
  outputAspectRatio: 'original' | '16:9' | '9:16' | '1:1' | '4:3'
  fitMode: 'fit' | 'fill' | 'stretch'
  outputFrameRate: 24 | 30 | 60
}

interface StitchEditorProps {
  isOpen: boolean
  onClose: () => void
  onExport?: (clips: StitchClip[], settings: StitchSettings) => void
}

export function StitchEditor({ isOpen, onClose, onExport }: StitchEditorProps) {
  const { files } = useMediaStore()
  const [clips, setClips] = useState<StitchClip[]>([])
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [settings, setSettings] = useState<StitchSettings>({
    outputAspectRatio: 'original',
    fitMode: 'fit',
    outputFrameRate: 30
  })
  const [showSettings, setShowSettings] = useState(false)
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null)
  const [editingEaseCurveClipId, setEditingEaseCurveClipId] = useState<string | null>(null)
  // STITCH-003: Transitions between clips
  const [transitions, setTransitions] = useState<Map<string, ClipTransition>>(new Map())
  const [editingTransitionKey, setEditingTransitionKey] = useState<string | null>(null)
  // STITCH-004: Speed ramping
  const [editingSpeedRampClipId, setEditingSpeedRampClipId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter to only video files
  const videoFiles = files.filter(f => f.type === 'video')

  // Total duration
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0)

  // Add clip from library
  const addClipFromLibrary = useCallback((mediaId: string) => {
    const file = files.find(f => f.id === mediaId)
    if (!file || file.type !== 'video') return

    const newClip: StitchClip = {
      id: `stitch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      mediaId: file.id,
      name: file.name,
      duration: file.duration || 0,
      url: file.url,
      thumbnail: file.thumbnail,
      order: clips.length,
      aspectRatio: file.width && file.height ? file.width / file.height : undefined,
      frameRate: 30 // Default, would need to extract from video metadata
    }

    setClips(prev => [...prev, newClip])
  }, [files, clips.length])

  // Remove clip
  const removeClip = useCallback((clipId: string) => {
    setClips(prev => {
      const filtered = prev.filter(c => c.id !== clipId)
      return filtered.map((c, i) => ({ ...c, order: i }))
    })
    if (currentClipIndex >= clips.length - 1) {
      setCurrentClipIndex(Math.max(0, clips.length - 2))
    }
  }, [clips.length, currentClipIndex])

  // Move clip up/down
  const moveClip = useCallback((clipId: string, direction: 'up' | 'down') => {
    setClips(prev => {
      const idx = prev.findIndex(c => c.id === clipId)
      if (idx < 0) return prev
      if (direction === 'up' && idx === 0) return prev
      if (direction === 'down' && idx === prev.length - 1) return prev

      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      const newClips = [...prev]
      const temp = newClips[idx]
      newClips[idx] = newClips[newIdx]
      newClips[newIdx] = temp
      return newClips.map((c, i) => ({ ...c, order: i }))
    })
  }, [])

  // Drag and drop reordering
  const handleDragStart = useCallback((clipId: string) => {
    setDraggedClipId(clipId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, targetClipId: string) => {
    e.preventDefault()
    if (!draggedClipId || draggedClipId === targetClipId) return

    setClips(prev => {
      const fromIdx = prev.findIndex(c => c.id === draggedClipId)
      const toIdx = prev.findIndex(c => c.id === targetClipId)
      if (fromIdx < 0 || toIdx < 0) return prev

      const newClips = [...prev]
      const [moved] = newClips.splice(fromIdx, 1)
      newClips.splice(toIdx, 0, moved)
      return newClips.map((c, i) => ({ ...c, order: i }))
    })
  }, [draggedClipId])

  const handleDragEnd = useCallback(() => {
    setDraggedClipId(null)
  }, [])

  // Playback control
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  // Update current time based on video playback
  useEffect(() => {
    if (!isPlaying || clips.length === 0) return

    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      // Calculate total time across all clips
      let elapsed = 0
      for (let i = 0; i < currentClipIndex; i++) {
        elapsed += clips[i].duration
      }
      elapsed += video.currentTime
      setCurrentTime(elapsed)
    }

    const handleEnded = () => {
      // Move to next clip
      if (currentClipIndex < clips.length - 1) {
        setCurrentClipIndex(prev => prev + 1)
      } else {
        // Loop back to start
        setCurrentClipIndex(0)
        setIsPlaying(false)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [isPlaying, currentClipIndex, clips])

  // Play/pause video when isPlaying changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isPlaying, currentClipIndex])

  // Update video source when clip changes
  useEffect(() => {
    if (clips.length > 0 && currentClipIndex < clips.length) {
      const video = videoRef.current
      if (video) {
        video.src = clips[currentClipIndex].url
        video.load()
        if (isPlaying) {
          video.play().catch(() => {})
        }
      }
    }
  }, [currentClipIndex, clips, isPlaying])

  // Seek to specific time
  const seekToTime = useCallback((time: number) => {
    let remaining = time
    for (let i = 0; i < clips.length; i++) {
      if (remaining <= clips[i].duration) {
        setCurrentClipIndex(i)
        setCurrentTime(time)
        if (videoRef.current) {
          videoRef.current.currentTime = remaining
        }
        return
      }
      remaining -= clips[i].duration
    }
  }, [clips])

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle export
  const handleExport = useCallback(() => {
    if (onExport) {
      onExport(clips, settings)
    }
  }, [clips, settings, onExport])

  // Update ease curve for a clip
  const updateClipEaseCurve = useCallback((clipId: string, curve: EaseCurve) => {
    setClips(prev => prev.map(c =>
      c.id === clipId ? { ...c, easeCurve: curve } : c
    ))
  }, [])

  // Get clip being edited for ease curve
  const editingEaseClip = editingEaseCurveClipId
    ? clips.find(c => c.id === editingEaseCurveClipId)
    : null

  // STITCH-003: Get or create transition between two clips
  const getTransitionKey = (fromIdx: number, toIdx: number) => `${fromIdx}-${toIdx}`

  const getTransition = useCallback((fromIdx: number, toIdx: number): ClipTransition => {
    const key = getTransitionKey(fromIdx, toIdx)
    return transitions.get(key) || DEFAULT_TRANSITION
  }, [transitions])

  const updateTransition = useCallback((fromIdx: number, toIdx: number, transition: ClipTransition) => {
    const key = getTransitionKey(fromIdx, toIdx)
    setTransitions(prev => {
      const newMap = new Map(prev)
      newMap.set(key, transition)
      return newMap
    })
  }, [])

  // Get clips for currently editing transition
  const editingTransitionClips = editingTransitionKey
    ? (() => {
        const [fromIdx, toIdx] = editingTransitionKey.split('-').map(Number)
        return {
          from: clips[fromIdx],
          to: clips[toIdx],
          fromIdx,
          toIdx
        }
      })()
    : null

  // STITCH-004: Update speed ramp for a clip
  const updateClipSpeedRamp = useCallback((clipId: string, speedRamp: SpeedRamp) => {
    setClips(prev => prev.map(c =>
      c.id === clipId ? { ...c, speedRamp } : c
    ))
  }, [])

  // Get clip being edited for speed ramp
  const editingSpeedRampClip = editingSpeedRampClipId
    ? clips.find(c => c.id === editingSpeedRampClipId)
    : null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <Film size={20} className="text-[#ff5722]" />
          <h2 className="text-lg font-semibold text-white">Video Stitcher (STITCH-001)</h2>
          <span className="text-sm text-gray-500">•</span>
          <span className="text-sm text-gray-400">{clips.length} clips • {formatTime(totalDuration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded ${showSettings ? 'bg-[#ff5722] text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleExport}
            disabled={clips.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff5722] text-white rounded hover:bg-[#e64a19] disabled:opacity-50"
          >
            <Download size={16} />
            Export
          </button>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Library Panel */}
        <div className="w-64 border-r border-gray-700 bg-[#1a1a1a] flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="text-sm text-gray-400 mb-2">Video Library</div>
            <p className="text-xs text-gray-500">Click to add clips to sequence</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {videoFiles.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Upload size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No videos in library</p>
              </div>
            ) : (
              <div className="space-y-1">
                {videoFiles.map(file => (
                  <button
                    key={file.id}
                    onClick={() => addClipFromLibrary(file.id)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left bg-gray-800 text-gray-300 hover:bg-gray-700"
                  >
                    {file.thumbnail && (
                      <img src={file.thumbnail} alt="" className="w-12 h-8 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-white">{file.name}</div>
                      <div className="text-xs text-gray-500">{formatTime(file.duration || 0)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 flex flex-col bg-black">
          {/* Video Preview */}
          <div className="flex-1 flex items-center justify-center relative">
            {clips.length === 0 ? (
              <div className="text-center text-gray-500">
                <Film size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg">Add clips from the library to start</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="max-w-full max-h-full"
                  style={{
                    objectFit: settings.fitMode === 'fit' ? 'contain' :
                              settings.fitMode === 'fill' ? 'cover' : 'fill'
                  }}
                  muted
                  playsInline
                />
                <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded text-sm text-white">
                  Clip {currentClipIndex + 1} of {clips.length}: {clips[currentClipIndex]?.name}
                </div>
              </>
            )}
          </div>

          {/* Timeline / Sequence */}
          <div className="border-t border-gray-700 bg-[#1a1a1a]">
            {/* Transport Controls */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-700">
              <button
                onClick={togglePlay}
                disabled={clips.length === 0}
                className="p-2 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div className="text-sm font-mono text-gray-400">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={totalDuration || 1}
                  value={currentTime}
                  onChange={e => seekToTime(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Clip Sequence */}
            <div className="p-4 overflow-x-auto">
              <div className="flex gap-0 min-w-max items-stretch">
                {clips.map((clip, idx) => (
                  <div key={clip.id} className="flex items-stretch">
                    {/* Transition marker before clip (if not first) */}
                    {idx > 0 && (
                      <button
                        onClick={() => setEditingTransitionKey(getTransitionKey(idx - 1, idx))}
                        className="w-8 flex-shrink-0 flex items-center justify-center bg-gray-900 hover:bg-gray-800 border-y border-gray-700 group"
                        title={`Transition: ${getTransition(idx - 1, idx).effectId} (${getTransition(idx - 1, idx).duration}s)`}
                      >
                        <Sparkles size={12} className="text-gray-500 group-hover:text-[#ff5722]" />
                      </button>
                    )}
                    <div
                      draggable
                      onDragStart={() => handleDragStart(clip.id)}
                      onDragOver={(e) => handleDragOver(e, clip.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setCurrentClipIndex(idx)}
                      className={`flex flex-col w-40 rounded overflow-hidden cursor-pointer ${
                        idx === currentClipIndex
                          ? 'ring-2 ring-[#ff5722]'
                          : 'ring-1 ring-gray-700'
                      } ${draggedClipId === clip.id ? 'opacity-50' : ''}`}
                    >
                    {/* Thumbnail */}
                    <div className="relative h-20 bg-gray-800">
                      {clip.thumbnail && (
                        <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                        <GripVertical size={20} className="text-white" />
                      </div>
                      <div className="absolute bottom-1 right-1 bg-black/70 px-1 text-xs text-white rounded">
                        {formatTime(clip.duration)}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2 bg-gray-800">
                      <div className="text-xs text-white truncate">{clip.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveClip(clip.id, 'up') }}
                            disabled={idx === 0}
                            className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveClip(clip.id, 'down') }}
                            disabled={idx === clips.length - 1}
                            className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingEaseCurveClipId(clip.id) }}
                            className={`p-0.5 ${clip.easeCurve && clip.easeCurve.id !== 'linear' ? 'text-[#ff5722]' : 'text-gray-500'} hover:text-[#ff5722]`}
                            title={`Ease Curve: ${clip.easeCurve?.name || 'Linear'}`}
                          >
                            <Spline size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSpeedRampClipId(clip.id) }}
                            className={`p-0.5 ${clip.speedRamp?.enabled ? 'text-[#ff5722]' : 'text-gray-500'} hover:text-[#ff5722]`}
                            title={`Speed Ramp: ${clip.speedRamp?.enabled ? 'Enabled' : 'Disabled'}`}
                          >
                            <Gauge size={14} />
                          </button>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
                          className="p-0.5 text-gray-500 hover:text-red-400"
                          title="Remove clip"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add clip placeholder */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-40 h-[108px] border-2 border-dashed border-gray-700 rounded flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:text-gray-400"
                >
                  <Upload size={20} />
                  <span className="text-xs mt-1">Add Clip</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="w-64 border-l border-gray-700 bg-[#1a1a1a] p-4">
            <div className="text-sm font-medium text-white mb-4">Output Settings</div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <Ratio size={14} />
                  Aspect Ratio
                </label>
                <select
                  value={settings.outputAspectRatio}
                  onChange={e => setSettings(prev => ({ ...prev, outputAspectRatio: e.target.value as StitchSettings['outputAspectRatio'] }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="original">Original (varied)</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
                  <option value="1:1">1:1 Square</option>
                  <option value="4:3">4:3 Standard</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Fit Mode</label>
                <select
                  value={settings.fitMode}
                  onChange={e => setSettings(prev => ({ ...prev, fitMode: e.target.value as StitchSettings['fitMode'] }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="fit">Fit (letterbox)</option>
                  <option value="fill">Fill (crop)</option>
                  <option value="stretch">Stretch</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <Clock size={14} />
                  Frame Rate
                </label>
                <select
                  value={settings.outputFrameRate}
                  onChange={e => setSettings(prev => ({ ...prev, outputFrameRate: parseInt(e.target.value) as StitchSettings['outputFrameRate'] }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                >
                  <option value={24}>24 fps (Film)</option>
                  <option value={30}>30 fps (Standard)</option>
                  <option value={60}>60 fps (Smooth)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-500">
                Output: {clips.length} clips, {formatTime(totalDuration)} total
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={(e) => {
          // Handle direct file upload - would need to add to media store first
          console.log('Files selected:', e.target.files)
        }}
        className="hidden"
      />

      {/* Ease Curve Editor Modal (STITCH-002) */}
      {editingEaseClip && (
        <EaseCurveEditor
          isOpen={!!editingEaseCurveClipId}
          onClose={() => setEditingEaseCurveClipId(null)}
          curve={editingEaseClip.easeCurve || EASE_PRESETS[0]}
          onCurveChange={(curve) => updateClipEaseCurve(editingEaseCurveClipId!, curve)}
          clipId={editingEaseClip.name}
        />
      )}

      {/* Transition Editor Modal (STITCH-003) */}
      {editingTransitionClips && (
        <TransitionEditor
          isOpen={!!editingTransitionKey}
          onClose={() => setEditingTransitionKey(null)}
          transition={getTransition(editingTransitionClips.fromIdx, editingTransitionClips.toIdx)}
          onTransitionChange={(transition) => {
            updateTransition(editingTransitionClips.fromIdx, editingTransitionClips.toIdx, transition)
          }}
          fromThumbnail={editingTransitionClips.from?.thumbnail}
          toThumbnail={editingTransitionClips.to?.thumbnail}
          clipNames={{
            from: editingTransitionClips.from?.name || 'Clip ' + (editingTransitionClips.fromIdx + 1),
            to: editingTransitionClips.to?.name || 'Clip ' + (editingTransitionClips.toIdx + 1)
          }}
        />
      )}

      {/* Speed Ramp Editor Modal (STITCH-004) */}
      {editingSpeedRampClip && (
        <SpeedRampEditor
          isOpen={!!editingSpeedRampClipId}
          onClose={() => setEditingSpeedRampClipId(null)}
          speedRamp={editingSpeedRampClip.speedRamp || DEFAULT_SPEED_RAMP}
          onSpeedRampChange={(speedRamp) => updateClipSpeedRamp(editingSpeedRampClipId!, speedRamp)}
          clipDuration={editingSpeedRampClip.duration}
          clipName={editingSpeedRampClip.name}
          clipThumbnail={editingSpeedRampClip.thumbnail}
        />
      )}
    </div>
  )
}

// Toggle button for stitch editor
export function StitchEditorToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700"
      title="Video Stitcher (STITCH-001)"
    >
      <Film size={14} />
      Stitch
    </button>
  )
}
