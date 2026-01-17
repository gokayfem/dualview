/**
 * ClipFilmstrip Component (FILMSTRIP-002)
 * 
 * Displays a filmstrip of video frames inside a timeline clip.
 * Adapts frame density based on clip width.
 */

import { memo, useMemo } from 'react'
import { cn } from '../../lib/utils'
import type { FilmstripData } from '../../lib/filmstripExtractor'

interface ClipFilmstripProps {
  filmstrip: FilmstripData
  clipWidth: number
  inPoint: number
  outPoint: number
  className?: string
}

export const ClipFilmstrip = memo(function ClipFilmstrip({
  filmstrip,
  clipWidth,
  inPoint,
  outPoint,
  className,
}: ClipFilmstripProps) {
  // Calculate which frames to show based on clip width and in/out points
  const visibleFrames = useMemo(() => {
    if (!filmstrip.frames.length) return []

    const frameWidth = 40 // Target frame width in pixels
    const maxVisibleFrames = Math.max(1, Math.floor(clipWidth / frameWidth))

    // Find frames within the in/out range
    const framesInRange = filmstrip.frames.filter(
      frame => frame.time >= inPoint && frame.time <= outPoint
    )

    if (framesInRange.length <= maxVisibleFrames) {
      return framesInRange
    }

    // Subsample frames to fit the available space
    const step = Math.ceil(framesInRange.length / maxVisibleFrames)
    const sampledFrames: typeof framesInRange = []
    for (let i = 0; i < framesInRange.length; i += step) {
      sampledFrames.push(framesInRange[i])
    }

    return sampledFrames
  }, [filmstrip.frames, clipWidth, inPoint, outPoint])

  if (visibleFrames.length === 0) {
    return null
  }

  const frameWidth = clipWidth / visibleFrames.length

  return (
    <div className={cn('absolute inset-0 flex overflow-hidden', className)}>
      {visibleFrames.map((frame, index) => (
        <div
          key={`${frame.time}-${index}`}
          className="flex-shrink-0 h-full bg-cover bg-center opacity-60"
          style={{
            width: `${frameWidth}px`,
            backgroundImage: `url(${frame.dataUrl})`,
          }}
        />
      ))}
    </div>
  )
})

/**
 * Placeholder shown while filmstrip is loading
 */
export function FilmstripLoading({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center', className)}>
      <div className="flex gap-1">
        <div className="w-1.5 h-3 bg-white/20 animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-3 bg-white/20 animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-3 bg-white/20 animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
