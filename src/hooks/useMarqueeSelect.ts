/**
 * Marquee Selection Hook (TL-004)
 *
 * Provides click-and-drag rectangle selection for timeline clips
 */
import { useState, useCallback, useEffect } from 'react'
import { useTimelineStore } from '../stores/timelineStore'

interface SelectionBox {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface UseMarqueeSelectOptions {
  containerRef: React.RefObject<HTMLElement | null>
  pixelsPerSecond: number
  trackHeight: number
  rulerHeight?: number
}

export function useMarqueeSelect({
  containerRef,
  pixelsPerSecond,
  trackHeight,
  rulerHeight = 24,
}: UseMarqueeSelectOptions) {
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)

  const { tracks, selectClips, addToSelection, clearSelection } = useTimelineStore()

  // Start marquee selection on background click
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start selection on left click on the background
    if (e.button !== 0) return

    // Check if clicking on a clip (don't start selection)
    const target = e.target as HTMLElement
    if (target.closest('[data-clip]')) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const y = e.clientY - rect.top + container.scrollTop

    // Only start if clicking in the tracks area (below ruler)
    if (y < rulerHeight) return

    // Clear selection unless shift is held
    if (!e.shiftKey) {
      clearSelection()
    }

    setIsSelecting(true)
    setSelectionBox({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    })
  }, [containerRef, rulerHeight, clearSelection])

  // Update selection box on mouse move
  useEffect(() => {
    if (!isSelecting) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container || !selectionBox) return

      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop

      setSelectionBox(prev => prev ? {
        ...prev,
        currentX: x,
        currentY: y,
      } : null)
    }

    const handleMouseUp = () => {
      if (!selectionBox) {
        setIsSelecting(false)
        return
      }

      // Calculate selection rectangle
      const left = Math.min(selectionBox.startX, selectionBox.currentX)
      const right = Math.max(selectionBox.startX, selectionBox.currentX)
      const top = Math.min(selectionBox.startY, selectionBox.currentY)
      const bottom = Math.max(selectionBox.startY, selectionBox.currentY)

      // Convert pixel positions to time and track indices
      const startTime = left / pixelsPerSecond
      const endTime = right / pixelsPerSecond
      const startTrackIndex = Math.floor((top - rulerHeight) / trackHeight)
      const endTrackIndex = Math.floor((bottom - rulerHeight) / trackHeight)

      // Find clips that intersect with the selection box
      const selectedClipIds: string[] = []

      tracks.forEach((track, index) => {
        // Check if this track is within the selection
        if (index < startTrackIndex || index > endTrackIndex) return

        track.clips.forEach(clip => {
          // Check if clip intersects with time range
          const clipStart = clip.startTime
          const clipEnd = clip.endTime

          if (clipEnd > startTime && clipStart < endTime) {
            selectedClipIds.push(clip.id)
          }
        })
      })

      if (selectedClipIds.length > 0) {
        selectClips(selectedClipIds)
      }

      setIsSelecting(false)
      setSelectionBox(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSelecting, selectionBox, pixelsPerSecond, trackHeight, rulerHeight, tracks, selectClips, addToSelection, containerRef])

  // Get selection box visual properties
  const getSelectionBoxStyle = useCallback(() => {
    if (!selectionBox) return null

    const left = Math.min(selectionBox.startX, selectionBox.currentX)
    const top = Math.min(selectionBox.startY, selectionBox.currentY)
    const width = Math.abs(selectionBox.currentX - selectionBox.startX)
    const height = Math.abs(selectionBox.currentY - selectionBox.startY)

    return {
      left,
      top,
      width,
      height,
    }
  }, [selectionBox])

  return {
    isSelecting,
    handleMouseDown,
    getSelectionBoxStyle,
  }
}
