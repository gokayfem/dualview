/**
 * Timeline Drag Hook (TL-003: OpenCut Pattern)
 *
 * Manages clip dragging with:
 * - Proper dragState tracking
 * - Click vs drag detection (5px threshold)
 * - Original position for revert on cancel
 * - Pixel-to-time conversion
 * - Document-level mouse listeners
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useTimelineStore } from '../stores/timelineStore'
import { useHistoryStore } from '../stores/historyStore'
import { snapTimeToFrame } from '../lib/utils'

// Minimum mouse movement to distinguish drag from click
const DRAG_THRESHOLD = 5

export interface DragState {
  isDragging: boolean
  clipId: string
  trackId: string
  // Original values for revert
  originalStartTime: number
  originalTrackId: string
  // Current drag position
  currentTime: number
  currentTrackId: string
  // Mouse tracking
  startX: number
  startY: number
  currentX: number
  currentY: number
  // Offsets
  offsetX: number // Where on the clip the user clicked
  // TL-004: Snap state
  isSnapped: boolean
  snapPoint: number | null
}

interface UseTimelineDragOptions {
  pixelsPerSecond: number
  trackHeight?: number
  onDragStart?: (clipId: string) => void
  onDragEnd?: (clipId: string, didMove: boolean) => void
}

export function useTimelineDrag(options: UseTimelineDragOptions) {
  const { pixelsPerSecond, trackHeight = 64, onDragStart, onDragEnd } = options

  const [dragState, setDragState] = useState<DragState | null>(null)
  const isDraggingRef = useRef(false)
  const hasMovedRef = useRef(false)

  const { moveClip, frameRate, tracks, getSnapPoint } = useTimelineStore()
  const { pushState } = useHistoryStore()

  // Convert pixels to time
  const pixelsToTime = useCallback((pixels: number) => {
    return pixels / pixelsPerSecond
  }, [pixelsPerSecond])

  // Convert time to pixels
  const timeToPixels = useCallback((time: number) => {
    return time * pixelsPerSecond
  }, [pixelsPerSecond])

  // Start potential drag (mouse down)
  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    clipId: string,
    trackId: string,
    clipStartTime: number
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetX = e.clientX - rect.left

    setDragState({
      isDragging: false, // Not dragging yet, just potential
      clipId,
      trackId,
      originalStartTime: clipStartTime,
      originalTrackId: trackId,
      currentTime: clipStartTime,
      currentTrackId: trackId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX,
      // TL-004: Initialize snap state
      isSnapped: false,
      snapPoint: null,
    })

    isDraggingRef.current = false
    hasMovedRef.current = false
  }, [])

  // Handle mouse move (document level)
  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // Check if we've moved enough to start dragging
      if (!isDraggingRef.current && distance > DRAG_THRESHOLD) {
        isDraggingRef.current = true
        hasMovedRef.current = true

        // Push history state at drag start (OpenCut pattern)
        pushState()

        onDragStart?.(dragState.clipId)

        setDragState(prev => prev ? { ...prev, isDragging: true } : null)
      }

      if (isDraggingRef.current) {
        // Calculate new time based on mouse position
        const timeDelta = pixelsToTime(deltaX)
        let newTime = dragState.originalStartTime + timeDelta

        // Snap to frame boundary first
        newTime = snapTimeToFrame(Math.max(0, newTime), frameRate)

        // TL-004: Apply element edge snapping
        const snapPoint = getSnapPoint(newTime, dragState.clipId)
        let isSnapped = false
        if (snapPoint !== null) {
          newTime = snapPoint
          isSnapped = true
        }

        // Calculate which track we're over (based on Y position)
        const trackIndex = Math.floor(deltaY / trackHeight)
        const currentTrackIndex = tracks.findIndex(t => t.id === dragState.originalTrackId)
        const newTrackIndex = Math.max(0, Math.min(tracks.length - 1, currentTrackIndex + trackIndex))
        const newTrackId = tracks[newTrackIndex]?.id || dragState.originalTrackId

        setDragState(prev => prev ? {
          ...prev,
          currentTime: newTime,
          currentTrackId: newTrackId,
          currentX: e.clientX,
          currentY: e.clientY,
          isSnapped,
          snapPoint: isSnapped ? snapPoint : null,
        } : null)
      }
    }

    const handleMouseUp = () => {
      if (dragState && isDraggingRef.current) {
        // Apply the move
        if (dragState.currentTime !== dragState.originalStartTime ||
            dragState.currentTrackId !== dragState.originalTrackId) {
          moveClip(dragState.clipId, dragState.currentTrackId, dragState.currentTime)
        }

        onDragEnd?.(dragState.clipId, hasMovedRef.current)
      } else if (dragState) {
        // It was a click, not a drag
        onDragEnd?.(dragState.clipId, false)
      }

      setDragState(null)
      isDraggingRef.current = false
    }

    // Handle escape to cancel drag
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState && isDraggingRef.current) {
        // Revert to original position
        setDragState(null)
        isDraggingRef.current = false
        onDragEnd?.(dragState.clipId, false)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dragState, pixelsToTime, frameRate, tracks, trackHeight, moveClip, pushState, onDragStart, onDragEnd, getSnapPoint])

  // Get current position for a clip (either drag position or actual position)
  const getClipPosition = useCallback((clipId: string, actualStartTime: number) => {
    if (dragState?.isDragging && dragState.clipId === clipId) {
      return dragState.currentTime
    }
    return actualStartTime
  }, [dragState])

  // Get current track for a clip (either drag track or actual track)
  const getClipTrack = useCallback((clipId: string, actualTrackId: string) => {
    if (dragState?.isDragging && dragState.clipId === clipId) {
      return dragState.currentTrackId
    }
    return actualTrackId
  }, [dragState])

  // Check if a clip is being dragged
  const isClipDragging = useCallback((clipId: string) => {
    return dragState?.isDragging && dragState.clipId === clipId
  }, [dragState])

  // TL-004: Check if clip is currently snapped
  const isClipSnapped = useCallback((clipId: string) => {
    return dragState?.isDragging && dragState.clipId === clipId && dragState.isSnapped
  }, [dragState])

  // TL-004: Get snap point for visual indicator
  const getSnapIndicator = useCallback(() => {
    if (dragState?.isDragging && dragState.isSnapped && dragState.snapPoint !== null) {
      return dragState.snapPoint
    }
    return null
  }, [dragState])

  return {
    dragState,
    handleMouseDown,
    getClipPosition,
    getClipTrack,
    isClipDragging,
    isClipSnapped,
    getSnapIndicator,
    isDragging: dragState?.isDragging || false,
    pixelsToTime,
    timeToPixels,
  }
}

/**
 * Timeline Trim Hook (TL-006)
 *
 * Manages clip trimming with frame-accurate positions
 */
