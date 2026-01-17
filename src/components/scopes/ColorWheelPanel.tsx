/**
 * SCOPE-009: Color Wheel Distribution
 * Visualize colors on a wheel with hue angle and saturation
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { X, Palette, Eye, EyeOff } from 'lucide-react'

interface ColorWheelPanelProps {
  videoARef: React.RefObject<HTMLVideoElement | null>
  videoBRef: React.RefObject<HTMLVideoElement | null>
  imageARef?: React.RefObject<HTMLImageElement | null>
  imageBRef?: React.RefObject<HTMLImageElement | null>
  isVisible: boolean
  onClose: () => void
  onHighlightColor?: (hue: number | null, saturation: number | null) => void
}

interface ColorDistribution {
  // 2D array: [hue 0-359][saturation 0-100] = pixel count
  distribution: Uint32Array[]
  dominantHues: { hue: number; saturation: number; count: number }[]
  totalPixels: number
  maxCount: number
}

type ViewMode = 'a' | 'b' | 'both'

export function ColorWheelPanel({
  videoARef,
  videoBRef,
  imageARef,
  imageBRef,
  isVisible,
  onClose,
  onHighlightColor
}: ColorWheelPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sampleCanvasARef = useRef<HTMLCanvasElement>(null)
  const sampleCanvasBRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  const [distributionA, setDistributionA] = useState<ColorDistribution | null>(null)
  const [distributionB, setDistributionB] = useState<ColorDistribution | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [hoveredColor, setHoveredColor] = useState<{ hue: number; sat: number } | null>(null)
  const [showHighlight, setShowHighlight] = useState(false)

  // RGB to HSL conversion
  const rgbToHsl = useCallback((r: number, g: number, b: number): { h: number; s: number; l: number } => {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2

    if (max === min) {
      return { h: 0, s: 0, l }
    }

    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    let h: number
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6
    } else {
      h = ((r - g) / d + 4) / 6
    }

    return { h: h * 360, s, l }
  }, [])

  // Calculate color distribution from image data
  const calculateDistribution = useCallback((imageData: ImageData): ColorDistribution => {
    // Create 2D distribution array: 360 hues x 101 saturation levels
    const distribution: Uint32Array[] = []
    for (let h = 0; h < 360; h++) {
      distribution.push(new Uint32Array(101))
    }

    const data = imageData.data
    const pixelCount = data.length / 4
    let maxCount = 0

    // Accumulate distribution
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      const { h, s } = rgbToHsl(r, g, b)
      const hueIndex = Math.floor(h) % 360
      const satIndex = Math.round(s * 100)

      distribution[hueIndex][satIndex]++
      maxCount = Math.max(maxCount, distribution[hueIndex][satIndex])
    }

    // Find dominant hues (top 5 peaks)
    const hueCounts: { hue: number; saturation: number; count: number }[] = []
    for (let h = 0; h < 360; h++) {
      for (let s = 10; s < 101; s++) { // Ignore very low saturation
        if (distribution[h][s] > pixelCount * 0.001) { // At least 0.1% of pixels
          hueCounts.push({ hue: h, saturation: s, count: distribution[h][s] })
        }
      }
    }
    hueCounts.sort((a, b) => b.count - a.count)
    const dominantHues = hueCounts.slice(0, 5)

    return { distribution, dominantHues, totalPixels: pixelCount, maxCount }
  }, [rgbToHsl])

  // Get image data from source
  const getImageData = useCallback((
    videoRef: React.RefObject<HTMLVideoElement | null>,
    imageRef?: React.RefObject<HTMLImageElement | null>,
    sampleCanvas?: HTMLCanvasElement | null
  ): ImageData | null => {
    if (!sampleCanvas) return null

    const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    const source = videoRef?.current || imageRef?.current
    if (!source) return null

    let width: number, height: number
    if (source instanceof HTMLVideoElement) {
      if (source.readyState < 2) return null
      width = source.videoWidth
      height = source.videoHeight
    } else {
      width = source.naturalWidth
      height = source.naturalHeight
    }

    if (width === 0 || height === 0) return null

    // Sample at reduced resolution
    const sampleWidth = Math.min(width, 300)
    const sampleHeight = Math.min(height, 200)
    sampleCanvas.width = sampleWidth
    sampleCanvas.height = sampleHeight

    ctx.drawImage(source, 0, 0, sampleWidth, sampleHeight)
    return ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  }, [])

  // HSL to RGB for drawing
  const hslToRgb = useCallback((h: number, s: number, l: number): string => {
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2

    let r = 0, g = 0, b = 0
    if (h < 60) { r = c; g = x; b = 0 }
    else if (h < 120) { r = x; g = c; b = 0 }
    else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c }
    else if (h < 300) { r = x; g = 0; b = c }
    else { r = c; g = 0; b = x }

    const ri = Math.round((r + m) * 255)
    const gi = Math.round((g + m) * 255)
    const bi = Math.round((b + m) * 255)

    return `rgb(${ri}, ${gi}, ${bi})`
  }, [])

  // Main update loop
  useEffect(() => {
    if (!isVisible) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      return
    }

    const updateDistributions = () => {
      // Calculate distribution A
      const imageDataA = getImageData(videoARef, imageARef, sampleCanvasARef.current)
      if (imageDataA) {
        setDistributionA(calculateDistribution(imageDataA))
      }

      // Calculate distribution B
      const imageDataB = getImageData(videoBRef, imageBRef, sampleCanvasBRef.current)
      if (imageDataB) {
        setDistributionB(calculateDistribution(imageDataB))
      }

      animationRef.current = requestAnimationFrame(updateDistributions)
    }

    updateDistributions()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isVisible, videoARef, videoBRef, imageARef, imageBRef, calculateDistribution, getImageData])

  // Render color wheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isVisible) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = canvas.width
    const centerX = size / 2
    const centerY = size / 2
    const radius = (size / 2) - 20

    // Clear
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, size, size)

    // Draw color wheel background (graticule)
    for (let h = 0; h < 360; h += 30) {
      const radians = (h - 90) * Math.PI / 180
      const x1 = centerX + Math.cos(radians) * 20
      const y1 = centerY + Math.sin(radians) * 20
      const x2 = centerX + Math.cos(radians) * radius
      const y2 = centerY + Math.sin(radians) * radius

      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      // Hue label
      ctx.fillStyle = '#666'
      ctx.font = '9px system-ui'
      const labelX = centerX + Math.cos(radians) * (radius + 12)
      const labelY = centerY + Math.sin(radians) * (radius + 12)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${h}`, labelX, labelY)
    }

    // Saturation circles
    for (const sat of [0.25, 0.5, 0.75, 1.0]) {
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * sat, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Get distributions to render based on view mode
    const distributions: { dist: ColorDistribution; color: string; alpha: number }[] = []
    if ((viewMode === 'a' || viewMode === 'both') && distributionA) {
      distributions.push({ dist: distributionA, color: '#ff9632', alpha: viewMode === 'both' ? 0.6 : 0.8 })
    }
    if ((viewMode === 'b' || viewMode === 'both') && distributionB) {
      distributions.push({ dist: distributionB, color: '#96ff32', alpha: viewMode === 'both' ? 0.6 : 0.8 })
    }

    // Render each distribution
    distributions.forEach(({ dist, alpha }) => {
      for (let h = 0; h < 360; h++) {
        for (let s = 1; s <= 100; s++) {
          const count = dist.distribution[h][s]
          if (count === 0) continue

          // Calculate intensity based on pixel count (log scale for better visibility)
          const intensity = Math.log1p(count) / Math.log1p(dist.maxCount)

          // Convert to wheel coordinates
          const radians = (h - 90) * Math.PI / 180
          const satRadius = (s / 100) * radius
          const x = centerX + Math.cos(radians) * satRadius
          const y = centerY + Math.sin(radians) * satRadius

          // Draw dot
          const dotSize = Math.max(1, intensity * 4)
          ctx.fillStyle = hslToRgb(h, s / 100, 0.5)
          ctx.globalAlpha = intensity * alpha
          ctx.beginPath()
          ctx.arc(x, y, dotSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    })

    ctx.globalAlpha = 1.0

    // Draw center point
    ctx.fillStyle = '#666'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2)
    ctx.fill()

    // Draw hovered color indicator
    if (hoveredColor) {
      const radians = (hoveredColor.hue - 90) * Math.PI / 180
      const satRadius = (hoveredColor.sat / 100) * radius
      const x = centerX + Math.cos(radians) * satRadius
      const y = centerY + Math.sin(radians) * satRadius

      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.stroke()
    }

  }, [distributionA, distributionB, isVisible, viewMode, hoveredColor, hslToRgb])

  // Handle mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = (canvas.width / 2) - 20

    // Calculate hue and saturation from position
    const dx = x - centerX
    const dy = y - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance <= radius) {
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90
      if (angle < 0) angle += 360

      const hue = Math.round(angle) % 360
      const sat = Math.round((distance / radius) * 100)

      setHoveredColor({ hue, sat })
    } else {
      setHoveredColor(null)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredColor(null)
  }, [])

  const handleClick = useCallback(() => {
    if (hoveredColor && onHighlightColor) {
      if (showHighlight) {
        onHighlightColor(null, null)
        setShowHighlight(false)
      } else {
        onHighlightColor(hoveredColor.hue, hoveredColor.sat)
        setShowHighlight(true)
      }
    }
  }, [hoveredColor, onHighlightColor, showHighlight])

  // Dominant colors display
  const dominantColors = useMemo(() => {
    const colors: { hue: number; sat: number; count: number; source: 'A' | 'B' }[] = []

    if (distributionA && (viewMode === 'a' || viewMode === 'both')) {
      distributionA.dominantHues.forEach(c => colors.push({ hue: c.hue, sat: c.saturation, count: c.count, source: 'A' }))
    }
    if (distributionB && (viewMode === 'b' || viewMode === 'both')) {
      distributionB.dominantHues.forEach(c => colors.push({ hue: c.hue, sat: c.saturation, count: c.count, source: 'B' }))
    }

    return colors.slice(0, 6)
  }, [distributionA, distributionB, viewMode])

  if (!isVisible) return null

  return (
    <div className="absolute bottom-24 right-[420px] bg-surface/95 border border-border rounded-lg shadow-xl z-50 w-[300px]">
      {/* Hidden sampling canvases */}
      <canvas ref={sampleCanvasARef} className="hidden" />
      <canvas ref={sampleCanvasBRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">Color Wheel</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'a' ? 'b' : viewMode === 'b' ? 'both' : 'a')}
            className="px-2 py-1 rounded text-xs bg-surface-hover text-text-muted hover:text-text-primary"
          >
            {viewMode === 'a' ? 'A' : viewMode === 'b' ? 'B' : 'A+B'}
          </button>
          {/* Highlight toggle */}
          <button
            onClick={() => {
              if (showHighlight && onHighlightColor) {
                onHighlightColor(null, null)
              }
              setShowHighlight(!showHighlight)
            }}
            className={`p-1.5 rounded ${showHighlight ? 'bg-accent text-white' : 'bg-surface-hover text-text-muted'}`}
            title="Highlight selected color in image"
          >
            {showHighlight ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Color wheel canvas */}
      <div className="p-2">
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          className="cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />
      </div>

      {/* Hovered color info */}
      {hoveredColor && (
        <div className="px-3 py-1 border-t border-border text-xs">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: `hsl(${hoveredColor.hue}, ${hoveredColor.sat}%, 50%)` }}
            />
            <span className="text-text-muted">
              H: {hoveredColor.hue} S: {hoveredColor.sat}%
            </span>
            <span className="text-text-muted ml-auto text-[10px]">
              Click to highlight
            </span>
          </div>
        </div>
      )}

      {/* Dominant colors */}
      {dominantColors.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <div className="text-[10px] text-text-muted mb-1">Dominant Colors</div>
          <div className="flex gap-1 flex-wrap">
            {dominantColors.map((color, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded relative group cursor-pointer"
                style={{ backgroundColor: `hsl(${color.hue}, ${color.sat}%, 50%)` }}
                title={`H:${color.hue} S:${color.sat}% (${color.source})`}
              >
                <span className="absolute -top-1 -right-1 text-[8px] font-bold text-white bg-black/50 rounded px-0.5">
                  {color.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-3 pb-2 text-[9px] text-text-muted flex justify-between">
        <span>Center = Gray</span>
        <span>Edge = Saturated</span>
      </div>
    </div>
  )
}
