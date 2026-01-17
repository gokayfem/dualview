import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { BarChart3, X } from 'lucide-react'

interface HistogramOverlayProps {
  videoARef: React.RefObject<HTMLVideoElement | null>
  videoBRef: React.RefObject<HTMLVideoElement | null>
  imageARef?: React.RefObject<HTMLImageElement | null>
  imageBRef?: React.RefObject<HTMLImageElement | null>
  isEnabled: boolean
  onToggle: () => void
  mode?: 'rgb' | 'luminance'
}

interface HistogramData {
  r: number[]
  g: number[]
  b: number[]
  luminance: number[]
}

export function HistogramOverlay({
  videoARef,
  videoBRef,
  imageARef,
  imageBRef,
  isEnabled,
  onToggle,
  mode = 'rgb',
}: HistogramOverlayProps) {
  const canvasARef = useRef<HTMLCanvasElement>(null)
  const canvasBRef = useRef<HTMLCanvasElement>(null)
  const [histogramA, setHistogramA] = useState<HistogramData | null>(null)
  const [histogramB, setHistogramB] = useState<HistogramData | null>(null)
  const [displayMode, setDisplayMode] = useState<'rgb' | 'luminance'>(mode)
  const [overlayMode, setOverlayMode] = useState<'side-by-side' | 'overlay'>('side-by-side')
  const animationRef = useRef<number | undefined>(undefined)

  const calculateHistogram = (imageData: ImageData): HistogramData => {
    const r = new Array(256).fill(0)
    const g = new Array(256).fill(0)
    const b = new Array(256).fill(0)
    const luminance = new Array(256).fill(0)

    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      r[data[i]]++
      g[data[i + 1]]++
      b[data[i + 2]]++
      // Calculate luminance: 0.299*R + 0.587*G + 0.114*B
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      luminance[lum]++
    }

    return { r, g, b, luminance }
  }

  const getImageData = (
    source: HTMLVideoElement | HTMLImageElement | null,
    canvas: HTMLCanvasElement | null
  ): ImageData | null => {
    if (!source || !canvas) return null

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    let width: number, height: number
    if (source instanceof HTMLVideoElement) {
      width = source.videoWidth
      height = source.videoHeight
    } else {
      width = source.naturalWidth
      height = source.naturalHeight
    }

    if (width === 0 || height === 0) return null

    // Sample at a lower resolution for performance
    const sampleWidth = Math.min(width, 320)
    const sampleHeight = Math.min(height, 180)
    canvas.width = sampleWidth
    canvas.height = sampleHeight

    ctx.drawImage(source, 0, 0, sampleWidth, sampleHeight)
    return ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  }

  useEffect(() => {
    if (!isEnabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      return
    }

    const updateHistograms = () => {
      // Source A
      const sourceA = videoARef?.current ?? imageARef?.current ?? null
      const imageDataA = getImageData(sourceA, canvasARef.current)
      if (imageDataA) {
        setHistogramA(calculateHistogram(imageDataA))
      }

      // Source B
      const sourceB = videoBRef?.current ?? imageBRef?.current ?? null
      const imageDataB = getImageData(sourceB, canvasBRef.current)
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
  }, [isEnabled, videoARef, videoBRef, imageARef, imageBRef])

  if (!isEnabled) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-2 right-2 p-2 bg-surface/80 hover:bg-surface border border-border rounded z-10"
        title="Show Histogram (H)"
      >
        <BarChart3 className="w-4 h-4 text-text-secondary" />
      </button>
    )
  }

  return (
    <>
      {/* Hidden canvases for sampling */}
      <canvas ref={canvasARef} className="hidden" />
      <canvas ref={canvasBRef} className="hidden" />

      {/* Histogram panel */}
      <div className="absolute top-2 right-2 bg-surface/90 border border-border rounded p-2 z-10 min-w-[280px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-secondary">Histogram</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDisplayMode(displayMode === 'rgb' ? 'luminance' : 'rgb')}
              className={cn(
                "px-2 py-0.5 text-xs rounded",
                "bg-surface-hover text-text-muted hover:text-text-primary"
              )}
            >
              {displayMode === 'rgb' ? 'RGB' : 'Lum'}
            </button>
            <button
              onClick={() => setOverlayMode(overlayMode === 'side-by-side' ? 'overlay' : 'side-by-side')}
              className="px-2 py-0.5 text-xs rounded bg-surface-hover text-text-muted hover:text-text-primary"
            >
              {overlayMode === 'side-by-side' ? 'Split' : 'Overlay'}
            </button>
            <button onClick={onToggle} className="p-1 hover:bg-surface-hover rounded">
              <X className="w-3 h-3 text-text-muted" />
            </button>
          </div>
        </div>

        {overlayMode === 'side-by-side' ? (
          <div className="flex gap-2">
            {/* Histogram A */}
            <div className="flex-1">
              <div className="text-[10px] text-orange-400 mb-1">A</div>
              <HistogramCanvas histogram={histogramA} displayMode={displayMode} />
            </div>
            {/* Histogram B */}
            <div className="flex-1">
              <div className="text-[10px] text-lime-400 mb-1">B</div>
              <HistogramCanvas histogram={histogramB} displayMode={displayMode} />
            </div>
          </div>
        ) : (
          <div>
            <HistogramCanvasOverlay
              histogramA={histogramA}
              histogramB={histogramB}
              displayMode={displayMode}
            />
            <div className="flex justify-center gap-4 mt-1 text-[10px]">
              <span className="text-orange-400">● A</span>
              <span className="text-lime-400">● B</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function HistogramCanvas({
  histogram,
  displayMode,
}: {
  histogram: HistogramData | null
  displayMode: 'rgb' | 'luminance'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !histogram) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, width, height)

    drawHistogramData(ctx, histogram, width, height, displayMode)
  }, [histogram, displayMode])

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={60}
      className="w-full h-[60px] rounded"
    />
  )
}