export interface TrimState {
  isTrimming: boolean
  clipId: string
  side: 'start' | 'end'
  originalTime: number
  currentTime: number
  startX: number
  // TL-006: Snap state for trim
  isSnapped: boolean
  snapPoint: number | null
}

interface UseTimelineTrimOptions {
  pixelsPerSecond: number
  onTrimStart?: (clipId: string, side: 'start' | 'end') => void
  onTrimEnd?: (clipId: string) => void
}

export function useTimelineTrim(options: UseTimelineTrimOptions) {
  const { pixelsPerSecond, onTrimStart, onTrimEnd } = options

  const [trimState, setTrimState] = useState<TrimState | null>(null)
  const isTrimmingRef = useRef(false)

  const { trimClip, frameRate, getSnapPoint } = useTimelineStore()
  const { pushState } = useHistoryStore()

  const handleTrimStart = useCallback((
    e: React.MouseEvent,
    clipId: string,
    side: 'start' | 'end',
    currentTime: number
  ) => {
    e.preventDefault()
    e.stopPropagation()

    // Push history at trim start
    pushState()

    setTrimState({
      isTrimming: true,
      clipId,
      side,
      originalTime: currentTime,
      currentTime,
      startX: e.clientX,
      // TL-006: Initialize snap state
      isSnapped: false,
      snapPoint: null,
    })

    isTrimmingRef.current = true
    onTrimStart?.(clipId, side)
  }, [pushState, onTrimStart])

  useEffect(() => {
    if (!trimState) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isTrimmingRef.current) return

      const deltaX = e.clientX - trimState.startX
      const timeDelta = deltaX / pixelsPerSecond
      let newTime = trimState.originalTime + timeDelta

      // Snap to frame boundary first
      newTime = snapTimeToFrame(Math.max(0, newTime), frameRate)

      // TL-006: Apply element edge snapping during trim
      const snapPoint = getSnapPoint(newTime, trimState.clipId)
      let isSnapped = false
      if (snapPoint !== null) {
        newTime = snapPoint
        isSnapped = true
      }

      setTrimState(prev => prev ? {
        ...prev,
        currentTime: newTime,
        isSnapped,
        snapPoint: isSnapped ? snapPoint : null,
      } : null)

      // Apply trim in real-time
      trimClip(trimState.clipId, trimState.side, newTime)
    }

    const handleMouseUp = () => {
      if (trimState) {
        onTrimEnd?.(trimState.clipId)
      }
      setTrimState(null)
      isTrimmingRef.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [trimState, pixelsPerSecond, frameRate, trimClip, onTrimEnd, getSnapPoint])

  // TL-006: Get trim snap indicator for visual feedback
  const getTrimSnapIndicator = useCallback(() => {
    if (trimState?.isTrimming && trimState.isSnapped && trimState.snapPoint !== null) {
      return trimState.snapPoint
    }
    return null
  }, [trimState])

  return {
    trimState,
    handleTrimStart,
    isTrimming: trimState?.isTrimming || false,
    getTrimSnapIndicator,
  }
}
