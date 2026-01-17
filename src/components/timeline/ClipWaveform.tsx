/**
 * TL-006: Clip Waveform Preview
 * Renders a mini waveform visualization inside timeline clips
 */
import { useRef, useEffect } from 'react'

interface ClipWaveformProps {
  peaks: number[]
  color?: string
  className?: string
}

export function ClipWaveform({ peaks, color = 'rgba(255, 255, 255, 0.6)', className = '' }: ClipWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match element size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw waveform
    const barWidth = width / peaks.length
    const centerY = height / 2

    ctx.fillStyle = color

    for (let i = 0; i < peaks.length; i++) {
      const barHeight = peaks[i] * centerY * 0.9
      const x = i * barWidth
      const y = centerY - barHeight

      // Draw bar above and below center
      ctx.fillRect(x, y, Math.max(barWidth - 0.5, 0.5), barHeight * 2)
    }

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
  }, [peaks, color])

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx || !peaks.length) return

      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

      const width = rect.width
      const height = rect.height

      ctx.clearRect(0, 0, width, height)

      const barWidth = width / peaks.length
      const centerY = height / 2

      ctx.fillStyle = color

      for (let i = 0; i < peaks.length; i++) {
        const barHeight = peaks[i] * centerY * 0.9
        const x = i * barWidth
        const y = centerY - barHeight
        ctx.fillRect(x, y, Math.max(barWidth - 0.5, 0.5), barHeight * 2)
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [peaks, color])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  )
}
