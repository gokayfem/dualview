/**
 * VID-004: Video Quality Metrics Overlay
 */
import { useProjectStore } from '../../stores/projectStore'
import { Activity } from 'lucide-react'

export function MetricsOverlay() {
  const { showMetrics, metricsSSIM, metricsPSNR, toggleMetrics } = useProjectStore()

  if (!showMetrics) {
    return (
      <button
        onClick={toggleMetrics}
        className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-black/80 px-2 py-1 text-xs text-white flex items-center gap-1 transition-colors"
        title="Show quality metrics (M)"
      >
        <Activity className="w-3 h-3" />
        Metrics
      </button>
    )
  }

  const formatSSIM = (value: number | null) => {
    if (value === null) return '---'
    return value.toFixed(4)
  }

  const formatPSNR = (value: number | null) => {
    if (value === null) return '---'
    if (value === Infinity) return '∞ dB'
    return `${value.toFixed(2)} dB`
  }

  const getSSIMColor = (value: number | null) => {
    if (value === null) return 'text-text-muted'
    if (value >= 0.98) return 'text-success'
    if (value >= 0.9) return 'text-warning'
    return 'text-error'
  }

  const getPSNRColor = (value: number | null) => {
    if (value === null) return 'text-text-muted'
    if (value === Infinity || value >= 40) return 'text-success'
    if (value >= 30) return 'text-warning'
    return 'text-error'
  }

  return (
    <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-sm border border-white/10 p-3 text-white min-w-[140px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Quality Metrics
        </span>
        <button
          onClick={toggleMetrics}
          className="text-text-muted hover:text-white text-xs"
        >
          ×
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-text-muted">SSIM</span>
          <span className={`text-sm font-mono ${getSSIMColor(metricsSSIM)}`}>
            {formatSSIM(metricsSSIM)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[10px] text-text-muted">PSNR</span>
          <span className={`text-sm font-mono ${getPSNRColor(metricsPSNR)}`}>
            {formatPSNR(metricsPSNR)}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/10">
        <div className="text-[9px] text-text-muted">
          SSIM: 1.0 = identical
          <br />
          PSNR: Higher = similar
        </div>
      </div>
    </div>
  )
}
