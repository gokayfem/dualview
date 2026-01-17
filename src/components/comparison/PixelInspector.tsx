/**
 * IMG-003: Pixel Inspector
 * Shows RGB values when clicking on images
 */
import { useProjectStore } from '../../stores/projectStore'
import { cn } from '../../lib/utils'

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

function PixelInfo({
  label,
  info,
  labelColor
}: {
  label: string
  info: { x: number; y: number; r: number; g: number; b: number } | null
  labelColor: string
}) {
  if (!info) return null

  const hex = rgbToHex(info.r, info.g, info.b)

  return (
    <div className="flex items-center gap-3">
      <div className={cn('px-2 py-0.5 text-xs font-bold', labelColor)}>
        {label}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 border border-white/20"
          style={{ backgroundColor: hex }}
        />
        <div className="text-[10px] font-mono text-text-primary">
          <div>R: {info.r} G: {info.g} B: {info.b}</div>
          <div className="text-text-muted">{hex}</div>
        </div>
      </div>
      <div className="text-[10px] text-text-muted">
        ({info.x}, {info.y})
      </div>
    </div>
  )
}

export function PixelInspector() {
  const {
    pixelInspectorEnabled,
    pixelInfoA,
    pixelInfoB,
    togglePixelInspector
  } = useProjectStore()

  const hasInfo = pixelInfoA || pixelInfoB

  // Calculate difference if both are set
  const diff = pixelInfoA && pixelInfoB ? {
    r: Math.abs(pixelInfoA.r - pixelInfoB.r),
    g: Math.abs(pixelInfoA.g - pixelInfoB.g),
    b: Math.abs(pixelInfoA.b - pixelInfoB.b),
  } : null

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={togglePixelInspector}
        className={cn(
          'absolute top-4 right-4 z-20 px-2 py-1 text-xs transition-colors',
          pixelInspectorEnabled
            ? 'bg-accent text-white'
            : 'bg-black/60 text-text-muted hover:text-text-primary'
        )}
        title="Toggle Pixel Inspector (Click on image to inspect)"
      >
        {pixelInspectorEnabled ? 'Inspector ON' : 'Inspector'}
      </button>

      {/* Pixel info overlay */}
      {pixelInspectorEnabled && hasInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-sm p-3 space-y-2">
          <PixelInfo
            label="A"
            info={pixelInfoA}
            labelColor="bg-orange-500 text-white"
          />
          <PixelInfo
            label="B"
            info={pixelInfoB}
            labelColor="bg-lime-400 text-black"
          />

          {diff && (
            <div className="pt-2 border-t border-white/10 flex items-center gap-3">
              <div className="px-2 py-0.5 text-xs font-bold bg-gray-600 text-white">
                Delta
              </div>
              <div className="text-[10px] font-mono text-text-primary">
                R: {diff.r} G: {diff.g} B: {diff.b}
              </div>
              <div className="text-[10px] text-text-muted">
                Total: {diff.r + diff.g + diff.b}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions when enabled but no info */}
      {pixelInspectorEnabled && !hasInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 px-3 py-2 text-[10px] text-text-muted">
          Click on image to inspect pixel values
        </div>
      )}
    </>
  )
}
