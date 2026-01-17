import { useState } from 'react'
import { useProjectStore, ASPECT_RATIO_PRESETS, RESOLUTION_PRESETS } from '../../stores/projectStore'
import { cn } from '../../lib/utils'
import { RectangleHorizontal, RectangleVertical, Square, Monitor, Film, ChevronDown, AlertTriangle } from 'lucide-react'
import type { AspectRatioPreset, ResolutionPreset } from '../../types'

// Icons for each aspect ratio
const PRESET_ICONS: Record<AspectRatioPreset, React.ReactNode> = {
  '16:9': <RectangleHorizontal className="w-3.5 h-3.5" />,
  '9:16': <RectangleVertical className="w-3.5 h-3.5" />,
  '1:1': <Square className="w-3.5 h-3.5" />,
  '4:3': <Monitor className="w-3.5 h-3.5" />,
  '21:9': <Film className="w-3.5 h-3.5" />,
  '4:5': <RectangleVertical className="w-3.5 h-3.5" />,
  'custom': <Square className="w-3.5 h-3.5" />,
}

// Resolution preset order
const RESOLUTION_ORDER: ResolutionPreset[] = ['720p', '1080p', '2160p', 'custom']

// Calculate approximate memory usage for a resolution
function estimateMemoryMB(width: number, height: number): number {
  // 4 bytes per pixel (RGBA) * 2 (double buffer)
  return (width * height * 4 * 2) / (1024 * 1024)
}

interface AspectRatioSelectorProps {
  compact?: boolean
  showCustomInput?: boolean
  showResolution?: boolean
  className?: string
}

