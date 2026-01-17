import { useState, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { Pipette, Copy, Check } from 'lucide-react'

interface ColorInfo {
  x: number
  y: number
  r: number
  g: number
  b: number
  hex: string
  hsl: { h: number; s: number; l: number }
}

interface ColorPickerComparisonProps {
  isEnabled: boolean
  onToggle: () => void
  colorA: ColorInfo | null
  colorB: ColorInfo | null
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function calculateDeltaE(colorA: ColorInfo, colorB: ColorInfo): number {
  // Simple Delta E using LAB approximation
  const labA = rgbToLab(colorA.r, colorA.g, colorA.b)
  const labB = rgbToLab(colorB.r, colorB.g, colorB.b)

  const deltaL = labA.l - labB.l
  const deltaA = labA.a - labB.a
  const deltaB = labA.b - labB.b

  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB)
}

function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  // Convert RGB to XYZ
  let rr = r / 255
  let gg = g / 255
  let bb = b / 255

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92

  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047
  const y = (rr * 0.2126 + gg * 0.7152 + bb * 0.0722) / 1.0
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883

  const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116
  const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116
  const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function ColorPickerComparison({
  isEnabled,
  onToggle,
  colorA,
  colorB,
}: ColorPickerComparisonProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null)

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(value)
      setTimeout(() => setCopiedValue(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const deltaE = colorA && colorB ? calculateDeltaE(colorA, colorB) : null

  if (!isEnabled) {
    return (
      <button
        onClick={onToggle}
        className="absolute bottom-2 left-2 p-2 bg-surface/80 hover:bg-surface border border-border rounded z-10"
        title="Color Picker"
      >
        <Pipette className="w-4 h-4 text-text-secondary" />
      </button>
    )
  }

  return (
    <div className="absolute bottom-2 left-2 bg-surface/95 border border-border rounded p-3 z-10 min-w-[300px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-secondary flex items-center gap-2">
          <Pipette className="w-4 h-4" />
          Color Picker
        </span>
        <button
          onClick={onToggle}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Close
        </button>
      </div>

      <div className="text-xs text-text-muted mb-2">
        Click on the image to sample colors
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Color A */}
        <ColorPanel
          label="A"
          color={colorA}
          labelColor="text-orange-400"
          onCopy={copyToClipboard}
          copiedValue={copiedValue}
        />

        {/* Color B */}
        <ColorPanel
          label="B"
          color={colorB}
          labelColor="text-lime-400"
          onCopy={copyToClipboard}
          copiedValue={copiedValue}
        />
      </div>

      {/* Delta E */}
      {deltaE !== null && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Color Difference (ΔE)</span>
            <span
              className={cn(
                "text-sm font-mono font-medium",
                deltaE < 1 ? "text-green-400" :
                deltaE < 5 ? "text-yellow-400" :
                deltaE < 10 ? "text-orange-400" :
                "text-red-400"
              )}
            >
              {deltaE.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-text-muted mt-1">
            {deltaE < 1 ? "Not perceptible" :
             deltaE < 2 ? "Barely perceptible" :
             deltaE < 5 ? "Perceptible on close look" :
             deltaE < 10 ? "Easily noticeable" :
             "Very different"}
          </div>
        </div>
      )}
    </div>
  )
}

function ColorPanel({
  label,
  color,
  labelColor,
  onCopy,
  copiedValue,
}: {
  label: string
  color: ColorInfo | null
  labelColor: string
  onCopy: (value: string) => void
  copiedValue: string | null
}) {
  if (!color) {
    return (
      <div className="text-center text-text-muted text-xs py-4">
        <span className={labelColor}>{label}</span>
        <div className="mt-1">No color sampled</div>
      </div>
    )
  }

  return (
    <div>
      <div className={cn("text-xs font-medium mb-2", labelColor)}>{label}</div>

      {/* Color swatch */}
      <div
        className="w-full h-8 rounded border border-border mb-2"
        style={{ backgroundColor: color.hex }}
      />

      {/* Values */}
      <div className="space-y-1 text-xs">
        <CopyableValue
          label="HEX"
          value={color.hex}
          onCopy={onCopy}
          copiedValue={copiedValue}
        />
        <CopyableValue
          label="RGB"
          value={`${color.r}, ${color.g}, ${color.b}`}
          onCopy={onCopy}
          copiedValue={copiedValue}
        />
        <CopyableValue
          label="HSL"
          value={`${color.hsl.h}°, ${color.hsl.s}%, ${color.hsl.l}%`}
          onCopy={onCopy}
          copiedValue={copiedValue}
        />
        <div className="text-text-muted">
          @ ({color.x}, {color.y})
        </div>
      </div>
    </div>
  )
}

function CopyableValue({
  label,
  value,
  onCopy,
  copiedValue,
}: {
  label: string
  value: string
  onCopy: (value: string) => void
  copiedValue: string | null
}) {
  const isCopied = copiedValue === value

  return (
    <div className="flex items-center justify-between group">
      <span className="text-text-muted">{label}:</span>
      <div className="flex items-center gap-1">
        <span className="text-text-primary font-mono">{value}</span>
        <button
          onClick={() => onCopy(value)}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-surface-hover rounded transition-opacity"
          title="Copy"
        >
          {isCopied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3 text-text-muted" />
          )}
        </button>
      </div>
    </div>
  )
}

// Hook to use with comparison components
export function useColorPicker() {
  const [colorA, setColorA] = useState<ColorInfo | null>(null)
  const [colorB, setColorB] = useState<ColorInfo | null>(null)

  const sampleColor = useCallback((
    e: React.MouseEvent,
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null,
    side: 'a' | 'b'
  ) => {
    if (!source) return

    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)

    // Create canvas to sample pixel
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let sourceWidth: number, sourceHeight: number
    if (source instanceof HTMLVideoElement) {
      sourceWidth = source.videoWidth
      sourceHeight = source.videoHeight
    } else if (source instanceof HTMLImageElement) {
      sourceWidth = source.naturalWidth
      sourceHeight = source.naturalHeight
    } else {
      sourceWidth = source.width
      sourceHeight = source.height
    }

    canvas.width = sourceWidth
    canvas.height = sourceHeight
    ctx.drawImage(source, 0, 0)

    // Map click position to source coordinates
    const scaleX = sourceWidth / rect.width
    const scaleY = sourceHeight / rect.height
    const sourceX = Math.round(x * scaleX)
    const sourceY = Math.round(y * scaleY)

    const pixel = ctx.getImageData(sourceX, sourceY, 1, 1).data
    const r = pixel[0]
    const g = pixel[1]
    const b = pixel[2]

    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
    const hsl = rgbToHsl(r, g, b)

    const colorInfo: ColorInfo = { x: sourceX, y: sourceY, r, g, b, hex, hsl }

    if (side === 'a') {
      setColorA(colorInfo)
    } else {
      setColorB(colorInfo)
    }
  }, [])

  return { colorA, colorB, sampleColor, setColorA, setColorB }
}
