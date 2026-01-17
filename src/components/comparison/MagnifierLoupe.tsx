import { useState, useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'

interface MagnifierLoupeProps {
  sourceARef: React.RefObject<HTMLImageElement | HTMLVideoElement | null>
  sourceBRef: React.RefObject<HTMLImageElement | HTMLVideoElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  isEnabled: boolean
  onToggle: () => void
}

interface LoupePosition {
  x: number
  y: number
  sourceX: number
  sourceY: number
}

const LOUPE_SIZE = 150
const ZOOM_LEVEL = 3

export function MagnifierLoupe({
  sourceARef,
  sourceBRef,
  containerRef,
  isEnabled,
  onToggle,
}: MagnifierLoupeProps) {
  const [position, setPosition] = useState<LoupePosition | null>(null)
  const canvasARef = useRef<HTMLCanvasElement>(null)
  const canvasBRef = useRef<HTMLCanvasElement>(null)

  const updateLoupe = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Calculate source coordinates (normalized 0-1)
    const sourceX = x / rect.width
    const sourceY = y / rect.height

    setPosition({ x, y, sourceX, sourceY })
  }, [containerRef])

  const drawLoupe = useCallback((
    canvas: HTMLCanvasElement | null,
    source: HTMLImageElement | HTMLVideoElement | null,
    sourceX: number,
    sourceY: number
  ) => {
    if (!canvas || !source) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let sourceWidth: number, sourceHeight: number
    if (source instanceof HTMLVideoElement) {
      sourceWidth = source.videoWidth
      sourceHeight = source.videoHeight
    } else {
      sourceWidth = source.naturalWidth
      sourceHeight = source.naturalHeight
    }

    if (sourceWidth === 0 || sourceHeight === 0) return

    // Calculate the region to magnify
    const regionSize = LOUPE_SIZE / ZOOM_LEVEL
    const sx = sourceX * sourceWidth - regionSize / 2
    const sy = sourceY * sourceHeight - regionSize / 2

    // Clear and draw
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE)
    ctx.drawImage(
      source,
      Math.max(0, sx),
      Math.max(0, sy),
      regionSize,
      regionSize,
      0,
      0,
      LOUPE_SIZE,
      LOUPE_SIZE
    )

    // Draw crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LOUPE_SIZE / 2, 0)
    ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE)
    ctx.moveTo(0, LOUPE_SIZE / 2)
    ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2)
    ctx.stroke()
  }, [])

  useEffect(() => {
    if (!isEnabled || !position) return

    drawLoupe(canvasARef.current, sourceARef.current, position.sourceX, position.sourceY)
    drawLoupe(canvasBRef.current, sourceBRef.current, position.sourceX, position.sourceY)
  }, [isEnabled, position, sourceARef, sourceBRef, drawLoupe])

  useEffect(() => {
    if (!isEnabled || !containerRef.current) return

    const container = containerRef.current

    const handleMouseMove = (e: MouseEvent) => updateLoupe(e)
    const handleMouseLeave = () => setPosition(null)

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [isEnabled, containerRef, updateLoupe])

  if (!isEnabled) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-2 left-2 p-2 bg-surface/80 hover:bg-surface border border-border rounded z-10"
        title="Enable Magnifier (G)"
      >
        <Search className="w-4 h-4 text-text-secondary" />
      </button>
    )
  }

  return (
    <>
      {/* Toggle button when enabled */}
      <button
        onClick={onToggle}
        className="absolute top-2 left-2 p-2 bg-accent/80 hover:bg-accent border border-accent rounded z-10"
        title="Disable Magnifier (G)"
      >
        <Search className="w-4 h-4 text-white" />
      </button>

      {/* Loupe displays */}
      {position && (
        <div
          className="fixed pointer-events-none z-50 flex gap-1"
          style={{
            left: position.x + (containerRef.current?.getBoundingClientRect().left || 0) + 20,
            top: position.y + (containerRef.current?.getBoundingClientRect().top || 0) - LOUPE_SIZE / 2,
          }}
        >
          {/* Loupe A */}
          <div className="relative">
            <canvas
              ref={canvasARef}
              width={LOUPE_SIZE}
              height={LOUPE_SIZE}
              className="border-2 border-orange-500 rounded-lg shadow-lg bg-black"
            />
            <div className="absolute -top-5 left-0 text-[10px] font-bold text-orange-500 bg-black/80 px-1 rounded">
              A
            </div>
          </div>

          {/* Loupe B */}
          <div className="relative">
            <canvas
              ref={canvasBRef}
              width={LOUPE_SIZE}
              height={LOUPE_SIZE}
              className="border-2 border-lime-400 rounded-lg shadow-lg bg-black"
            />
            <div className="absolute -top-5 left-0 text-[10px] font-bold text-lime-400 bg-black/80 px-1 rounded">
              B
            </div>
          </div>

          {/* Zoom level indicator */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted bg-black/80 px-2 rounded">
            {ZOOM_LEVEL}x
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Hook to manage magnifier state
 */
export function useMagnifier() {
  const [isEnabled, setIsEnabled] = useState(false)

  const toggle = useCallback(() => setIsEnabled(prev => !prev), [])

  return {
    isEnabled,
    toggle,
    setEnabled: setIsEnabled,
  }
}
