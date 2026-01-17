import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * TL-002: Frame-Accurate Snapping Utilities
 */

/** Default frame rate (30fps) */
export const DEFAULT_FRAME_RATE = 30

/** Snap time to nearest frame boundary */
export function snapTimeToFrame(time: number, fps: number = DEFAULT_FRAME_RATE): number {
  const frame = Math.round(time * fps)
  return frame / fps
}

/** Get frame number from time */
export function timeToFrame(time: number, fps: number = DEFAULT_FRAME_RATE): number {
  return Math.floor(time * fps)
}

/** Get time from frame number */
export function frameToTime(frame: number, fps: number = DEFAULT_FRAME_RATE): number {
  return frame / fps
}

/** Get frame duration in seconds */
export function getFrameDuration(fps: number = DEFAULT_FRAME_RATE): number {
  return 1 / fps
}

/** Check if two times are on the same frame */
export function isSameFrame(time1: number, time2: number, fps: number = DEFAULT_FRAME_RATE): boolean {
  return timeToFrame(time1, fps) === timeToFrame(time2, fps)
}

/** Format time as timecode (HH:MM:SS:FF) */
export function formatTimecode(seconds: number, fps: number = DEFAULT_FRAME_RATE): string {
  const totalFrames = Math.floor(seconds * fps)
  const frames = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const secs = totalSeconds % 60
  const mins = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
}
