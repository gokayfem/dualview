import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type { DragEvent } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useHistoryStore } from '../../stores/historyStore'
import { useTimelineDrag, useTimelineTrim } from '../../hooks/useTimelineDrag'
import { useEdgeAutoScroll } from '../../hooks/useEdgeAutoScroll'
import { useMarqueeSelect } from '../../hooks/useMarqueeSelect'
import { formatTime, cn } from '../../lib/utils'
import { extractFilmstrip, getCachedFilmstrip, type FilmstripData } from '../../lib/filmstripExtractor'
import { Button } from '../ui'
import { ClipContextMenu } from './ClipContextMenu'
import { TimelineClip } from './TimelineClip'
import { MEDIA_DRAG_TYPE, type MediaDragData } from '../media/MediaLibrary'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Settings,
  Video,
  Image,
  Music,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Flag,
  X,
  Scissors,
  Copy,
  Magnet,
  ArrowRightLeft,
  Plus,
  Type,
  Trash2,
} from 'lucide-react'
import type { MediaType } from '../../types'

export function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [openTrackSettings, setOpenTrackSettings] = useState<string | null>(null)
  // Simplified timeline - hide advanced tools by default (Cognitive Load reduction)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)
  // TL-013: Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    clipId: string
    trackId: string
  } | null>(null)

  // Add track menu state
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false)

  // Drag-and-drop state for media from library
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null)
  const [dropIndicatorX, setDropIndicatorX] = useState<number | null>(null)

  // FILMSTRIP-001, FILMSTRIP-002: Filmstrip state
  const [filmstrips, setFilmstrips] = useState<Map<string, FilmstripData>>(new Map())
  const [filmstripLoading, setFilmstripLoading] = useState<Set<string>>(new Set())
  const [showFilmstrip, setShowFilmstrip] = useState(true)


  // Playback store for play/pause/seek
  const {
    currentTime,
    isPlaying,
    playbackSpeed,
    togglePlay,
    seek,
    stepFrame,
    getCurrentFrame,
    setSpeed: setPlaybackSpeed,
  } = usePlaybackStore()

  // Timeline store for tracks, clips, and timeline-specific state
  const {
    tracks,
    duration,
    zoom,
    selectedClipId,
    zoomIn,
    zoomOut,
    toggleTrackMute,
    toggleTrackLock,
    selectClip,
    setTrackAcceptedTypes,
    removeClip,
    addClip,
    splitClip,
    splitAndKeepLeft,
    splitAndKeepRight,
    duplicateClip,
    frameRate,
    // VID-003: Loop region
    loopRegion,
    setLoopIn,
    clearLoop,
    // VID-006: Markers
    markers,
    addMarker,
    removeMarker,
    jumpToMarker,
    // TL-005: Shuttle controls
    shuttleSpeed,
    // TL-003: Snap
    snapEnabled,
    toggleSnap,
    // TL-004: Multi-clip selection
    selectedClipIds,
    addToSelection,
    toggleSelection,
    selectAllClips,
    clearSelection,
    // TL-002: Copy/paste
    copyClip,
    pasteClip,
    // TL-007: Ripple
    rippleEnabled,
    toggleRipple,
    pause,
    // Track management
    addTrack,
    removeTrack,
    // Overlap detection
    getOverlappingClips,
  } = useTimelineStore()

  const { getFile, files } = useMediaStore()
  const { pushState } = useHistoryStore()

  const pixelsPerSecond = 50 * zoom
  const timelineWidth = duration * pixelsPerSecond

  // FILMSTRIP-001: Extract filmstrips for video clips
  useEffect(() => {
    if (!showFilmstrip) return

    let isMounted = true

    // Find all video clips that need filmstrip extraction
    const videoMediaIds = new Set<string>()
    for (const track of tracks) {
      for (const clip of track.clips) {
        const media = getFile(clip.mediaId)
        if (media?.type === 'video') {
          videoMediaIds.add(clip.mediaId)
        }
      }
    }

    // Start extraction for each video that isn't already loaded or loading
    const extractAll = async () => {
      for (const mediaId of videoMediaIds) {
        // Skip if already extracted or loading
        if (filmstrips.has(mediaId) || filmstripLoading.has(mediaId)) continue
        if (!isMounted) break

        const media = getFile(mediaId)
        if (!media || !media.url) continue

        // Check cache first
        const cached = getCachedFilmstrip(mediaId)
        if (cached) {
          if (isMounted) {
            setFilmstrips(prev => new Map(prev).set(mediaId, cached))
          }
          continue
        }

        // Mark as loading
        if (isMounted) {
          setFilmstripLoading(prev => new Set(prev).add(mediaId))
        }

        try {
          const filmstrip = await extractFilmstrip(
            mediaId,
            media.url,
            media.duration || 10,
            { frameInterval: 1, maxFrames: 60 }
          )
          if (isMounted && filmstrip) {
            setFilmstrips(prev => new Map(prev).set(mediaId, filmstrip))
          }
        } catch (error) {
          console.warn('Failed to extract filmstrip:', error)
        } finally {
          if (isMounted) {
            setFilmstripLoading(prev => {
              const next = new Set(prev)
              next.delete(mediaId)
              return next
            })
          }
        }
      }
    }

    extractAll()

    return () => {
      isMounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, files, showFilmstrip]) // Note: filmstrips and filmstripLoading intentionally excluded to avoid infinite loops

  // TL-003: Enhanced drag state management (OpenCut pattern)
  const {
    handleMouseDown: handleDragMouseDown,
    getClipPosition,
    isClipDragging,
    isClipSnapped,
    getSnapIndicator,
    isDragging,
  } = useTimelineDrag({
    pixelsPerSecond,
    trackHeight: 64,
  })

  // TL-006: Enhanced trim state management
  const {
    trimState,
    handleTrimStart,
    isTrimming,
    getTrimSnapIndicator,
  } = useTimelineTrim({
    pixelsPerSecond,
  })

  // TL-005: Edge auto-scroll during drag/trim
  useEdgeAutoScroll(containerRef, {
    contentWidth: timelineWidth,
    isActive: isDragging || isTrimming || isDraggingPlayhead,
    edgeThreshold: 80,
    maxScrollSpeed: 12,
  })

  // TL-004: Marquee selection
  const {
    isSelecting,
    handleMouseDown: handleMarqueeMouseDown,
    getSelectionBoxStyle,
  } = useMarqueeSelect({
    containerRef,
    pixelsPerSecond,
    trackHeight: 64,
    rulerHeight: 24,
  })

  // Loop back to start when reaching end
  useEffect(() => {
    if (currentTime >= duration && isPlaying) {
      seek(0)
      pause()
    }
  }, [currentTime, duration, isPlaying, seek, pause])

  // Handle playhead dragging
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingPlayhead(true)
  }

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + containerRef.current.scrollLeft
      const time = x / pixelsPerSecond
      seek(Math.max(0, Math.min(time, duration)))
    },
    [pixelsPerSecond, duration, seek]
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + containerRef.current.scrollLeft
      const time = x / pixelsPerSecond
      seek(Math.max(0, Math.min(time, duration)))
    }

    const handleMouseUp = () => setIsDraggingPlayhead(false)

    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPlayhead, pixelsPerSecond, duration, seek])

  // Close track settings and add track menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openTrackSettings && !(e.target as Element).closest('[data-track-settings]')) {
        setOpenTrackSettings(null)
      }
      if (showAddTrackMenu && !(e.target as Element).closest('[data-add-track-menu]')) {
        setShowAddTrackMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openTrackSettings, showAddTrackMenu])

  // Handle clip mouse down - delegates to drag hook with track lock check
  const handleClipMouseDown = useCallback((e: React.MouseEvent, clipId: string, trackId: string, startTime: number) => {
    const track = tracks.find(t => t.id === trackId)
    if (track?.locked) return
    handleDragMouseDown(e, clipId, trackId, startTime)
  }, [tracks, handleDragMouseDown])

  // Handle drag over for media drop from library
  const handleTrackDragOver = useCallback((e: DragEvent<HTMLDivElement>, trackId: string) => {
    // Check if this is a media drag from the library
    if (!e.dataTransfer.types.includes(MEDIA_DRAG_TYPE)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'

    // Check if track accepts the drag
    const track = tracks.find(t => t.id === trackId)
    if (track?.locked) {
      e.dataTransfer.dropEffect = 'none'
      return
    }

    setDragOverTrackId(trackId)

    // Calculate drop position in timeline
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + containerRef.current.scrollLeft
      setDropIndicatorX(x)
    }
  }, [tracks])

  const handleTrackDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear if we're leaving the track entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget?.closest('[data-track-drop-zone]')) {
      setDragOverTrackId(null)
      setDropIndicatorX(null)
    }
  }, [])

  const handleTrackDrop = useCallback((e: DragEvent<HTMLDivElement>, trackId: string) => {
    e.preventDefault()

    // Get the drag data
    const dragDataStr = e.dataTransfer.getData(MEDIA_DRAG_TYPE)
    if (!dragDataStr) return

    try {
      const dragData: MediaDragData = JSON.parse(dragDataStr)
      const track = tracks.find(t => t.id === trackId)

      if (!track || track.locked) return

      // Check if track accepts this media type
      if (!track.acceptedTypes.includes(dragData.mediaType)) {
        console.warn(`Track ${track.name} does not accept ${dragData.mediaType}`)
        return
      }

      // Calculate drop time from position
      let dropTime = 0
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left + containerRef.current.scrollLeft
        dropTime = Math.max(0, x / pixelsPerSecond)
      }

      // Push history for undo
      pushState()

      // Add clip at drop position
      addClip(trackId, dragData.mediaId, dropTime, dragData.duration)
    } catch (err) {
      console.error('Failed to parse drag data:', err)
    } finally {
      setDragOverTrackId(null)
      setDropIndicatorX(null)
    }
  }, [tracks, pixelsPerSecond, addClip, pushState])

  // Handle trim mouse down - delegates to trim hook with track lock check
  const handleTrimMouseDown = useCallback((
    e: React.MouseEvent,
    clipId: string,
    side: 'start' | 'end',
    clipTime: number,
    trackId: string
  ) => {
    const track = tracks.find(t => t.id === trackId)
    if (track?.locked) return
    handleTrimStart(e, clipId, side, clipTime)
  }, [tracks, handleTrimStart])

  // Handle keyboard shortcuts for clip operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Delete selected clip(s)
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedClipId || selectedClipIds.length > 0)) {
        const clipsToDelete = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : [])
        if (clipsToDelete.length > 0) {
          pushState()
          clipsToDelete.forEach(clipId => {
            const track = tracks.find(t => t.clips.some(c => c.id === clipId))
            if (track && !track.locked) {
              removeClip(clipId)
            }
          })
          clearSelection()
        }
      }

      // Split clip at playhead (TL-001)
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey && selectedClipId) {
        const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId))
        if (track && !track.locked) {
          pushState()
          splitClip(selectedClipId, currentTime)
        }
      }

      // Keep left of playhead (Q)
      if (e.key === 'q' && !e.ctrlKey && !e.metaKey && !e.shiftKey && selectedClipId) {
        const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId))
        if (track && !track.locked) {
          pushState()
          splitAndKeepLeft(selectedClipId, currentTime)
        }
      }

      // Keep right of playhead (W)
      if (e.key === 'w' && !e.ctrlKey && !e.metaKey && !e.shiftKey && selectedClipId) {
        const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId))
        if (track && !track.locked) {
          pushState()
          splitAndKeepRight(selectedClipId, currentTime)
        }
      }

      // Duplicate clip (TL-002)
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedClipId) {
        e.preventDefault()
        const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId))
        if (track && !track.locked) {
          pushState()
          duplicateClip(selectedClipId)
        }
      }

      // Copy clip (TL-002)
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selectedClipId) {
        e.preventDefault()
        copyClip(selectedClipId)
      }

      // Paste clip (TL-002)
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        // Paste to the first available track at playhead
        const track = tracks.find(t => !t.locked)
        if (track) {
          pushState()
          pasteClip(track.id, currentTime)
        }
      }

      // Select all clips (TL-004)
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        selectAllClips()
      }

      // Toggle snap (TL-003)
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        toggleSnap()
      }

      // Toggle ripple (TL-007)
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        toggleRipple()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedClipId, selectedClipIds, tracks, removeClip, pushState, splitClip, splitAndKeepLeft, splitAndKeepRight, duplicateClip, currentTime, copyClip, pasteClip, selectAllClips, clearSelection, toggleSnap, toggleRipple])

  // TL-015: Generate adaptive time markers based on zoom level
  const timeMarkers = useMemo(() => {
    const markers: { time: number; major: boolean }[] = []

    // Calculate optimal interval based on pixels per second
    // Aim for major markers every ~100px, minor markers every ~25px
    const targetMajorSpacing = 100 // pixels
    const targetMinorSpacing = 25 // pixels

    // Calculate time intervals
    const majorIntervalSec = targetMajorSpacing / pixelsPerSecond
    const minorIntervalSec = targetMinorSpacing / pixelsPerSecond

    // Snap to nice values (1, 2, 5, 10, 15, 30, 60, etc.)
    const niceIntervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
    const majorInterval = niceIntervals.find(i => i >= majorIntervalSec) || 600
    const minorInterval = niceIntervals.find(i => i >= minorIntervalSec && i < majorInterval) || majorInterval / 4

    // Generate markers
    for (let t = 0; t <= duration + majorInterval; t += minorInterval) {
      const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs(t % majorInterval - majorInterval) < 0.001
      markers.push({ time: t, major: isMajor })
    }

    return markers
  }, [duration, pixelsPerSecond])

  // Format time based on zoom level (show frames at high zoom)
  const formatMarkerTime = useCallback((seconds: number) => {
    if (pixelsPerSecond > 200) {
      // High zoom - show frames
      const totalFrames = Math.floor(seconds * frameRate)
      const frames = totalFrames % frameRate
      const secs = Math.floor(totalFrames / frameRate)
      return `${secs}:${frames.toString().padStart(2, '0')}`
    } else if (pixelsPerSecond > 50) {
      // Medium zoom - show seconds.ms
      return seconds.toFixed(1)
    } else {
      // Low zoom - show MM:SS
      return formatTime(seconds)
    }
  }, [pixelsPerSecond, frameRate])

  return (
    <div className="h-40 md:h-64 bg-surface border-t border-border flex flex-col">
      {/* Transport controls - Miller's Law: Grouped into logical chunks */}
      <div className="h-10 px-2 md:px-4 flex items-center justify-between border-b border-border bg-surface-hover">
        {/* Left: Playback controls - Law of Proximity */}
        <div className="flex items-center gap-1">
          {/* Core transport - most used actions grouped together */}
          <div className="flex items-center bg-surface p-0.5 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => seek(0)}
              title="Go to start (Home)"
              className="h-7 w-7"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => stepFrame(-1)}
              disabled={isPlaying}
              title="Previous frame (←)"
              className="h-7 w-7"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {/* Primary action - Von Restorff Effect */}
            <Button
              variant={isPlaying ? 'secondary' : 'ghost'}
              size="icon"
              onClick={togglePlay}
              title="Play/Pause (Space)"
              className={`h-8 w-8 ${isPlaying ? 'bg-accent/20 text-accent' : ''}`}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => stepFrame(1)}
              disabled={isPlaying}
              title="Next frame (→)"
              className="h-7 w-7"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => seek(duration)}
              title="Go to end (End)"
              className="h-7 w-7"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Time display - Goal-Gradient Effect: Show progress */}
          <div className="ml-2 md:ml-3 flex items-center gap-2">
            <div className="text-xs md:text-sm font-mono text-text-primary tabular-nums">
              {formatTime(currentTime)}
            </div>
            {/* Visual progress indicator - hidden on small screens */}
            <div className="hidden sm:block w-16 h-1 bg-surface relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent transition-all duration-75"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
            <div className="hidden sm:block text-sm font-mono text-text-muted tabular-nums">
              {formatTime(duration)}
            </div>
            <span className="hidden md:inline text-[10px] text-text-muted px-1.5 py-0.5 bg-surface font-mono">
              F:{getCurrentFrame()}
            </span>
          </div>
        </div>

        {/* Center: Speed control - Hick's Law: Limited options (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Speed selector with visual feedback */}
          <div className="flex items-center gap-0.5 bg-surface p-0.5">
            {[0.5, 1, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-all duration-150",
                  playbackSpeed === speed && shuttleSpeed === 0
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
                )}
              >
                {speed === 1 ? '1×' : `${speed}×`}
              </button>
            ))}
          </div>
          {/* Shuttle speed indicator - clear visual feedback */}
          {shuttleSpeed !== 0 && (
            <div className={cn(
              "px-2.5 py-1 text-xs font-mono font-medium animate-pulse-subtle",
              shuttleSpeed > 0 ? "bg-green-600/90 text-white" : "bg-orange-600/90 text-white"
            )}>
              {shuttleSpeed > 0 ? '▶▶' : '◀◀'} {Math.abs(shuttleSpeed)}×
            </div>
          )}
          <div className="hidden lg:flex items-center gap-1">
            <kbd className="kbd">J</kbd>
            <kbd className="kbd">K</kbd>
            <kbd className="kbd">L</kbd>
          </div>
        </div>

        {/* Right: Tools and zoom - Simplified by default */}
        <div className="flex items-center gap-1">
          {/* FILMSTRIP-002: Toggle filmstrip view */}
          <Button
            variant={showFilmstrip ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setShowFilmstrip(!showFilmstrip)}
            title={showFilmstrip ? "Hide filmstrip" : "Show filmstrip"}
            className={`hidden md:flex h-7 w-7 ${showFilmstrip ? 'bg-accent/10 text-accent' : ''}`}
          >
            <Video className="w-3.5 h-3.5" />
          </Button>

          {/* Advanced tools toggle - Cognitive Load reduction (hidden on mobile) */}
          <Button
            variant={showAdvancedTools ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowAdvancedTools(!showAdvancedTools)}
            title="Toggle advanced tools"
            className={`hidden md:flex h-7 px-2 text-[10px] gap-1 ${showAdvancedTools ? 'bg-accent/10 text-accent' : ''}`}
          >
            <Settings className="w-3 h-3" />
            <span className="hidden sm:inline">{showAdvancedTools ? 'Less' : 'More'}</span>
          </Button>

          {/* Advanced tools - hidden by default for simplicity */}
          {showAdvancedTools && (
            <>
              {/* Loop controls */}
              <div className="flex items-center gap-0.5 bg-surface p-0.5 ml-1">
                <Button
                  variant={loopRegion ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => loopRegion ? clearLoop() : setLoopIn()}
                  title={loopRegion ? "Clear loop (Esc)" : "Set loop in (I/O)"}
                  className={`h-7 w-7 ${loopRegion ? 'bg-accent/20 text-accent' : ''}`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </Button>
                {loopRegion && (
                  <span className="text-[10px] text-accent font-mono px-1">
                    {formatTime(loopRegion.inPoint)}→{formatTime(loopRegion.outPoint)}
                  </span>
                )}
              </div>

              {/* Clip editing tools */}
              <div className={cn(
                "flex items-center gap-0.5 bg-surface p-0.5 transition-opacity",
                !selectedClipId && "opacity-40"
              )}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (selectedClipId) {
                      const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId))
                      if (track && !track.locked) {
                        pushState()
                        splitClip(selectedClipId, currentTime)
                      }
                    }
                  }}
                  disabled={!selectedClipId}
                  title="Split at playhead (S)"
                  className="h-7 w-7"
                >
                  <Scissors className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (selectedClipId) {
                      const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId))
                      if (track && !track.locked) {
                        pushState()
                        duplicateClip(selectedClipId)
                      }
                    }
                  }}
                  disabled={!selectedClipId}
                  title="Duplicate (⌘D)"
                  className="h-7 w-7"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Toggle tools */}
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => addMarker()}
                  title="Add marker (M)"
                  className="h-7 w-7 relative"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {markers.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-secondary text-[8px] text-black font-bold flex items-center justify-center">
                      {markers.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant={snapEnabled ? "secondary" : "ghost"}
                  size="icon"
                  onClick={toggleSnap}
                  title="Snap to edges (N)"
                  className={`h-7 w-7 ${snapEnabled ? 'bg-accent/20 text-accent' : ''}`}
                >
                  <Magnet className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant={rippleEnabled ? "secondary" : "ghost"}
                  size="icon"
                  onClick={toggleRipple}
                  title="Ripple edit (R)"
                  className={`h-7 w-7 ${rippleEnabled ? 'bg-accent/20 text-accent' : ''}`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          )}

          {/* Zoom controls - always visible */}
          <div className="flex items-center gap-0.5 bg-surface p-0.5 ml-1 md:ml-2">
            <Button variant="ghost" size="icon" onClick={zoomOut} className="h-7 w-7">
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="hidden sm:inline text-[10px] text-text-secondary w-10 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" onClick={zoomIn} className="h-7 w-7">
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track labels - hidden on mobile */}
        <div className="hidden md:block w-40 flex-shrink-0 border-r border-border">
          <div className="h-6 border-b border-border" /> {/* Ruler spacer */}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="h-12 md:h-16 px-2 flex flex-col justify-center border-b border-border relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary truncate">
                  {track.name}
                </span>
                <div className="flex gap-1">
                  <button
                    data-track-settings
                    onClick={() => setOpenTrackSettings(openTrackSettings === track.id ? null : track.id)}
                    className={cn(
                      "p-1 hover:bg-surface",
                      openTrackSettings === track.id && "bg-surface"
                    )}
                    title="Track Settings"
                  >
                    <Settings className="w-3 h-3 text-text-muted" />
                  </button>
                  <button
                    onClick={() => toggleTrackMute(track.id)}
                    className="p-1 hover:bg-surface"
                    title={track.muted ? 'Unmute' : 'Mute'}
                  >
                    {track.muted ? (
                      <VolumeX className="w-3 h-3 text-error" />
                    ) : (
                      <Volume2 className="w-3 h-3 text-text-muted" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleTrackLock(track.id)}
                    className="p-1 hover:bg-surface"
                    title={track.locked ? 'Unlock' : 'Lock'}
                  >
                    {track.locked ? (
                      <Lock className="w-3 h-3 text-warning" />
                    ) : (
                      <Unlock className="w-3 h-3 text-text-muted" />
                    )}
                  </button>
                </div>
              </div>
              {/* Accepted types indicator */}
              <div className="flex gap-1 mt-1">
                {track.acceptedTypes.includes('video') && (
                  <span title="Accepts video"><Video className="w-3 h-3 text-accent" /></span>
                )}
                {track.acceptedTypes.includes('image') && (
                  <span title="Accepts images"><Image className="w-3 h-3 text-secondary" /></span>
                )}
                {track.acceptedTypes.includes('audio') && (
                  <span title="Accepts audio"><Music className="w-3 h-3 text-text-muted" /></span>
                )}
              </div>

              {/* Track settings dropdown */}
              {openTrackSettings === track.id && (
                <div data-track-settings className="absolute left-full top-0 ml-1 z-30 bg-surface border border-border p-2 shadow-lg min-w-[140px]">
                  <div className="text-xs font-medium text-text-secondary mb-2">
                    Accepted Media Types
                  </div>
                  {(['video', 'image', 'audio'] as MediaType[]).map((type) => {
                    const isActive = track.acceptedTypes.includes(type)
                    const Icon = type === 'video' ? Video : type === 'image' ? Image : Music
                    return (
                      <label
                        key={type}
                        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-surface-hover px-1"
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => {
                            const newTypes = isActive
                              ? track.acceptedTypes.filter((t) => t !== type)
                              : [...track.acceptedTypes, type]
                            if (newTypes.length > 0) {
                              setTrackAcceptedTypes(track.id, newTypes)
                            }
                          }}
                          className="w-3 h-3 accent-accent"
                        />
                        <Icon className={cn(
                          "w-3 h-3",
                          type === 'video' && "text-accent",
                          type === 'image' && "text-secondary",
                          type === 'audio' && "text-text-muted"
                        )} />
                        <span className="text-xs text-text-primary capitalize">{type}</span>
                      </label>
                    )
                  })}
                  {/* Delete track option (only for non-essential tracks) */}
                  {!['a', 'b'].includes(track.type) && (
                    <>
                      <div className="h-px bg-border my-2" />
                      <button
                        onClick={() => {
                          pushState()
                          removeTrack(track.id)
                          setOpenTrackSettings(null)
                        }}
                        className="flex items-center gap-2 w-full py-1 px-1 text-error hover:bg-error/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="text-xs">Delete Track</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {/* Add Track button */}
          <div data-add-track-menu className="h-10 px-2 flex items-center justify-center border-b border-border relative">
            <button
              onClick={() => setShowAddTrackMenu(!showAddTrackMenu)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-colors",
                showAddTrackMenu
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
              )}
              title="Add new track"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Track</span>
            </button>

            {/* Add track dropdown menu */}
            {showAddTrackMenu && (
              <div data-add-track-menu className="absolute left-full top-0 ml-1 z-30 bg-surface border border-border shadow-lg min-w-[140px]">
                <button
                  onClick={() => {
                    pushState()
                    addTrack('media')
                    setShowAddTrackMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                >
                  <Video className="w-4 h-4 text-green-400" />
                  <span>Media Track</span>
                </button>
                <button
                  onClick={() => {
                    pushState()
                    addTrack('audio')
                    setShowAddTrackMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                >
                  <Music className="w-4 h-4 text-blue-400" />
                  <span>Audio Track</span>
                </button>
                <button
                  onClick={() => {
                    pushState()
                    addTrack('text')
                    setShowAddTrackMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                >
                  <Type className="w-4 h-4 text-purple-400" />
                  <span>Text Track</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timeline content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
          onClick={handleTimelineClick}
          onMouseDown={handleMarqueeMouseDown}
        >
          <div style={{ width: timelineWidth, minWidth: '100%' }}>
            {/* Time ruler */}
            <div className="h-6 border-b border-border relative bg-background">
              {/* Loop region indicator (VID-003) */}
              {loopRegion && (
                <div
                  className="absolute top-0 h-full bg-accent/20 border-x-2 border-accent"
                  style={{
                    left: loopRegion.inPoint * pixelsPerSecond,
                    width: (loopRegion.outPoint - loopRegion.inPoint) * pixelsPerSecond,
                  }}
                />
              )}
              {/* TL-015: Adaptive time markers */}
              {timeMarkers.map((marker, index) => (
                <div
                  key={index}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: marker.time * pixelsPerSecond }}
                >
                  <div className={cn(
                    "w-px",
                    marker.major ? "h-3 bg-border" : "h-1.5 bg-border/50"
                  )} />
                  {marker.major && (
                    <span className="text-[10px] text-text-muted">
                      {formatMarkerTime(marker.time)}
                    </span>
                  )}
                </div>
              ))}

              {/* Markers (VID-006) */}
              {markers.map((marker) => (
                <div
                  key={marker.id}
                  className="absolute top-0 h-full cursor-pointer group"
                  style={{ left: marker.time * pixelsPerSecond - 6 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    jumpToMarker(marker.id)
                  }}
                  title={`${marker.label} - ${formatTime(marker.time)}`}
                >
                  <Flag className="w-3 h-3 text-secondary fill-secondary" />
                  <button
                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 p-0.5 bg-error rounded-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeMarker(marker.id)
                    }}
                    title="Remove marker"
                  >
                    <X className="w-2 h-2 text-white" />
                  </button>
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((track) => (
              <div
                key={track.id}
                data-track-drop-zone
                onDragOver={(e) => handleTrackDragOver(e, track.id)}
                onDragLeave={handleTrackDragLeave}
                onDrop={(e) => handleTrackDrop(e, track.id)}
                className={cn(
                  'h-12 md:h-16 border-b border-border relative transition-colors',
                  track.locked && 'opacity-50',
                  dragOverTrackId === track.id && 'bg-accent/10 border-accent/50'
                )}
              >
                {/* Drop indicator line */}
                {dragOverTrackId === track.id && dropIndicatorX !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-accent z-20 pointer-events-none"
                    style={{ left: dropIndicatorX }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent rounded-full" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent rounded-full" />
                  </div>
                )}
                {/* Clips - using memoized component for performance */}
                {track.clips.map((clip) => {
                  const media = getFile(clip.mediaId)
                  const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond
                  const visualStartTime = getClipPosition(clip.id, clip.startTime)
                  const clipLeft = visualStartTime * pixelsPerSecond
                  const isBeingDragged = isClipDragging(clip.id)
                  const isSelected = selectedClipId === clip.id || selectedClipIds.includes(clip.id)
                  // Overlap detection
                  const overlappingClips = getOverlappingClips(track.id, clip.startTime, clip.endTime, clip.id)
                  const hasOverlap = overlappingClips.length > 0

                  return (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      trackType={track.type as 'a' | 'b' | 'c' | 'audio'}
                      trackLocked={track.locked ?? false}
                      isSelected={isSelected}
                      isBeingDragged={isBeingDragged ?? false}
                      isSnapped={isClipSnapped(clip.id) ?? false}
                      hasOverlap={hasOverlap}
                      clipLeft={clipLeft}
                      clipWidth={clipWidth}
                      mediaName={media?.name}
                      mediaThumbnail={media?.thumbnail}
                      mediaType={media?.type}
                      waveformPeaks={media?.waveformPeaks}
                      filmstrip={filmstrips.get(clip.mediaId) || null}
                      filmstripLoading={filmstripLoading.has(clip.mediaId)}
                      showFilmstrip={showFilmstrip}
                      trimState={trimState}
                      onMouseDown={handleClipMouseDown}
                      onTrimMouseDown={handleTrimMouseDown}
                      onClick={(e, clipId) => {
                        e.stopPropagation()
                        if (e.shiftKey) {
                          addToSelection(clipId)
                        } else if (e.ctrlKey || e.metaKey) {
                          toggleSelection(clipId)
                        } else {
                          selectClip(clipId)
                        }
                      }}
                      onContextMenu={(e, clipId, trackId) => {
                        e.preventDefault()
                        e.stopPropagation()
                        selectClip(clipId)
                        setContextMenu({ x: e.clientX, y: e.clientY, clipId, trackId })
                      }}
                      onDelete={removeClip}
                    />
                  )
                })}
              </div>
            ))}

            {/* TL-004/TL-006: Snap indicator line for drag and trim */}
            {(() => {
              const dragSnapPoint = getSnapIndicator()
              const trimSnapPoint = getTrimSnapIndicator()
              const snapPoint = dragSnapPoint ?? trimSnapPoint
              if (snapPoint !== null) {
                return (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-secondary z-15 pointer-events-none animate-pulse"
                    style={{ left: snapPoint * pixelsPerSecond }}
                  />
                )
              }
              return null
            })()}

            {/* Playhead */}
            <div
              ref={playheadRef}
              className="absolute top-0 bottom-0 w-0.5 bg-accent z-20 cursor-ew-resize"
              style={{ left: currentTime * pixelsPerSecond }}
              onMouseDown={handlePlayheadMouseDown}
            >
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-b-sm" />
            </div>

            {/* TL-004: Marquee selection box */}
            {isSelecting && getSelectionBoxStyle() && (
              <div
                className="absolute border-2 border-accent bg-accent/10 pointer-events-none z-30"
                style={getSelectionBoxStyle() || undefined}
              />
            )}
          </div>
        </div>
      </div>

      {/* TL-013: Context Menu */}
      {contextMenu && (
        <ClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipId={contextMenu.clipId}
          trackId={contextMenu.trackId}
          onClose={() => setContextMenu(null)}
        />
      )}


    </div>
  )
}