function HistogramCanvasOverlay({
  histogramA,
  histogramB,
  displayMode,
}: {
  histogramA: HistogramData | null
  histogramB: HistogramData | null
  displayMode: 'rgb' | 'luminance'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, width, height)

    if (histogramA) {
      drawHistogramData(ctx, histogramA, width, height, displayMode, 'rgba(255, 150, 50, 0.5)')
    }
    if (histogramB) {
      drawHistogramData(ctx, histogramB, width, height, displayMode, 'rgba(150, 255, 50, 0.5)')
    }
  }, [histogramA, histogramB, displayMode])

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={80}
      className="w-full h-[80px] rounded"
    />
  )
}

function drawHistogramData(
  ctx: CanvasRenderingContext2D,
  data: HistogramData,
  width: number,
  height: number,
  displayMode: 'rgb' | 'luminance',
  overrideColor?: string
) {
  const channels = displayMode === 'luminance' ? ['luminance'] : ['r', 'g', 'b']
  const colors: Record<string, string> = overrideColor
    ? { r: overrideColor, g: overrideColor, b: overrideColor, luminance: overrideColor }
    : {
        r: 'rgba(255, 0, 0, 0.6)',
        g: 'rgba(0, 255, 0, 0.6)',
        b: 'rgba(0, 128, 255, 0.6)',
        luminance: 'rgba(255, 255, 255, 0.7)',
      }

  let maxVal = 0
  for (const channel of channels) {
    const arr = data[channel as keyof HistogramData]
    maxVal = Math.max(maxVal, ...arr)
  }

  const barWidth = width / 256

  for (const channel of channels) {
    const arr = data[channel as keyof HistogramData]
    ctx.fillStyle = colors[channel]
    ctx.beginPath()
    ctx.moveTo(0, height)

    for (let i = 0; i < 256; i++) {
      const x = i * barWidth
      const h = (arr[i] / maxVal) * height * 0.9
      ctx.lineTo(x, height - h)
    }

    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fill()
  }
}
