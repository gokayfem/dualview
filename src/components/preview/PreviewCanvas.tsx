import { useRef, useImperativeHandle, forwardRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import {
  SliderComparison,
  SideBySide,
  BlendModes,
  SplitScreen,
  FlickerComparison,
  PromptDiff,
  DifferenceHeatmap,
  JsonDiffView,
  Model3DComparison,
  WebGLComparison,
  AudioComparison,
  // MODE-001 to MODE-005: New comparison modes
  QuadComparison,
  RadialLoupeComparison,
  GridTileComparison,
  MorphologicalView,
  // Document comparison
  DocumentComparison,
} from '../comparison'

export interface PreviewCanvasHandle {
  captureFrame: () => HTMLCanvasElement | null
}

interface PreviewCanvasProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  isTimelineVisible?: boolean
}

export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(
  function PreviewCanvas({ canvasRef, isTimelineVisible = true }, ref) {
    const { comparisonMode } = useProjectStore()
    const containerRef = useRef<HTMLDivElement>(null)
    const exportCanvasRef = useRef<HTMLCanvasElement>(null)

    // Expose captureFrame method to parent
    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        const container = containerRef.current
        const canvas = exportCanvasRef.current
        if (!container || !canvas) return null

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        const rect = container.getBoundingClientRect()

        // Set canvas size to match container
        canvas.width = 1920
        canvas.height = 1080

        // Calculate scale to fit container content to 1920x1080
        const scaleX = 1920 / rect.width
        const scaleY = 1080 / rect.height

        // Fill background
        ctx.fillStyle = '#0d0d0d'
        ctx.fillRect(0, 0, 1920, 1080)

        // Find all video, image, and canvas elements
        const videos = container.querySelectorAll('video')
        const images = container.querySelectorAll('img')
        const canvases = container.querySelectorAll('canvas')

        const drawMedia = (media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
          const mediaRect = media.getBoundingClientRect()
          const x = (mediaRect.left - rect.left) * scaleX
          const y = (mediaRect.top - rect.top) * scaleY
          const width = mediaRect.width * scaleX
          const height = mediaRect.height * scaleY

          try {
            ctx.drawImage(media, x, y, width, height)
          } catch (e) {
            console.warn('Failed to draw media element:', e)
          }
        }

        // Draw in order: videos first, then images, then canvases
        videos.forEach(v => {
          if (!v.classList.contains('hidden')) drawMedia(v)
        })
        images.forEach(i => drawMedia(i))
        canvases.forEach(c => {
          if (c !== canvas) drawMedia(c)
        })

        return canvas
      }
    }))

    return (
      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
        <div
          ref={containerRef}
          className={`w-full h-full max-w-[1920px] relative ${isTimelineVisible && comparisonMode !== 'document' ? 'max-h-[1080px] aspect-video' : ''}`}
        >
          {comparisonMode === 'slider' && <SliderComparison />}
          {comparisonMode === 'side-by-side' && <SideBySide />}
          {comparisonMode === 'blend' && <BlendModes />}
          {comparisonMode === 'split' && <SplitScreen />}
          {comparisonMode === 'flicker' && <FlickerComparison />}
          {comparisonMode === 'prompt-diff' && <PromptDiff />}
          {comparisonMode === 'json-diff' && <JsonDiffView />}
          {comparisonMode === 'heatmap' && <DifferenceHeatmap />}
          {comparisonMode === 'audio' && <AudioComparison />}
          {comparisonMode === 'model-3d' && <Model3DComparison />}
          {comparisonMode === 'webgl-compare' && <WebGLComparison />}
          {/* MODE-001 to MODE-005: New comparison modes */}
          {comparisonMode === 'quad' && <QuadComparison />}
          {comparisonMode === 'radial-loupe' && <RadialLoupeComparison />}
          {comparisonMode === 'grid-tile' && <GridTileComparison />}
          {comparisonMode === 'morphological' && <MorphologicalView />}
          {/* Document comparison */}
          {comparisonMode === 'document' && <DocumentComparison />}
        </div>

        {/* Hidden canvas for export frame capture */}
        <canvas
          ref={exportCanvasRef}
          className="hidden"
          width={1920}
          height={1080}
        />

        {/* Legacy canvas ref support */}
        {canvasRef && (
          <canvas
            ref={canvasRef}
            className="hidden"
            width={1920}
            height={1080}
          />
        )}
      </div>
    )
  }
)
