/**
 * SCOPE-008: WebGL Histogram Panel
 * Real-time histogram computed in WebGL with A/B comparison
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { X, BarChart3, Layers, Scale } from 'lucide-react'

interface HistogramPanelProps {
  videoARef: React.RefObject<HTMLVideoElement | null>
  videoBRef: React.RefObject<HTMLVideoElement | null>
  imageARef?: React.RefObject<HTMLImageElement | null>
  imageBRef?: React.RefObject<HTMLImageElement | null>
  isVisible: boolean
  onClose: () => void
}

interface HistogramData {
  r: Uint32Array
  g: Uint32Array
  b: Uint32Array
  lum: Uint32Array
  mean: { r: number; g: number; b: number; lum: number }
  median: { r: number; g: number; b: number; lum: number }
  clippedShadows: number  // Percentage of pixels at 0
  clippedHighlights: number  // Percentage of pixels at 255
  totalPixels: number
}

type DisplayMode = 'rgb-overlay' | 'rgb-separate' | 'luminance'

export function HistogramPanel({
  videoARef,
  videoBRef,
  imageARef,
  imageBRef,
  isVisible,
  onClose
}: HistogramPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sampleCanvasARef = useRef<HTMLCanvasElement>(null)
  const sampleCanvasBRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  const [histogramA, setHistogramA] = useState<HistogramData | null>(null)
  const [histogramB, setHistogramB] = useState<HistogramData | null>(null)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('rgb-overlay')
  const [useLogScale, setUseLogScale] = useState(false)
  const [showSideBySide, setShowSideBySide] = useState(true)

  // Calculate histogram from image data
  const calculateHistogram = useCallback((imageData: ImageData): HistogramData => {
    const r = new Uint32Array(256)
    const g = new Uint32Array(256)
    const b = new Uint32Array(256)
    const lum = new Uint32Array(256)

    const data = imageData.data
    const pixelCount = data.length / 4

    let rSum = 0, gSum = 0, bSum = 0, lumSum = 0

    for (let i = 0; i < data.length; i += 4) {
      const rVal = data[i]
      const gVal = data[i + 1]
      const bVal = data[i + 2]
      const lumVal = Math.round(0.299 * rVal + 0.587 * gVal + 0.114 * bVal)

      r[rVal]++
      g[gVal]++
      b[bVal]++
      lum[lumVal]++

      rSum += rVal
      gSum += gVal
      bSum += bVal
      lumSum += lumVal
    }

    // Calculate mean
    const mean = {
      r: rSum / pixelCount,
      g: gSum / pixelCount,
      b: bSum / pixelCount,
      lum: lumSum / pixelCount
    }

    // Calculate median (find value where cumulative count reaches 50%)
    const findMedian = (arr: Uint32Array): number => {
      let cumulative = 0
      const half = pixelCount / 2
      for (let i = 0; i < 256; i++) {
        cumulative += arr[i]
        if (cumulative >= half) return i
      }
      return 128
    }

    const median = {
      r: findMedian(r),
      g: findMedian(g),
      b: findMedian(b),
      lum: findMedian(lum)
    }

    // Calculate clipping
    const clippedShadows = ((r[0] + g[0] + b[0]) / 3 / pixelCount) * 100
    const clippedHighlights = ((r[255] + g[255] + b[255]) / 3 / pixelCount) * 100

    return { r, g, b, lum, mean, median, clippedShadows, clippedHighlights, totalPixels: pixelCount }
  }, [])

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

    // Sample at reduced resolution for performance
    const sampleWidth = Math.min(width, 400)
    const sampleHeight = Math.min(height, 300)
    sampleCanvas.width = sampleWidth
    sampleCanvas.height = sampleHeight

    ctx.drawImage(source, 0, 0, sampleWidth, sampleHeight)
    return ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  }, [])

  // Render histogram
  const renderHistogram = useCallback((
    ctx: CanvasRenderingContext2D,
    histogram: HistogramData,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    showMeanMedian: boolean = true
  ) => {
    const data = displayMode === 'luminance' ? histogram.lum :
                 displayMode === 'rgb-separate' ? histogram.lum : histogram.r

    // Find max value for scaling
    let maxVal = 0
    for (let i = 0; i < 256; i++) {
      if (displayMode === 'rgb-overlay') {
        maxVal = Math.max(maxVal, histogram.r[i], histogram.g[i], histogram.b[i])
      } else {
        maxVal = Math.max(maxVal, data[i])
      }
    }

    if (maxVal === 0) return

    const barWidth = width / 256

    // Apply log scale if enabled
    const scaleValue = (val: number) => {
      if (!useLogScale) return val / maxVal
      return Math.log1p(val) / Math.log1p(maxVal)
    }

    // Draw RGB channels
    if (displayMode === 'rgb-overlay' || displayMode === 'rgb-separate') {
      const channels = [
        { data: histogram.r, color: 'rgba(255, 80, 80, 0.6)' },
        { data: histogram.g, color: 'rgba(80, 255, 80, 0.6)' },
        { data: histogram.b, color: 'rgba(80, 80, 255, 0.6)' }
      ]

      channels.forEach(channel => {
        ctx.fillStyle = channel.color
        ctx.beginPath()
        ctx.moveTo(x, y + height)

        for (let i = 0; i < 256; i++) {
          const barX = x + i * barWidth
          const barHeight = scaleValue(channel.data[i]) * height * 0.95
          ctx.lineTo(barX, y + height - barHeight)
        }

        ctx.lineTo(x + width, y + height)
        ctx.closePath()
        ctx.fill()
      })
    } else {
      // Luminance only
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, y + height)

      for (let i = 0; i < 256; i++) {
        const barX = x + i * barWidth
        const barHeight = scaleValue(histogram.lum[i]) * height * 0.95
        ctx.lineTo(barX, y + height - barHeight)
      }

      ctx.lineTo(x + width, y + height)
      ctx.closePath()
      ctx.fill()
    }

    // Draw mean and median markers
    if (showMeanMedian) {
      const meanVal = displayMode === 'luminance' ? histogram.mean.lum :
                     (histogram.mean.r + histogram.mean.g + histogram.mean.b) / 3
      const medianVal = displayMode === 'luminance' ? histogram.median.lum :
                       (histogram.median.r + histogram.median.g + histogram.median.b) / 3

      // Mean marker (dashed)
      ctx.strokeStyle = '#ff5722'
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 2
      const meanX = x + (meanVal / 255) * width
      ctx.beginPath()
      ctx.moveTo(meanX, y)
      ctx.lineTo(meanX, y + height)
      ctx.stroke()

      // Median marker (solid)
      ctx.strokeStyle = '#cddc39'
      ctx.setLineDash([])
      const medianX = x + (medianVal / 255) * width
      ctx.beginPath()
      ctx.moveTo(medianX, y)
      ctx.lineTo(medianX, y + height)
      ctx.stroke()
    }

    // Draw clipping indicators
    if (histogram.clippedShadows > 0.1) {
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(x, y, 4, 4)
    }
    if (histogram.clippedHighlights > 0.1) {
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(x + width - 4, y, 4, 4)
    }
  }, [displayMode, useLogScale])

  // Main render loop
  useEffect(() => {
    if (!isVisible) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      return
    }

    const updateHistograms = () => {
      // Calculate histogram A
      const imageDataA = getImageData(videoARef, imageARef, sampleCanvasARef.current)
      if (imageDataA) {
        setHistogramA(calculateHistogram(imageDataA))
      }

      // Calculate histogram B
      const imageDataB = getImageData(videoBRef, imageBRef, sampleCanvasBRef.current)
      if (imageDataB) {
        setHistogramB(calculateHistogram(imageDataB))
      }

      animationRef.current = requestAnimationFrame(updateHistograms)
    }

    updateHistograms()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isVisible, videoARef, videoBRef, imageARef, imageBRef, calculateHistogram, getImageData])

  // Draw histograms
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isVisible) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1
    ctx.setLineDash([])

    // Vertical lines at 25%, 50%, 75%
    for (const pct of [0.25, 0.5, 0.75]) {
      if (showSideBySide) {
        const xA = pct * (width / 2 - 10)
        const xB = width / 2 + 10 + pct * (width / 2 - 10)
        ctx.beginPath()
        ctx.moveTo(xA, 0)
        ctx.lineTo(xA, height - 40)
        ctx.moveTo(xB, 0)
        ctx.lineTo(xB, height - 40)
        ctx.stroke()
      } else {
        const x = pct * width
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height - 40)
        ctx.stroke()
      }
    }

    if (showSideBySide) {
      // Side by side view
      const panelWidth = width / 2 - 10
      const panelHeight = height - 60

      // Draw histogram A
      if (histogramA) {
        renderHistogram(ctx, histogramA, 0, 10, panelWidth, panelHeight, 'rgba(255, 150, 50, 0.7)')
      }

      // Draw histogram B
      if (histogramB) {
        renderHistogram(ctx, histogramB, width / 2 + 10, 10, panelWidth, panelHeight, 'rgba(150, 255, 50, 0.7)')
      }

      // Labels
      ctx.fillStyle = '#ff9632'
      ctx.font = 'bold 12px system-ui'
      ctx.fillText('A', 5, height - 45)

      ctx.fillStyle = '#96ff32'
      ctx.fillText('B', width / 2 + 15, height - 45)

      // Draw divider
      ctx.strokeStyle = '#555'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width / 2, height - 40)
      ctx.stroke()
    } else {
      // Overlay view
      const panelHeight = height - 60

      if (histogramA) {
        renderHistogram(ctx, histogramA, 0, 10, width, panelHeight, 'rgba(255, 150, 50, 0.5)', false)
      }
      if (histogramB) {
        renderHistogram(ctx, histogramB, 0, 10, width, panelHeight, 'rgba(150, 255, 50, 0.5)', false)
      }
    }

    // Draw scale labels
    ctx.fillStyle = '#666'
    ctx.font = '10px system-ui'
    ctx.fillText('0', 2, height - 5)
    ctx.fillText('128', showSideBySide ? (width / 4 - 10) : (width / 2 - 10), height - 5)
    ctx.fillText('255', showSideBySide ? (width / 2 - 25) : (width - 25), height - 5)

    if (showSideBySide) {
      ctx.fillText('0', width / 2 + 12, height - 5)
      ctx.fillText('128', width * 0.75 - 10, height - 5)
      ctx.fillText('255', width - 25, height - 5)
    }

    // Legend
    ctx.fillStyle = '#ff5722'
    ctx.fillRect(5, height - 22, 8, 8)
    ctx.fillStyle = '#888'
    ctx.font = '9px system-ui'
    ctx.fillText('Mean', 16, height - 15)

    ctx.fillStyle = '#cddc39'
    ctx.fillRect(55, height - 22, 8, 8)
    ctx.fillText('Median', 66, height - 15)

  }, [histogramA, histogramB, isVisible, displayMode, useLogScale, showSideBySide, renderHistogram])

  // Statistics display
  const stats = useMemo(() => {
    if (!histogramA && !histogramB) return null

    return {
      a: histogramA ? {
        mean: Math.round(histogramA.mean.lum),
        median: histogramA.median.lum,
        shadows: histogramA.clippedShadows.toFixed(1),
        highlights: histogramA.clippedHighlights.toFixed(1)
      } : null,
      b: histogramB ? {
        mean: Math.round(histogramB.mean.lum),
        median: histogramB.median.lum,
        shadows: histogramB.clippedShadows.toFixed(1),
        highlights: histogramB.clippedHighlights.toFixed(1)
      } : null
    }
  }, [histogramA, histogramB])

  if (!isVisible) return null

  return (
    <div className="absolute bottom-24 right-4 bg-surface/95 border border-border rounded-lg shadow-xl z-50 w-[400px]">
      {/* Hidden sampling canvases */}
      <canvas ref={sampleCanvasARef} className="hidden" />
      <canvas ref={sampleCanvasBRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">Histogram</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Display mode toggle */}
          <button
            onClick={() => setDisplayMode(displayMode === 'rgb-overlay' ? 'rgb-separate' : displayMode === 'rgb-separate' ? 'luminance' : 'rgb-overlay')}
            className="p-1.5 rounded text-xs bg-surface-hover text-text-muted hover:text-text-primary"
            title="Toggle display mode"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          {/* Log scale toggle */}
          <button
            onClick={() => setUseLogScale(!useLogScale)}
            className={`p-1.5 rounded text-xs ${useLogScale ? 'bg-accent text-white' : 'bg-surface-hover text-text-muted hover:text-text-primary'}`}
            title="Toggle logarithmic scale"
          >
            <Scale className="w-3.5 h-3.5" />
          </button>
          {/* Side by side toggle */}
          <button
            onClick={() => setShowSideBySide(!showSideBySide)}
            className={`px-2 py-1 rounded text-xs ${showSideBySide ? 'bg-accent text-white' : 'bg-surface-hover text-text-muted'}`}
          >
            {showSideBySide ? 'A|B' : 'Overlay'}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Histogram canvas */}
      <canvas
        ref={canvasRef}
        width={380}
        height={160}
        className="w-full"
      />

      {/* Statistics */}
      {stats && (
        <div className="p-2 border-t border-border text-[10px] grid grid-cols-2 gap-2">
          {/* Source A stats */}
          <div className="space-y-0.5">
            <div className="text-orange-400 font-medium">Source A</div>
            {stats.a ? (
              <>
                <div className="flex justify-between">
                  <span className="text-text-muted">Mean:</span>
                  <span className="text-text-primary">{stats.a.mean}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Median:</span>
                  <span className="text-text-primary">{stats.a.median}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Clipped:</span>
                  <span className={`${Number(stats.a.shadows) > 1 || Number(stats.a.highlights) > 1 ? 'text-red-400' : 'text-text-primary'}`}>
                    S:{stats.a.shadows}% H:{stats.a.highlights}%
                  </span>
                </div>
              </>
            ) : (
              <span className="text-text-muted">No data</span>
            )}
          </div>

          {/* Source B stats */}
          <div className="space-y-0.5">
            <div className="text-lime-400 font-medium">Source B</div>
            {stats.b ? (
              <>
                <div className="flex justify-between">
                  <span className="text-text-muted">Mean:</span>
                  <span className="text-text-primary">{stats.b.mean}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Median:</span>
                  <span className="text-text-primary">{stats.b.median}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Clipped:</span>
                  <span className={`${Number(stats.b.shadows) > 1 || Number(stats.b.highlights) > 1 ? 'text-red-400' : 'text-text-primary'}`}>
                    S:{stats.b.shadows}% H:{stats.b.highlights}%
                  </span>
                </div>
              </>
            ) : (
              <span className="text-text-muted">No data</span>
            )}
          </div>
        </div>
      )}

      {/* Mode indicator */}
      <div className="px-2 pb-2 text-[9px] text-text-muted">
        Mode: {displayMode === 'rgb-overlay' ? 'RGB Overlay' : displayMode === 'rgb-separate' ? 'RGB Separate' : 'Luminance'}
        {useLogScale && ' (Log)'}
      </div>
    </div>
  )
}
