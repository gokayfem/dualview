/**
 * IMG-003: Pixel Inspector Hook
 * Handles clicking on images/videos to get pixel values
 */
import { useCallback, useRef } from 'react'
import { useProjectStore } from '../stores/projectStore'

export function usePixelInspector() {
  const { pixelInspectorEnabled, setPixelInfo } = useProjectStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Get pixel color from an image or video element
  const getPixelColor = useCallback((
    element: HTMLImageElement | HTMLVideoElement,
    x: number,
    y: number
  ): { r: number; g: number; b: number } | null => {
    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null

      // Get the natural dimensions
      const width = element instanceof HTMLVideoElement
        ? element.videoWidth
        : element.naturalWidth
      const height = element instanceof HTMLVideoElement
        ? element.videoHeight
        : element.naturalHeight

      if (width === 0 || height === 0) return null

      // Resize canvas if needed
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      // Draw element to canvas
      ctx.drawImage(element, 0, 0)

      // Get pixel data
      const imageData = ctx.getImageData(x, y, 1, 1)
      const [r, g, b] = imageData.data

      return { r, g, b }
    } catch (e) {
      // CORS or other error
      console.warn('Could not read pixel data:', e)
      return null
    }
  }, [])

  // Handle click on a media element
  const handlePixelClick = useCallback((
    e: React.MouseEvent,
    element: HTMLImageElement | HTMLVideoElement | null,
    side: 'a' | 'b'
  ) => {
    if (!pixelInspectorEnabled || !element) return

    // Get the click position relative to the element
    const rect = element.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Get the natural dimensions
    const naturalWidth = element instanceof HTMLVideoElement
      ? element.videoWidth
      : element.naturalWidth
    const naturalHeight = element instanceof HTMLVideoElement
      ? element.videoHeight
      : element.naturalHeight

    if (naturalWidth === 0 || naturalHeight === 0) return

    // Calculate the scale and offset for object-contain
    const displayAspect = rect.width / rect.height
    const mediaAspect = naturalWidth / naturalHeight

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number

    if (mediaAspect > displayAspect) {
      // Media is wider - letterbox top/bottom
      displayWidth = rect.width
      displayHeight = rect.width / mediaAspect
      offsetX = 0
      offsetY = (rect.height - displayHeight) / 2
    } else {
      // Media is taller - letterbox left/right
      displayHeight = rect.height
      displayWidth = rect.height * mediaAspect
      offsetX = (rect.width - displayWidth) / 2
      offsetY = 0
    }

    // Check if click is within the actual media area
    if (
      clickX < offsetX ||
      clickX > offsetX + displayWidth ||
      clickY < offsetY ||
      clickY > offsetY + displayHeight
    ) {
      return
    }

    // Convert to natural coordinates
    const x = Math.floor(((clickX - offsetX) / displayWidth) * naturalWidth)
    const y = Math.floor(((clickY - offsetY) / displayHeight) * naturalHeight)

    // Get the pixel color
    const color = getPixelColor(element, x, y)
    if (color) {
      setPixelInfo(side, { x, y, ...color })
    }
  }, [pixelInspectorEnabled, getPixelColor, setPixelInfo])

  // Create props to spread on media containers
  const createInspectorProps = useCallback((
    element: React.RefObject<HTMLImageElement | HTMLVideoElement | null>,
    side: 'a' | 'b'
  ) => ({
    onClick: pixelInspectorEnabled
      ? (e: React.MouseEvent) => handlePixelClick(e, element.current, side)
      : undefined,
    style: pixelInspectorEnabled ? { cursor: 'crosshair' } : undefined,
  }), [pixelInspectorEnabled, handlePixelClick])

  return {
    pixelInspectorEnabled,
    handlePixelClick,
    createInspectorProps,
  }
}
