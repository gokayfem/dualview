/**
 * AUD-001: Audio Waveform Display
 * AUD-002: A/B Audio Switch
 * AUD-003: Audio Level Matching
 * Redesigned with elegant, professional UI
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { cn, formatTime } from '../../lib/utils'
import { Music, Volume2, VolumeX, Play, Pause, SkipBack, Wand2 } from 'lucide-react'

interface WaveformData {
  peaks: number[]
  duration: number
  rms: number
}

type ActiveAudio = 'both' | 'a' | 'b'

// Custom volume slider component
function VolumeSlider({
  value,
  onChange,
  color,
  muted
}: {
  value: number
  onChange: (v: number) => void
  color: 'accent' | 'secondary'
  muted?: boolean
}) {
  const percentage = Math.min(100, Math.max(0, (value / 2) * 100))
  const colorClass = color === 'accent' ? 'bg-accent' : 'bg-secondary'
  const trackColorClass = color === 'accent' ? 'bg-accent/20' : 'bg-secondary/20'

  return (
    <div className="relative w-20 h-6 flex items-center group">
      <div className={cn("absolute inset-y-2 left-0 right-0 rounded-full", trackColorClass)} />
      <div
        className={cn(
          "absolute inset-y-2 left-0 rounded-full transition-all",
          muted ? 'bg-text-muted' : colorClass
        )}
        style={{ width: `${percentage}%` }}
      />
      <input
        type="range"
        min="0"
        max="2"
        step="0.05"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
      {/* Thumb indicator */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background transition-all",
          muted ? 'bg-text-muted' : colorClass,
          "group-hover:scale-110"
        )}
        style={{ left: `calc(${percentage}% - 6px)` }}
      />
    </div>
  )
}

