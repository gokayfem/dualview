/**
 * SCOPE-010: Gamut Warning Overlay
 * Out-of-gamut color detection for different color spaces
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertTriangle, X, ChevronDown } from 'lucide-react'

interface GamutWarningOverlayProps {
  videoARef: React.RefObject<HTMLVideoElement | null>
  videoBRef: React.RefObject<HTMLVideoElement | null>
  imageARef?: React.RefObject<HTMLImageElement | null>
  imageBRef?: React.RefObject<HTMLImageElement | null>
  isVisible: boolean
  onClose: () => void
}

// Color space gamut definitions
// CIE xy chromaticity coordinates for primaries and white point
interface ColorSpaceGamut {
  name: string
  label: string
  primaries: {
    red: { x: number; y: number }
    green: { x: number; y: number }
    blue: { x: number; y: number }
  }
  whitePoint: { x: number; y: number }
}

const COLOR_SPACES: Record<string, ColorSpaceGamut> = {
  srgb: {
    name: 'srgb',
    label: 'sRGB',
    primaries: {
      red: { x: 0.64, y: 0.33 },
      green: { x: 0.30, y: 0.60 },
      blue: { x: 0.15, y: 0.06 }
    },
    whitePoint: { x: 0.3127, y: 0.3290 }
  },
  rec709: {
    name: 'rec709',
    label: 'Rec.709',
    primaries: {
      red: { x: 0.64, y: 0.33 },
      green: { x: 0.30, y: 0.60 },
      blue: { x: 0.15, y: 0.06 }
    },
    whitePoint: { x: 0.3127, y: 0.3290 }
  },
  dcip3: {
    name: 'dcip3',
    label: 'DCI-P3',
    primaries: {
      red: { x: 0.680, y: 0.320 },
      green: { x: 0.265, y: 0.690 },
      blue: { x: 0.150, y: 0.060 }
    },
    whitePoint: { x: 0.3127, y: 0.3290 }
  },
  rec2020: {
    name: 'rec2020',
    label: 'Rec.2020',
    primaries: {
      red: { x: 0.708, y: 0.292 },
      green: { x: 0.170, y: 0.797 },
      blue: { x: 0.131, y: 0.046 }
    },
    whitePoint: { x: 0.3127, y: 0.3290 }
  }
}

interface GamutStats {
  totalPixels: number
  outOfGamutPixels: number
  percentage: number
}

export function GamutWarningOverlay({
  videoARef,
  videoBRef,
  imageARef,
  imageBRef,
  isVisible,
  onClose
}: GamutWarningOverlayProps) {
  const canvasARef = useRef<HTMLCanvasElement>(null)
  const canvasBRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasARef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasBRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  const [targetGamut, setTargetGamut] = useState<string>('srgb')
  const [statsA, setStatsA] = useState<GamutStats | null>(null)
  const [statsB, setStatsB] = useState<GamutStats | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(0.7)

  // Convert sRGB to linear RGB
  const srgbToLinear = useCallback((c: number): number => {
    c = c / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }, [])

  // Convert linear RGB to XYZ
  const rgbToXyz = useCallback((r: number, g: number, b: number): { x: number; y: number; z: number } => {
    // sRGB to XYZ matrix (D65)
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    return { x, y, z }
  }, [])

  // Convert XYZ to xyY chromaticity
  const xyzToChromaticity = useCallback((X: number, Y: number, Z: number): { x: number; y: number } => {
    const sum = X + Y + Z
    if (sum === 0) return { x: 0.3127, y: 0.329 } // Return white point for black
    return { x: X / sum, y: Y / sum }
  }, [])

  // Check if a point is inside a triangle (gamut)
  const pointInTriangle = useCallback((
    px: number, py: number,
    v1x: number, v1y: number,
    v2x: number, v2y: number,
    v3x: number, v3y: number
  ): boolean => {
    // Using barycentric coordinates
    const denominator = ((v2y - v3y) * (v1x - v3x) + (v3x - v2x) * (v1y - v3y))
    const a = ((v2y - v3y) * (px - v3x) + (v3x - v2x) * (py - v3y)) / denominator
    const b = ((v3y - v1y) * (px - v3x) + (v1x - v3x) * (py - v3y)) / denominator
    const c = 1 - a - b

    return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1
  }, [])

  // Check if a color is within the target gamut
  const isInGamut = useCallback((r: number, g: number, b: number, gamut: ColorSpaceGamut): boolean => {
    // First check: values must be in 0-255 range (handled by source)
    // Convert to linear RGB
    const linearR = srgbToLinear(r)
    const linearG = srgbToLinear(g)
    const linearB = srgbToLinear(b)

    // Convert to XYZ
    const xyz = rgbToXyz(linearR, linearG, linearB)

    // Convert to chromaticity
    const chrom = xyzToChromaticity(xyz.x, xyz.y, xyz.z)

    // Check if point is inside the gamut triangle
    return pointInTriangle(
      chrom.x, chrom.y,
      gamut.primaries.red.x, gamut.primaries.red.y,
      gamut.primaries.green.x, gamut.primaries.green.y,
      gamut.primaries.blue.x, gamut.primaries.blue.y
    )
  }, [srgbToLinear, rgbToXyz, xyzToChromaticity, pointInTriangle])

  // Process image and generate overlay
  const processImage = useCallback((
    source: HTMLVideoElement | HTMLImageElement | null,
    sampleCanvas: HTMLCanvasElement | null,
    overlayCanvas: HTMLCanvasElement | null,
    gamut: ColorSpaceGamut
  ): GamutStats | null => {
    if (!source || !sampleCanvas || !overlayCanvas) return null

    const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true })
    const overlayCtx = overlayCanvas.getContext('2d')
    if (!ctx || !overlayCtx) return null

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

    // Use reduced resolution for analysis
    const analysisWidth = Math.min(width, 400)
    const analysisHeight = Math.min(height, 300)

    sampleCanvas.width = analysisWidth
    sampleCanvas.height = analysisHeight
    overlayCanvas.width = analysisWidth
    overlayCanvas.height = analysisHeight

    ctx.drawImage(source, 0, 0, analysisWidth, analysisHeight)
    const imageData = ctx.getImageData(0, 0, analysisWidth, analysisHeight)
    const data = imageData.data

    // Create overlay image data
    const overlayData = overlayCtx.createImageData(analysisWidth, analysisHeight)

    let outOfGamutCount = 0
    const totalPixels = (data.length / 4)

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      if (!isInGamut(r, g, b, gamut)) {
        outOfGamutCount++
        // Mark pixel as red overlay
        overlayData.data[i] = 255     // R
        overlayData.data[i + 1] = 0   // G
        overlayData.data[i + 2] = 0   // B
        overlayData.data[i + 3] = 180 // A (semi-transparent)
      } else {
        overlayData.data[i] = 0
        overlayData.data[i + 1] = 0
        overlayData.data[i + 2] = 0
        overlayData.data[i + 3] = 0
      }
    }

    overlayCtx.putImageData(overlayData, 0, 0)

    return {
      totalPixels,
      outOfGamutPixels: outOfGamutCount,
      percentage: (outOfGamutCount / totalPixels) * 100
    }
  }, [isInGamut])

  // Main update loop
  useEffect(() => {
    if (!isVisible) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      return
    }

    const gamut = COLOR_SPACES[targetGamut]

    const update = () => {
      // Process source A
      const sourceA = videoARef?.current || imageARef?.current || null
      const newStatsA = processImage(sourceA, canvasARef.current, overlayCanvasARef.current, gamut)
      if (newStatsA) {
        setStatsA(newStatsA)
      }

      // Process source B
      const sourceB = videoBRef?.current || imageBRef?.current || null
      const newStatsB = processImage(sourceB, canvasBRef.current, overlayCanvasBRef.current, gamut)
      if (newStatsB) {
        setStatsB(newStatsB)
      }

      animationRef.current = requestAnimationFrame(update)
    }

    update()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isVisible, targetGamut, videoARef, videoBRef, imageARef, imageBRef, processImage])

  if (!isVisible) return null

  const currentGamut = COLOR_SPACES[targetGamut]

  return (
    <>
      {/* Hidden canvases for processing */}
      <canvas ref={canvasARef} className="hidden" />
      <canvas ref={canvasBRef} className="hidden" />
      <canvas ref={overlayCanvasARef} className="hidden" />
      <canvas ref={overlayCanvasBRef} className="hidden" />

      {/* Control panel */}
      <div className="absolute top-16 left-4 bg-surface/95 border border-border rounded-lg shadow-xl z-50 w-[220px]">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-text-primary">Gamut Warning</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Gamut selector */}
        <div className="p-2 border-b border-border">
          <label className="text-xs text-text-muted block mb-1">Target Gamut</label>
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center justify-between px-2 py-1.5 bg-surface-alt border border-border rounded text-sm text-text-primary hover:bg-surface-hover"
            >
              <span>{currentGamut.label}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded shadow-lg z-10">
                {Object.values(COLOR_SPACES).map((space) => (
                  <button
                    key={space.name}
                    onClick={() => {
                      setTargetGamut(space.name)
                      setShowDropdown(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-hover ${
                      targetGamut === space.name ? 'bg-accent/20 text-accent' : 'text-text-primary'
                    }`}
                  >
                    {space.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Opacity slider */}
        <div className="p-2 border-b border-border">
          <label className="text-xs text-text-muted block mb-1">
            Overlay Opacity: {Math.round(overlayOpacity * 100)}%
          </label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Statistics */}
        <div className="p-2 text-xs">
          <div className="space-y-2">
            {/* Source A stats */}
            <div className="flex items-center justify-between">
              <span className="text-orange-400 font-medium">Source A:</span>
              {statsA ? (
                <span className={statsA.percentage > 1 ? 'text-red-400' : 'text-green-400'}>
                  {statsA.percentage.toFixed(2)}% out of gamut
                </span>
              ) : (
                <span className="text-text-muted">No data</span>
              )}
            </div>
            {statsA && (
              <div className="w-full bg-surface-alt rounded h-2 overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${Math.min(statsA.percentage, 100)}%` }}
                />
              </div>
            )}

            {/* Source B stats */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-lime-400 font-medium">Source B:</span>
              {statsB ? (
                <span className={statsB.percentage > 1 ? 'text-red-400' : 'text-green-400'}>
                  {statsB.percentage.toFixed(2)}% out of gamut
                </span>
              ) : (
                <span className="text-text-muted">No data</span>
              )}
            </div>
            {statsB && (
              <div className="w-full bg-surface-alt rounded h-2 overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${Math.min(statsB.percentage, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-3 pt-2 border-t border-border text-[10px] text-text-muted">
            Red overlay shows colors outside {currentGamut.label} gamut.
            Useful for broadcast and print compliance.
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="px-2 pb-2 text-[9px] text-text-muted">
          Press <kbd className="kbd text-[8px]">G</kbd> to toggle
        </div>
      </div>

      {/* Overlay canvases on top of video */}
      {/* These would be positioned over the actual video/comparison view */}
      {/* For now, we show preview in the panel itself */}
      <div className="absolute top-16 left-[240px] flex gap-2 z-40">
        {/* Preview A */}
        {statsA && overlayCanvasARef.current && (
          <div className="bg-black/50 rounded overflow-hidden">
            <div className="text-[10px] text-orange-400 text-center py-0.5 bg-black/70">A</div>
            <canvas
              className="w-[160px] h-[120px]"
              style={{ opacity: overlayOpacity }}
              ref={(el) => {
                if (el && overlayCanvasARef.current) {
                  const ctx = el.getContext('2d')
                  if (ctx) {
                    el.width = 160
                    el.height = 120
                    ctx.drawImage(overlayCanvasARef.current, 0, 0, 160, 120)
                  }
                }
              }}
            />
          </div>
        )}
        {/* Preview B */}
        {statsB && overlayCanvasBRef.current && (
          <div className="bg-black/50 rounded overflow-hidden">
            <div className="text-[10px] text-lime-400 text-center py-0.5 bg-black/70">B</div>
            <canvas
              className="w-[160px] h-[120px]"
              style={{ opacity: overlayOpacity }}
              ref={(el) => {
                if (el && overlayCanvasBRef.current) {
                  const ctx = el.getContext('2d')
                  if (ctx) {
                    el.width = 160
                    el.height = 120
                    ctx.drawImage(overlayCanvasBRef.current, 0, 0, 160, 120)
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    </>
  )
}
