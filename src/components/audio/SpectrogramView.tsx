import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { Activity, Waves } from 'lucide-react'

interface SpectrogramViewProps {
  audioUrlA?: string
  audioUrlB?: string
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

export function SpectrogramView({
  audioUrlA,
  audioUrlB,
  currentTime,
  duration,
  onSeek,
}: SpectrogramViewProps) {
  const canvasARef = useRef<HTMLCanvasElement>(null)
  const canvasBRef = useRef<HTMLCanvasElement>(null)
  const [viewMode, setViewMode] = useState<'waveform' | 'spectrogram'>('spectrogram')
  const [spectrogramDataA, setSpectrogramDataA] = useState<Float32Array[] | null>(null)
  const [spectrogramDataB, setSpectrogramDataB] = useState<Float32Array[] | null>(null)
  const [waveformDataA, setWaveformDataA] = useState<Float32Array | null>(null)
  const [waveformDataB, setWaveformDataB] = useState<Float32Array | null>(null)

  // Analyze audio and generate spectrogram data
  const analyzeAudio = async (url: string): Promise<{ spectrogram: Float32Array[], waveform: Float32Array }> => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const audioContext = new AudioContext()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const channelData = audioBuffer.getChannelData(0)

    // Generate waveform data (downsampled)
    const waveformSamples = 1000
    const samplesPerPixel = Math.floor(channelData.length / waveformSamples)
    const waveform = new Float32Array(waveformSamples)
    for (let i = 0; i < waveformSamples; i++) {
      let sum = 0
      for (let j = 0; j < samplesPerPixel; j++) {
        sum += Math.abs(channelData[i * samplesPerPixel + j] || 0)
      }
      waveform[i] = sum / samplesPerPixel
    }

    // Generate spectrogram using FFT
    const fftSize = 2048
    const hopSize = 512
    const numFrames = Math.floor((channelData.length - fftSize) / hopSize)
    const spectrogram: Float32Array[] = []

    // Simple FFT approximation using overlapping windows
    for (let frame = 0; frame < Math.min(numFrames, 500); frame++) {
      const startSample = frame * hopSize
      const frequencies = new Float32Array(fftSize / 2)

      // Apply Hanning window and compute magnitude spectrum
      for (let i = 0; i < fftSize / 2; i++) {
        let real = 0
        let imag = 0

        for (let n = 0; n < fftSize; n++) {
          const sample = channelData[startSample + n] || 0
          const window = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)))
          const angle = (2 * Math.PI * i * n) / fftSize
          real += sample * window * Math.cos(angle)
          imag += sample * window * Math.sin(angle)
        }

        frequencies[i] = Math.sqrt(real * real + imag * imag) / fftSize
      }

      spectrogram.push(frequencies)
    }

    audioContext.close()
    return { spectrogram, waveform }
  }

  useEffect(() => {
    if (audioUrlA) {
      analyzeAudio(audioUrlA).then(({ spectrogram, waveform }) => {
        setSpectrogramDataA(spectrogram)
        setWaveformDataA(waveform)
      }).catch(console.error)
    }
  }, [audioUrlA])

  useEffect(() => {
    if (audioUrlB) {
      analyzeAudio(audioUrlB).then(({ spectrogram, waveform }) => {
        setSpectrogramDataB(spectrogram)
        setWaveformDataB(waveform)
      }).catch(console.error)
    }
  }, [audioUrlB])

  // Draw spectrogram
  const drawSpectrogram = (
    canvas: HTMLCanvasElement | null,
    data: Float32Array[] | null
  ) => {
    if (!canvas || !data || data.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    const frameWidth = width / data.length
    const freqBins = data[0].length

    for (let x = 0; x < data.length; x++) {
      for (let y = 0; y < freqBins; y++) {
        const magnitude = data[x][y]
        const normalized = Math.min(1, magnitude * 50)
        const hue = 240 - normalized * 240 // Blue to red
        const lightness = normalized * 50

        ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`
        ctx.fillRect(
          x * frameWidth,
          height - (y / freqBins) * height,
          frameWidth + 1,
          height / freqBins + 1
        )
      }
    }
  }

  // Draw waveform
  const drawWaveform = (
    canvas: HTMLCanvasElement | null,
    data: Float32Array | null,
    color: string
  ) => {
    if (!canvas || !data) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    const maxVal = Math.max(...data)
    const mid = height / 2

    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * width
      const normalized = data[i] / maxVal
      const y = mid - normalized * mid * 0.9

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    // Mirror for bottom half
    for (let i = data.length - 1; i >= 0; i--) {
      const x = (i / data.length) * width
      const normalized = data[i] / maxVal
      const y = mid + normalized * mid * 0.9
      ctx.lineTo(x, y)
    }

    ctx.closePath()
    ctx.fillStyle = color.replace('1)', '0.3)')
    ctx.fill()
    ctx.stroke()
  }

  useEffect(() => {
    if (viewMode === 'spectrogram') {
      drawSpectrogram(canvasARef.current, spectrogramDataA)
      drawSpectrogram(canvasBRef.current, spectrogramDataB)
    } else {
      drawWaveform(canvasARef.current, waveformDataA, 'rgba(255, 150, 50, 1)')
      drawWaveform(canvasBRef.current, waveformDataB, 'rgba(150, 255, 50, 1)')
    }
  }, [viewMode, spectrogramDataA, spectrogramDataB, waveformDataA, waveformDataB])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    onSeek(progress * duration)
  }

  const playheadPosition = (currentTime / duration) * 100

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">Audio Visualization</span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('waveform')}
            className={cn(
              "px-2 py-1 text-xs rounded flex items-center gap-1",
              viewMode === 'waveform'
                ? "bg-accent text-white"
                : "bg-surface-hover text-text-muted hover:text-text-primary"
            )}
          >
            <Waves className="w-3 h-3" />
            Waveform
          </button>
          <button
            onClick={() => setViewMode('spectrogram')}
            className={cn(
              "px-2 py-1 text-xs rounded flex items-center gap-1",
              viewMode === 'spectrogram'
                ? "bg-accent text-white"
                : "bg-surface-hover text-text-muted hover:text-text-primary"
            )}
          >
            <Activity className="w-3 h-3" />
            Spectrogram
          </button>
        </div>
      </div>

      {/* Track A */}
      <div className="relative">
        <div className="text-xs text-orange-400 mb-1">Track A</div>
        <div className="relative">
          <canvas
            ref={canvasARef}
            width={800}
            height={100}
            className="w-full h-24 rounded cursor-pointer"
            onClick={handleClick}
          />
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none"
            style={{ left: `${playheadPosition}%` }}
          />
        </div>
      </div>

      {/* Track B */}
      <div className="relative">
        <div className="text-xs text-lime-400 mb-1">Track B</div>
        <div className="relative">
          <canvas
            ref={canvasBRef}
            width={800}
            height={100}
            className="w-full h-24 rounded cursor-pointer"
            onClick={handleClick}
          />
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none"
            style={{ left: `${playheadPosition}%` }}
          />
        </div>
      </div>

      {/* Color legend for spectrogram */}
      {viewMode === 'spectrogram' && (
        <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <span>Low</span>
          <div className="w-24 h-3 rounded" style={{
            background: 'linear-gradient(to right, hsl(240, 100%, 5%), hsl(180, 100%, 25%), hsl(60, 100%, 35%), hsl(0, 100%, 50%))'
          }} />
          <span>High</span>
        </div>
      )}
    </div>
  )
}