export function AspectRatioSelector({ compact = false, showCustomInput = true, showResolution = true, className }: AspectRatioSelectorProps) {
  const { 
    aspectRatioSettings, 
    setAspectRatioPreset, 
    setCustomAspectRatio,
    setResolutionPreset,
    setCustomResolution,
    getResolution,
  } = useProjectStore()
  const [isOpen, setIsOpen] = useState(false)
  const [customWidth, setCustomWidth] = useState(aspectRatioSettings.customWidth || 1920)
  const [customHeight, setCustomHeight] = useState(aspectRatioSettings.customHeight || 1080)
  const [customResWidth, setCustomResWidth] = useState(aspectRatioSettings.customResolutionWidth || 1920)
  const [customResHeight, setCustomResHeight] = useState(aspectRatioSettings.customResolutionHeight || 1080)

  const currentPreset = ASPECT_RATIO_PRESETS[aspectRatioSettings.preset]
  const presetKeys = Object.keys(ASPECT_RATIO_PRESETS) as AspectRatioPreset[]
  const currentResolution = getResolution()
  const resolutionPresets = RESOLUTION_PRESETS[aspectRatioSettings.preset] || RESOLUTION_PRESETS['16:9']

  const handlePresetSelect = (preset: AspectRatioPreset) => {
    setAspectRatioPreset(preset)
    // Reset resolution to 1080p when changing aspect ratio
    setResolutionPreset('1080p')
    if (preset !== 'custom') {
      setIsOpen(false)
    }
  }

  const handleResolutionSelect = (preset: ResolutionPreset) => {
    setResolutionPreset(preset)
  }

  const handleCustomApply = () => {
    setCustomAspectRatio(customWidth, customHeight)
    setIsOpen(false)
  }

  const handleCustomResolutionApply = () => {
    setCustomResolution(customResWidth, customResHeight)
  }

  if (compact) {
    // Compact dropdown version
    return (
      <div className={cn('relative', className)}>
        <button
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs',
            'bg-surface-alt border border-transparent hover:border-border-hover',
            'transition-colors'
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {PRESET_ICONS[aspectRatioSettings.preset]}
          <span>{aspectRatioSettings.preset}</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-lg shadow-xl min-w-[200px] py-1">
              {presetKeys.filter(p => p !== 'custom').map((preset) => {
                const config = ASPECT_RATIO_PRESETS[preset]
                const isActive = aspectRatioSettings.preset === preset

                return (
                  <button
                    key={preset}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-xs text-left',
                      'hover:bg-surface-hover transition-colors',
                      isActive && 'bg-accent/10 text-accent'
                    )}
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {PRESET_ICONS[preset]}
                    <span className="flex-1">{preset}</span>
                    <span className="text-text-muted">{config.description}</span>
                  </button>
                )
              })}

              {showCustomInput && (
                <>
                  <div className="border-t border-border my-1" />
                  <div className="px-3 py-2">
                    <div className="text-[10px] text-text-muted mb-2">Custom</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs bg-background border border-border rounded focus:border-accent focus:outline-none"
                        min={1}
                      />
                      <span className="text-text-muted text-xs">×</span>
                      <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs bg-background border border-border rounded focus:border-accent focus:outline-none"
                        min={1}
                      />
                      <button
                        className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90"
                        onClick={handleCustomApply}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // Full version with preset buttons
  return (
    <div className={cn('space-y-3', className)}>
      <div className="text-[10px] text-text-muted uppercase tracking-wider">Aspect Ratio</div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-1">
        {presetKeys.filter(p => p !== 'custom').map((preset) => {
          const config = ASPECT_RATIO_PRESETS[preset]
          const isActive = aspectRatioSettings.preset === preset

          return (
            <button
              key={preset}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
                isActive
                  ? 'bg-accent text-white'
                  : 'bg-surface-alt text-text-muted hover:bg-surface-hover hover:text-text-primary'
              )}
              onClick={() => handlePresetSelect(preset)}
              title={config.description}
            >
              {PRESET_ICONS[preset]}
              <span>{preset}</span>
            </button>
          )
        })}
      </div>

      {/* Custom aspect ratio input */}
      {showCustomInput && (
        <div className="pt-2 border-t border-border">
          <div className="text-[10px] text-text-muted mb-1">Custom Aspect Ratio</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={customWidth}
              onChange={(e) => setCustomWidth(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs bg-surface-alt border border-transparent rounded focus:border-accent focus:outline-none"
              min={1}
            />
            <span className="text-text-muted text-xs">×</span>
            <input
              type="number"
              value={customHeight}
              onChange={(e) => setCustomHeight(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs bg-surface-alt border border-transparent rounded focus:border-accent focus:outline-none"
              min={1}
            />
            <button
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                aspectRatioSettings.preset === 'custom'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-alt text-text-muted hover:text-text-primary'
              )}
              onClick={handleCustomApply}
            >
              Apply
            </button>
          </div>
          {aspectRatioSettings.preset === 'custom' && (
            <div className="text-[10px] text-text-muted mt-1">
              Ratio: {(customWidth / customHeight).toFixed(2)}:1
            </div>
          )}
        </div>
      )}

      {/* ASPECT-002: Resolution Presets */}
      {showResolution && (
        <div className="pt-2 border-t border-border">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Resolution</div>
          
          {/* Resolution preset buttons */}
          <div className="flex flex-wrap gap-1 mb-2">
            {RESOLUTION_ORDER.filter(r => r !== 'custom').map((preset) => {
              const config = resolutionPresets[preset]
              const isActive = aspectRatioSettings.resolutionPreset === preset
              const memoryMB = estimateMemoryMB(config.width, config.height)
              const isHighMem = memoryMB > 50

              return (
                <button
                  key={preset}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-white'
                      : 'bg-surface-alt text-text-muted hover:bg-surface-hover hover:text-text-primary'
                  )}
                  onClick={() => handleResolutionSelect(preset)}
                  title={`${config.description} (~${memoryMB.toFixed(0)}MB)`}
                >
                  <span>{config.label}</span>
                  {isHighMem && !isActive && (
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Custom resolution input */}
          <div className="text-[10px] text-text-muted mb-1">Custom Resolution</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={customResWidth}
              onChange={(e) => setCustomResWidth(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs bg-surface-alt border border-transparent rounded focus:border-accent focus:outline-none"
              min={1}
              placeholder="Width"
            />
            <span className="text-text-muted text-xs">×</span>
            <input
              type="number"
              value={customResHeight}
              onChange={(e) => setCustomResHeight(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs bg-surface-alt border border-transparent rounded focus:border-accent focus:outline-none"
              min={1}
              placeholder="Height"
            />
            <button
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                aspectRatioSettings.resolutionPreset === 'custom'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-alt text-text-muted hover:text-text-primary'
              )}
              onClick={handleCustomResolutionApply}
            >
              Apply
            </button>
          </div>

          {/* Memory warning for high resolutions */}
          {estimateMemoryMB(currentResolution.width, currentResolution.height) > 50 && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>High resolution may impact performance</span>
            </div>
          )}

          {/* Current resolution display */}
          <div className="mt-2 text-[10px] text-text-muted">
            Export: {currentResolution.width}×{currentResolution.height}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="pt-2 border-t border-border">
        <div className="text-[10px] text-text-muted mb-1">Preview</div>
        <div className="flex justify-center p-2 bg-background rounded">
          <div
            className="bg-accent/20 border border-accent/50 rounded flex flex-col items-center justify-center text-[10px] text-accent gap-0.5"
            style={{
              width: currentPreset.ratio > 1 ? 80 : 80 * currentPreset.ratio,
              height: currentPreset.ratio > 1 ? 80 / currentPreset.ratio : 80,
              maxWidth: '100%',
            }}
          >
            <span>{aspectRatioSettings.preset === 'custom'
              ? `${customWidth}:${customHeight}`
              : aspectRatioSettings.preset}</span>
            <span className="text-[8px] opacity-70">{currentResolution.width}×{currentResolution.height}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
