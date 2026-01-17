/**
 * IMG-002: Synchronized Zoom Hook
 * Provides mouse wheel zoom and synchronized panning across comparison views
 */
import { useCallback, useRef, useState } from 'react'
import { useProjectStore } from '../stores/projectStore'

export function useSyncedZoom() {
  const { zoom, panX, panY, setZoom, setPan, resetZoom } = useProjectStore()
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.25 : 0.25
    const newZoom = Math.max(1, Math.min(10, zoom + delta))

    // Reset pan when zooming back to 1x
    if (newZoom === 1) {
      resetZoom()
    } else {
      setZoom(newZoom)
    }
  }, [zoom, setZoom, resetZoom])

  // Handle pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return
    if (e.button !== 0) return // Only left click

    setIsDragging(true)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panX,
      panY: panY,
    }
  }, [zoom, panX, panY])

  // Handle pan move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return

    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y

    setPan(
      dragStart.current.panX + dx,
      dragStart.current.panY + dy
    )
  }, [isDragging, setPan])

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Get transform style for media elements
  const getTransformStyle = useCallback(() => ({
    transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
    transformOrigin: 'center center',
    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
  }), [zoom, panX, panY, isDragging])

  // Container props to spread on the container element
  const containerProps = {
    onWheel: handleWheel,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
  }

  return {
    zoom,
    panX,
    panY,
    isDragging,
    resetZoom,
    getTransformStyle,
    containerProps,
  }
}
