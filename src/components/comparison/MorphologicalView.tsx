/**
 * MorphologicalView Component (MODE-005)
 * Apply morphological operations to compare structural changes
 * Features:
 * - Erosion, dilation, opening, closing, gradient operations
 * - Configurable structuring element size (3x3, 5x5, 7x7)
 * - Shape options (square, circle, cross)
 * - Chain multiple operations
 * - Side-by-side comparison with original
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useProjectStore } from '../../stores/projectStore'
import { useOptimizedClipSync } from '../../hooks/useOptimizedVideoSync'
import type { MorphOperation, MorphElementSize, MorphElementShape } from '../../types'
import {
  Shrink, Expand, Minus, Plus, Circle, Square, X, Trash2, Eye, EyeOff, ArrowRight
} from 'lucide-react'

// Generate structuring element kernel
function generateKernel(size: MorphElementSize, shape: MorphElementShape): number[][] {
  const kernel: number[][] = []
  const center = Math.floor(size / 2)

  for (let y = 0; y < size; y++) {
    const row: number[] = []
    for (let x = 0; x < size; x++) {
      let value = 0

      if (shape === 'square') {
        value = 1
      } else if (shape === 'circle') {
        const dx = x - center
        const dy = y - center
        const dist = Math.sqrt(dx * dx + dy * dy)
        value = dist <= center ? 1 : 0
      } else if (shape === 'cross') {
        if (x === center || y === center) {
          value = 1
        }
      }

      row.push(value)
    }
    kernel.push(row)
  }

  return kernel
}

// Apply erosion: minimum filter within kernel
function applyErosion(
  imageData: ImageData,
  kernel: number[][],
  kernelSize: number
): ImageData {
  const { data, width, height } = imageData
  const output = new ImageData(width, height)
  const center = Math.floor(kernelSize / 2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minR = 255, minG = 255, minB = 255

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          if (kernel[ky][kx] === 0) continue

          const sx = x + kx - center
          const sy = y + ky - center

          if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const idx = (sy * width + sx) * 4
            minR = Math.min(minR, data[idx])
            minG = Math.min(minG, data[idx + 1])
            minB = Math.min(minB, data[idx + 2])
          }
        }
      }

      const outIdx = (y * width + x) * 4
      output.data[outIdx] = minR
      output.data[outIdx + 1] = minG
      output.data[outIdx + 2] = minB
      output.data[outIdx + 3] = 255
    }
  }

  return output
}

// Apply dilation: maximum filter within kernel
function applyDilation(
  imageData: ImageData,
  kernel: number[][],
  kernelSize: number
): ImageData {
  const { data, width, height } = imageData
  const output = new ImageData(width, height)
  const center = Math.floor(kernelSize / 2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxR = 0, maxG = 0, maxB = 0

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          if (kernel[ky][kx] === 0) continue

          const sx = x + kx - center
          const sy = y + ky - center

          if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const idx = (sy * width + sx) * 4
            maxR = Math.max(maxR, data[idx])
            maxG = Math.max(maxG, data[idx + 1])
            maxB = Math.max(maxB, data[idx + 2])
          }
        }
      }

      const outIdx = (y * width + x) * 4
      output.data[outIdx] = maxR
      output.data[outIdx + 1] = maxG
      output.data[outIdx + 2] = maxB
      output.data[outIdx + 3] = 255
    }
  }

  return output
}

// Apply morphological gradient (dilation - erosion)
function applyGradient(
  imageData: ImageData,
  kernel: number[][],
  kernelSize: number
): ImageData {
  const dilated = applyDilation(imageData, kernel, kernelSize)
  const eroded = applyErosion(imageData, kernel, kernelSize)
  const { width, height } = imageData
  const output = new ImageData(width, height)

  for (let i = 0; i < dilated.data.length; i += 4) {
    output.data[i] = Math.abs(dilated.data[i] - eroded.data[i])
    output.data[i + 1] = Math.abs(dilated.data[i + 1] - eroded.data[i + 1])
    output.data[i + 2] = Math.abs(dilated.data[i + 2] - eroded.data[i + 2])
    output.data[i + 3] = 255
  }

  return output
}

export function MorphologicalView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoARef = useRef<HTMLVideoElement>(null)
  const imgARef = useRef<HTMLImageElement>(null)
  const animationRef = useRef<number>(0)
  const processedImageRef = useRef<ImageData | null>(null)

  const [imagesLoaded, setImagesLoaded] = useState({ a: false })
  const [processing, setProcessing] = useState(false)

  const {
    morphologicalSettings,
    setMorphologicalSettings,
    addMorphOperation,
    removeMorphOperation,
    clearMorphOperations
  } = useProjectStore()
  const { getFile } = useMediaStore()
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()

  // Get tracks and clips
  const trackA = tracks.find(t => t.type === 'a')
  const firstClipA = trackA?.clips[0] || null

  // Find active clip
  const activeClipA = useMemo(() => {
    if (!trackA) return null
    return trackA.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime) || null
  }, [trackA, currentTime])

  // Get media files - use active clip (clip at current time), fallback to first clip
  const displayClipA = activeClipA || firstClipA
  const rawMediaA = displayClipA ? getFile(displayClipA.mediaId) : null
  const mediaA = rawMediaA?.type === 'video' || rawMediaA?.type === 'image' ? rawMediaA : null

  // Sync video playback
  useOptimizedClipSync(videoARef, activeClipA || firstClipA)

  // Handle image load
  const handleImageALoad = useCallback(() => {
    setImagesLoaded(prev => ({ ...prev, a: true }))
  }, [])

  // Generate kernel based on settings
  const kernel = useMemo(() => {
    return generateKernel(morphologicalSettings.elementSize, morphologicalSettings.elementShape)
  }, [morphologicalSettings.elementSize, morphologicalSettings.elementShape])

  // Apply operations chain
  const applyOperations = useCallback((imageData: ImageData, operations: MorphOperation[]): ImageData => {
    let result = imageData

    for (const op of operations) {
      switch (op) {
        case 'erosion':
          result = applyErosion(result, kernel, morphologicalSettings.elementSize)
          break
        case 'dilation':
          result = applyDilation(result, kernel, morphologicalSettings.elementSize)
          break
        case 'opening':
          // Opening = erosion then dilation
          result = applyErosion(result, kernel, morphologicalSettings.elementSize)
          result = applyDilation(result, kernel, morphologicalSettings.elementSize)
          break
        case 'closing':
          // Closing = dilation then erosion
          result = applyDilation(result, kernel, morphologicalSettings.elementSize)
          result = applyErosion(result, kernel, morphologicalSettings.elementSize)
          break
        case 'gradient':
          result = applyGradient(result, kernel, morphologicalSettings.elementSize)
          break
      }
    }

    return result
  }, [kernel, morphologicalSettings.elementSize])

  // Process image when operations or source changes
  useEffect(() => {
    const source = mediaA?.type === 'video' ? videoARef.current :
                   mediaA?.type === 'image' ? imgARef.current : null

    if (!source) {
      processedImageRef.current = null
      return
    }

    const isReady = mediaA?.type === 'video' ?
      (videoARef.current?.readyState || 0) >= 2 :
      mediaA?.type === 'image' && imagesLoaded.a

    if (!isReady || morphologicalSettings.operations.length === 0) {
      processedImageRef.current = null
      return
    }

    setProcessing(true)

    // Create temporary canvas for processing
    const tempCanvas = document.createElement('canvas')
    const srcWidth = 'videoWidth' in source ? source.videoWidth : source.naturalWidth
    const srcHeight = 'videoHeight' in source ? source.videoHeight : source.naturalHeight

    // Limit processing resolution for performance
    const maxDim = 512
    const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight))
    tempCanvas.width = srcWidth * scale
    tempCanvas.height = srcHeight * scale

    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) {
      setProcessing(false)
      return
    }

    tempCtx.drawImage(source, 0, 0, tempCanvas.width, tempCanvas.height)
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)

    // Apply operations (in a setTimeout to not block UI)
    setTimeout(() => {
      const result = applyOperations(imageData, morphologicalSettings.operations)
      processedImageRef.current = result
      setProcessing(false)
    }, 0)
  }, [mediaA, morphologicalSettings.operations, applyOperations, imagesLoaded])

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Get container dimensions
    const rect = container.getBoundingClientRect()
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width
      canvas.height = rect.height
    }

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get source
    const sourceA = mediaA?.type === 'video' ? videoARef.current :
                   mediaA?.type === 'image' ? imgARef.current : null

    const sourceAReady = sourceA && (
      mediaA?.type === 'video' ? (videoARef.current?.readyState || 0) >= 2 :
      mediaA?.type === 'image' && imagesLoaded.a
    )

    if (!sourceA || !sourceAReady) {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, width, height)
      animationRef.current = requestAnimationFrame(render)
      return
    }

    // Draw side by side if showOriginal is enabled
    if (morphologicalSettings.showOriginal && processedImageRef.current) {
      // Left half: original
      const halfWidth = width / 2
      ctx.drawImage(sourceA, 0, 0, halfWidth, height)

      // Right half: processed
      const processedCanvas = document.createElement('canvas')
      processedCanvas.width = processedImageRef.current.width
      processedCanvas.height = processedImageRef.current.height
      const processedCtx = processedCanvas.getContext('2d')
      if (processedCtx) {
        processedCtx.putImageData(processedImageRef.current, 0, 0)
        ctx.drawImage(processedCanvas, halfWidth, 0, halfWidth, height)
      }

      // Draw divider
      ctx.strokeStyle = '#ffff00'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(halfWidth, 0)
      ctx.lineTo(halfWidth, height)
      ctx.stroke()

      // Labels
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(10, height - 30, 80, 20)
      ctx.fillRect(halfWidth + 10, height - 30, 80, 20)

      ctx.fillStyle = '#ffffff'
      ctx.font = '12px sans-serif'
      ctx.fillText('Original', 15, height - 15)
      ctx.fillText('Processed', halfWidth + 15, height - 15)
    } else if (processedImageRef.current && morphologicalSettings.operations.length > 0) {
      // Full view: processed only
      const processedCanvas = document.createElement('canvas')
      processedCanvas.width = processedImageRef.current.width
      processedCanvas.height = processedImageRef.current.height
      const processedCtx = processedCanvas.getContext('2d')
      if (processedCtx) {
        processedCtx.putImageData(processedImageRef.current, 0, 0)
        ctx.drawImage(processedCanvas, 0, 0, width, height)
      }
    } else {
      // No operations: show original
      ctx.drawImage(sourceA, 0, 0, width, height)
    }

    animationRef.current = requestAnimationFrame(render)
  }, [mediaA, morphologicalSettings.showOriginal, morphologicalSettings.operations.length, imagesLoaded])

  // Start render loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  // Operation buttons config
  const operations: { id: MorphOperation; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'erosion', label: 'Erosion', icon: <Shrink size={14} />, description: 'Min filter - shrinks bright regions' },
    { id: 'dilation', label: 'Dilation', icon: <Expand size={14} />, description: 'Max filter - expands bright regions' },
    { id: 'opening', label: 'Opening', icon: <Minus size={14} />, description: 'Erosion + Dilation - removes noise' },
    { id: 'closing', label: 'Closing', icon: <Plus size={14} />, description: 'Dilation + Erosion - fills gaps' },
    { id: 'gradient', label: 'Gradient', icon: <ArrowRight size={14} />, description: 'Dilation - Erosion - finds edges' }
  ]

  // Shape buttons config
  const shapes: { id: MorphElementShape; label: string; icon: React.ReactNode }[] = [
    { id: 'square', label: 'Square', icon: <Square size={14} /> },
    { id: 'circle', label: 'Circle', icon: <Circle size={14} /> },
    { id: 'cross', label: 'Cross', icon: <Plus size={14} /> }
  ]

  // Empty state
  if (!mediaA) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-center p-8">
          <Shrink className="w-16 h-16 mx-auto mb-4 text-text-muted" />
          <h3 className="text-xl font-bold text-text-primary mb-2">Morphological Operations</h3>
          <p className="text-text-muted">
            Add media to Track A to apply morphological transforms.
          </p>
          <p className="text-sm text-text-muted mt-4">
            Use erosion, dilation, opening, closing, and gradient operations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-black overflow-hidden"
    >
      {/* Hidden video element */}
      <video
        ref={videoARef}
        src={mediaA?.type === 'video' ? mediaA.url : undefined}
        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        muted
        playsInline
        loop
        preload="auto"
      />

      {/* Hidden image element */}
      {mediaA?.type === 'image' && (
        <img
          ref={imgARef}
          src={mediaA.url}
          className="hidden"
          onLoad={handleImageALoad}
          alt=""
        />
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />

      {/* Processing indicator */}
      {processing && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 px-4 py-2 rounded">
          <span className="text-white">Processing...</span>
        </div>
      )}

      {/* Mode indicator */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1.5 rounded text-sm">
        <span className="text-gray-400">Mode:</span>
        <span className="text-[#cddc39] ml-2 font-medium">Morphological</span>
      </div>

      {/* Operation chain */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/70 px-3 py-1.5 rounded">
        {morphologicalSettings.operations.length === 0 ? (
          <span className="text-gray-500 text-sm">Add operations below</span>
        ) : (
          morphologicalSettings.operations.map((op, idx) => (
            <div key={idx} className="flex items-center">
              <button
                onClick={() => removeMorphOperation(idx)}
                className="px-2 py-1 bg-surface rounded text-xs text-white hover:bg-red-600 transition-colors group"
                title="Click to remove"
              >
                {op}
                <X size={10} className="inline ml-1 opacity-0 group-hover:opacity-100" />
              </button>
              {idx < morphologicalSettings.operations.length - 1 && (
                <ArrowRight size={12} className="mx-1 text-gray-500" />
              )}
            </div>
          ))
        )}
        {morphologicalSettings.operations.length > 0 && (
          <button
            onClick={clearMorphOperations}
            className="ml-2 p-1 text-gray-400 hover:text-red-400"
            title="Clear all"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Controls panel */}
      <div className="absolute right-4 top-4 flex flex-col gap-3">
        {/* Show original toggle */}
        <button
          onClick={() => setMorphologicalSettings({ showOriginal: !morphologicalSettings.showOriginal })}
          className={`p-2 rounded transition-colors ${morphologicalSettings.showOriginal ? 'bg-accent text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
          title={morphologicalSettings.showOriginal ? 'Hide original' : 'Show original side-by-side'}
        >
          {morphologicalSettings.showOriginal ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>

      {/* Operation buttons */}
      <div className="absolute bottom-20 left-4 right-4 flex justify-center gap-2">
        {operations.map(op => (
          <button
            key={op.id}
            onClick={() => addMorphOperation(op.id)}
            className="px-3 py-2 bg-black/70 hover:bg-accent/50 rounded text-sm text-white flex items-center gap-2 transition-colors"
            title={op.description}
          >
            {op.icon}
            {op.label}
          </button>
        ))}
      </div>

      {/* Settings panel */}
      <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded flex items-center gap-4">
        {/* Element size */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Size</label>
          <div className="flex gap-1">
            {([3, 5, 7] as MorphElementSize[]).map(size => (
              <button
                key={size}
                onClick={() => setMorphologicalSettings({ elementSize: size })}
                className={`px-2 py-1 rounded text-xs transition-colors ${morphologicalSettings.elementSize === size ? 'bg-accent text-white' : 'bg-surface text-gray-400 hover:text-white'}`}
              >
                {size}x{size}
              </button>
            ))}
          </div>
        </div>

        {/* Element shape */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Shape</label>
          <div className="flex gap-1">
            {shapes.map(shape => (
              <button
                key={shape.id}
                onClick={() => setMorphologicalSettings({ elementShape: shape.id })}
                className={`p-1.5 rounded transition-colors ${morphologicalSettings.elementShape === shape.id ? 'bg-accent text-white' : 'bg-surface text-gray-400 hover:text-white'}`}
                title={shape.label}
              >
                {shape.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kernel visualization */}
      <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-2 rounded">
        <label className="text-xs text-gray-400 block mb-1">Kernel</label>
        <div className="flex flex-col gap-px">
          {kernel.map((row, y) => (
            <div key={y} className="flex gap-px">
              {row.map((val, x) => (
                <div
                  key={`${x}-${y}`}
                  className={`w-3 h-3 ${val ? 'bg-accent' : 'bg-surface'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