export function AudioWaveform() {
  const canvasARef = useRef<HTMLCanvasElement>(null)
  const canvasBRef = useRef<HTMLCanvasElement>(null)
  const audioARef = useRef<HTMLAudioElement>(null)
  const audioBRef = useRef<HTMLAudioElement>(null)

  const [waveformA, setWaveformA] = useState<WaveformData | null>(null)
  const [waveformB, setWaveformB] = useState<WaveformData | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeAudio, setActiveAudio] = useState<ActiveAudio>('both')
  const [volumeA, setVolumeA] = useState(1)
  const [volumeB, setVolumeB] = useState(1)
  const [autoLevel, setAutoLevel] = useState(false)

  const { currentTime, isPlaying, seek, togglePlay, tracks, playbackSpeed, loopRegion } = useTimelineStore()
  const { getFile } = useMediaStore()

  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const clipA = trackA?.clips[0]
  const clipB = trackB?.clips[0]
  const mediaA = clipA ? getFile(clipA.mediaId) : null
  const mediaB = clipB ? getFile(clipB.mediaId) : null

  const maxDuration = Math.max(waveformA?.duration || 0, waveformB?.duration || 0)

  // Extract waveform data from audio file
  const extractWaveform = useCallback(async (url: string): Promise<WaveformData | null> => {
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const channelData = audioBuffer.getChannelData(0)
      const samples = 200
      const blockSize = Math.floor(channelData.length / samples)
      const peaks: number[] = []

      let sumSquares = 0
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i]
      }
      const rms = Math.sqrt(sumSquares / channelData.length)

      for (let i = 0; i < samples; i++) {
        const start = i * blockSize
        let max = 0
        for (let j = 0; j < blockSize; j++) {
          const value = Math.abs(channelData[start + j] || 0)
          if (value > max) max = value
        }
        peaks.push(max)
      }

      audioContext.close()
      return { peaks, duration: audioBuffer.duration, rms }
    } catch (error) {
      console.error('Failed to extract waveform:', error)
      return null
    }
  }, [])

  // Analyze audio files
  useEffect(() => {
    const analyzeAudio = async () => {
      setIsAnalyzing(true)
      if (mediaA?.type === 'audio') {
        const data = await extractWaveform(mediaA.url)
        setWaveformA(data)
      } else {
        setWaveformA(null)
      }
      if (mediaB?.type === 'audio') {
        const data = await extractWaveform(mediaB.url)
        setWaveformB(data)
      } else {
        setWaveformB(null)
      }
      setIsAnalyzing(false)
    }
    analyzeAudio()
  }, [mediaA, mediaB, extractWaveform])

  // Draw waveform on canvas
  const drawWaveform = useCallback((
    canvas: HTMLCanvasElement,
    data: WaveformData | null,
    color: string,
    bgColor: string,
    playheadTime: number,
    isActive: boolean
  ) => {
    const ctx = canvas.getContext('2d')
    if (!ctx || !data) return

    const { width, height } = canvas
    const { peaks, duration: audioDuration } = data

    // Clear with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, bgColor)
    gradient.addColorStop(0.5, '#0d0d0d')
    gradient.addColorStop(1, bgColor)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const barWidth = Math.max(2, width / peaks.length)
    const gap = 1
    const halfHeight = height / 2
    const playedRatio = playheadTime / audioDuration

    // Draw waveform bars
    for (let i = 0; i < peaks.length; i++) {
      const barHeight = peaks[i] * halfHeight * 0.85
      const x = i * barWidth
      const ratio = i / peaks.length

      // Color based on played position
      const isPlayed = ratio <= playedRatio
      ctx.fillStyle = isPlayed
        ? color
        : isActive ? `${color}40` : `${color}20`

      // Draw mirrored bars (top and bottom)
      const barActualWidth = barWidth - gap
      ctx.fillRect(x, halfHeight - barHeight, barActualWidth, barHeight)
      ctx.fillRect(x, halfHeight, barActualWidth, barHeight)
    }

    // Draw playhead
    if (audioDuration > 0 && isActive) {
      const playheadX = playedRatio * width
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(playheadX - 1, 0, 2, height)

      // Glow effect
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 10
      ctx.fillRect(playheadX - 1, 0, 2, height)
      ctx.shadowBlur = 0
    }
  }, [])

  // Update waveform displays
  useEffect(() => {
    const canvasA = canvasARef.current
    const canvasB = canvasBRef.current

    if (canvasA && waveformA) {
      drawWaveform(canvasA, waveformA, '#ff5722', '#1a0f0a', currentTime, activeAudio !== 'b')
    }
    if (canvasB && waveformB) {
      drawWaveform(canvasB, waveformB, '#cddc39', '#0f1a0a', currentTime, activeAudio !== 'a')
    }
  }, [waveformA, waveformB, currentTime, drawWaveform, activeAudio])

  // Resize canvases
  useEffect(() => {
    const resizeCanvas = (canvas: HTMLCanvasElement) => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
      }
    }

    const handleResize = () => {
      if (canvasARef.current) resizeCanvas(canvasARef.current)
      if (canvasBRef.current) resizeCanvas(canvasBRef.current)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-level matching
  useEffect(() => {
    if (!autoLevel || !waveformA || !waveformB) return
    if (waveformA.rms > 0 && waveformB.rms > 0) {
      const ratio = waveformA.rms / waveformB.rms
      setVolumeB(Math.min(2, Math.max(0.1, ratio)))
    }
  }, [autoLevel, waveformA, waveformB])

  // Handle play/pause state
  useEffect(() => {
    const audioA = audioARef.current
    const audioB = audioBRef.current

    if (audioA) {
      audioA.playbackRate = playbackSpeed
      if (isPlaying && activeAudio !== 'b') {
        audioA.play().catch(() => {})
      } else {
        audioA.pause()
      }
    }
    if (audioB) {
      audioB.playbackRate = playbackSpeed
      if (isPlaying && activeAudio !== 'a') {
        audioB.play().catch(() => {})
      } else {
        audioB.pause()
      }
    }
  }, [isPlaying, playbackSpeed, activeAudio])

  // Handle volume changes
  useEffect(() => {
    const audioA = audioARef.current
    const audioB = audioBRef.current

    if (audioA) {
      audioA.volume = activeAudio === 'b' ? 0 : volumeA
    }
    if (audioB) {
      audioB.volume = activeAudio === 'a' ? 0 : volumeB
    }
  }, [activeAudio, volumeA, volumeB])

  // Sync audio position when seeking (not during playback)
  const lastSeekTime = useRef(currentTime)
  useEffect(() => {
    const audioA = audioARef.current
    const audioB = audioBRef.current

    // Only sync if the time difference is significant (user seeked)
    const timeDiff = Math.abs(currentTime - lastSeekTime.current)
    if (timeDiff > 0.5) {
      if (audioA) audioA.currentTime = currentTime
      if (audioB) audioB.currentTime = currentTime
    }
    lastSeekTime.current = currentTime
  }, [currentTime])

  // Update timeline from audio
  useEffect(() => {
    const audioA = audioARef.current
    if (!audioA || !isPlaying) return

    const handleTimeUpdate = () => {
      if (loopRegion && audioA.currentTime >= loopRegion.outPoint) {
        audioA.currentTime = loopRegion.inPoint
        if (audioBRef.current) audioBRef.current.currentTime = loopRegion.inPoint
        seek(loopRegion.inPoint)
        return
      }
      seek(audioA.currentTime)
    }

    audioA.addEventListener('timeupdate', handleTimeUpdate)
    return () => audioA.removeEventListener('timeupdate', handleTimeUpdate)
  }, [isPlaying, loopRegion, seek])

  // Handle click to seek
  const handleCanvasClick = useCallback((
    e: React.MouseEvent<HTMLCanvasElement>,
    data: WaveformData | null
  ) => {
    if (!data) return
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / canvas.width
    seek(ratio * data.duration)
  }, [seek])

  const hasAudio = mediaA?.type === 'audio' || mediaB?.type === 'audio'

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
        case 'a': setActiveAudio('a'); break
        case 'b': setActiveAudio('b'); break
        case 's': setActiveAudio('both'); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Top Control Bar */}
      <div className="h-14 bg-surface border-b border-border flex items-center justify-between px-4">
        {/* Left: Output selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium">OUTPUT</span>
          <div className="flex items-center bg-background border border-border">
            {(['a', 'both', 'b'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveAudio(mode)}
                className={cn(
                  'px-4 py-1.5 text-xs font-medium transition-all relative',
                  activeAudio === mode
                    ? mode === 'a'
                      ? 'bg-accent text-white'
                      : mode === 'b'
                        ? 'bg-secondary text-black'
                        : 'bg-text-primary text-background'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {mode === 'both' ? 'A+B' : mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Transport */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => seek(0)}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Reset to start"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className={cn(
              "w-10 h-10 flex items-center justify-center transition-all",
              isPlaying
                ? "bg-accent text-white"
                : "bg-surface-hover text-text-primary hover:bg-accent hover:text-white"
            )}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <div className="ml-3 text-sm font-mono text-text-secondary tabular-nums">
            {formatTime(currentTime)} <span className="text-text-muted">/</span> {formatTime(maxDuration)}
          </div>
        </div>

        {/* Right: Volume controls */}
        <div className="flex items-center gap-6">
          {/* Volume A */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVolumeA(volumeA > 0 ? 0 : 1)}
              className={cn(
                "p-1 transition-colors",
                activeAudio === 'b' ? 'text-text-muted' : 'text-accent hover:text-accent'
              )}
            >
              {volumeA === 0 || activeAudio === 'b' ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-[10px] font-bold text-accent w-3">A</span>
            <VolumeSlider
              value={volumeA}
              onChange={setVolumeA}
              color="accent"
              muted={activeAudio === 'b'}
            />
            <span className="text-[10px] text-text-muted w-8 tabular-nums">{Math.round(volumeA * 100)}%</span>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Volume B */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVolumeB(volumeB > 0 ? 0 : 1)}
              className={cn(
                "p-1 transition-colors",
                activeAudio === 'a' ? 'text-text-muted' : 'text-secondary hover:text-secondary'
              )}
            >
              {volumeB === 0 || activeAudio === 'a' ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-[10px] font-bold text-secondary w-3">B</span>
            <VolumeSlider
              value={volumeB}
              onChange={(v) => { setVolumeB(v); setAutoLevel(false) }}
              color="secondary"
              muted={activeAudio === 'a'}
            />
            <span className="text-[10px] text-text-muted w-8 tabular-nums">{Math.round(volumeB * 100)}%</span>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Auto-level */}
          <button
            onClick={() => setAutoLevel(!autoLevel)}
            disabled={!waveformA || !waveformB}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all',
              autoLevel
                ? 'bg-accent text-white'
                : 'bg-surface-hover text-text-muted hover:text-text-primary',
              (!waveformA || !waveformB) && 'opacity-40 cursor-not-allowed'
            )}
            title="Auto-match audio levels"
          >
            <Wand2 className="w-3 h-3" />
            Auto Level
          </button>
        </div>
      </div>

      {/* Waveforms */}
      <div className="flex-1 flex flex-col">
        {/* Audio A */}
        <div className={cn(
          'flex-1 relative transition-opacity duration-200',
          activeAudio === 'b' && 'opacity-50'
        )}>
          {/* Label */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <span className="w-7 h-7 bg-accent flex items-center justify-center text-white text-sm font-bold">A</span>
            {waveformA && mediaA && (
              <div className="bg-black/70 backdrop-blur-sm px-2 py-1 flex items-center gap-3">
                <span className="text-xs text-text-primary font-medium">{mediaA.name}</span>
                <span className="text-[10px] text-text-muted">{formatTime(waveformA.duration)}</span>
              </div>
            )}
          </div>

          {/* Analyzing state */}
          {isAnalyzing && !waveformA && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-text-muted">Analyzing audio...</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isAnalyzing && !waveformA && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface border-b border-border">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-accent/10 flex items-center justify-center">
                  <Music className="w-8 h-8 text-accent/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-text-secondary">Audio A</p>
                  <p className="text-xs text-text-muted mt-1">Drop audio file or add from library</p>
                </div>
              </div>
            </div>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasARef}
            className={cn('w-full h-full cursor-pointer', !waveformA && 'hidden')}
            onClick={(e) => handleCanvasClick(e, waveformA)}
          />
          {mediaA?.type === 'audio' && <audio ref={audioARef} src={mediaA.url} preload="auto" className="hidden" />}
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Audio B */}
        <div className={cn(
          'flex-1 relative transition-opacity duration-200',
          activeAudio === 'a' && 'opacity-50'
        )}>
          {/* Label */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <span className="w-7 h-7 bg-secondary flex items-center justify-center text-black text-sm font-bold">B</span>
            {waveformB && mediaB && (
              <div className="bg-black/70 backdrop-blur-sm px-2 py-1 flex items-center gap-3">
                <span className="text-xs text-text-primary font-medium">{mediaB.name}</span>
                <span className="text-[10px] text-text-muted">{formatTime(waveformB.duration)}</span>
              </div>
            )}
          </div>

          {/* Analyzing state */}
          {isAnalyzing && !waveformB && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-text-muted">Analyzing audio...</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isAnalyzing && !waveformB && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-secondary/10 flex items-center justify-center">
                  <Music className="w-8 h-8 text-secondary/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-text-secondary">Audio B</p>
                  <p className="text-xs text-text-muted mt-1">Drop audio file or add from library</p>
                </div>
              </div>
            </div>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasBRef}
            className={cn('w-full h-full cursor-pointer', !waveformB && 'hidden')}
            onClick={(e) => handleCanvasClick(e, waveformB)}
          />
          {mediaB?.type === 'audio' && <audio ref={audioBRef} src={mediaB.url} preload="auto" className="hidden" />}
        </div>
      </div>

      {/* Bottom keyboard hints */}
      {hasAudio && (
        <div className="h-8 bg-surface border-t border-border flex items-center justify-center gap-6 text-[10px] text-text-muted">
          <span><kbd className="px-1 py-0.5 bg-background text-accent font-mono mx-1">A</kbd> Solo A</span>
          <span><kbd className="px-1 py-0.5 bg-background text-secondary font-mono mx-1">B</kbd> Solo B</span>
          <span><kbd className="px-1 py-0.5 bg-background text-text-primary font-mono mx-1">S</kbd> Both</span>
          <span className="text-border">|</span>
          <span><kbd className="px-1 py-0.5 bg-background text-text-primary font-mono mx-1">Space</kbd> Play/Pause</span>
          <span><kbd className="px-1 py-0.5 bg-background text-text-primary font-mono mx-1">←</kbd><kbd className="px-1 py-0.5 bg-background text-text-primary font-mono mx-1">→</kbd> Seek</span>
        </div>
      )}
    </div>
  )
}
