/**
 * Keyframe Animation System (KEYFRAME-001, KEYFRAME-002)
 * 
 * Provides keyframe-based animation for clip properties like
 * opacity, position, scale, and rotation.
 */

// Easing functions
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier'

export interface BezierCurve {
  x1: number
  y1: number
  x2: number
  y2: number
}

// Keyframe for a single property at a specific time
export interface Keyframe {
  id: string
  time: number // Time in seconds relative to clip start
  value: number
  easing: EasingType
  bezier?: BezierCurve // Custom bezier curve when easing === 'bezier'
}

// Animatable properties
export type AnimatableProperty = 
  | 'opacity'
  | 'positionX'
  | 'positionY'
  | 'scale'
  | 'scaleX'
  | 'scaleY'
  | 'rotation'
  | 'cropTop'
  | 'cropBottom'
  | 'cropLeft'
  | 'cropRight'
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'saturation'

// Property configuration with default value and range
export interface PropertyConfig {
  name: string
  label: string
  defaultValue: number
  min: number
  max: number
  step: number
  unit: string
}

export const PROPERTY_CONFIGS: Record<AnimatableProperty, PropertyConfig> = {
  opacity: { name: 'opacity', label: 'Opacity', defaultValue: 1, min: 0, max: 1, step: 0.01, unit: '' },
  positionX: { name: 'positionX', label: 'Position X', defaultValue: 0, min: -1000, max: 1000, step: 1, unit: 'px' },
  positionY: { name: 'positionY', label: 'Position Y', defaultValue: 0, min: -1000, max: 1000, step: 1, unit: 'px' },
  scale: { name: 'scale', label: 'Scale', defaultValue: 1, min: 0.1, max: 5, step: 0.01, unit: 'x' },
  scaleX: { name: 'scaleX', label: 'Scale X', defaultValue: 1, min: 0.1, max: 5, step: 0.01, unit: 'x' },
  scaleY: { name: 'scaleY', label: 'Scale Y', defaultValue: 1, min: 0.1, max: 5, step: 0.01, unit: 'x' },
  rotation: { name: 'rotation', label: 'Rotation', defaultValue: 0, min: -360, max: 360, step: 1, unit: '°' },
  cropTop: { name: 'cropTop', label: 'Crop Top', defaultValue: 0, min: 0, max: 100, step: 1, unit: '%' },
  cropBottom: { name: 'cropBottom', label: 'Crop Bottom', defaultValue: 0, min: 0, max: 100, step: 1, unit: '%' },
  cropLeft: { name: 'cropLeft', label: 'Crop Left', defaultValue: 0, min: 0, max: 100, step: 1, unit: '%' },
  cropRight: { name: 'cropRight', label: 'Crop Right', defaultValue: 0, min: 0, max: 100, step: 1, unit: '%' },
  blur: { name: 'blur', label: 'Blur', defaultValue: 0, min: 0, max: 50, step: 0.5, unit: 'px' },
  brightness: { name: 'brightness', label: 'Brightness', defaultValue: 1, min: 0, max: 3, step: 0.01, unit: '' },
  contrast: { name: 'contrast', label: 'Contrast', defaultValue: 1, min: 0, max: 3, step: 0.01, unit: '' },
  saturation: { name: 'saturation', label: 'Saturation', defaultValue: 1, min: 0, max: 3, step: 0.01, unit: '' },
}

// Keyframe track for a single property
export interface KeyframeTrack {
  property: AnimatableProperty
  keyframes: Keyframe[]
}

// All keyframes for a clip
export interface ClipKeyframes {
  clipId: string
  tracks: KeyframeTrack[]
}

// Generate unique ID
export function generateKeyframeId(): string {
  return `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Easing functions implementation
function easeLinear(t: number): number {
  return t
}

function easeIn(t: number): number {
  return t * t
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// Cubic bezier implementation
function cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
  // Newton-Raphson iteration to find t for given x
  const epsilon = 1e-6
  let x = t

  for (let i = 0; i < 8; i++) {
    const currentX = bezierX(x, x1, x2) - t
    if (Math.abs(currentX) < epsilon) break
    const dx = bezierDX(x, x1, x2)
    if (Math.abs(dx) < epsilon) break
    x -= currentX / dx
  }

  return bezierY(x, y1, y2)
}

function bezierX(t: number, x1: number, x2: number): number {
  return 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
}

function bezierY(t: number, y1: number, y2: number): number {
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
}

function bezierDX(t: number, x1: number, x2: number): number {
  return 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2)
}

// Get easing function
function getEasingFunction(easing: EasingType, bezier?: BezierCurve): (t: number) => number {
  switch (easing) {
    case 'linear': return easeLinear
    case 'ease-in': return easeIn
    case 'ease-out': return easeOut
    case 'ease-in-out': return easeInOut
    case 'bezier':
      if (bezier) {
        return (t) => cubicBezier(t, bezier.x1, bezier.y1, bezier.x2, bezier.y2)
      }
      return easeLinear
    default: return easeLinear
  }
}

/**
 * Interpolate between two keyframes at a given time
 */
export function interpolateKeyframes(
  keyframes: Keyframe[],
  time: number,
  defaultValue: number
): number {
  if (keyframes.length === 0) {
    return defaultValue
  }

  // Sort keyframes by time
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)

  // Before first keyframe
  if (time <= sorted[0].time) {
    return sorted[0].value
  }

  // After last keyframe
  if (time >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value
  }

  // Find surrounding keyframes
  let prevKf = sorted[0]
  let nextKf = sorted[1]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].time >= time) {
      prevKf = sorted[i - 1]
      nextKf = sorted[i]
      break
    }
  }

  // Calculate interpolation factor
  const duration = nextKf.time - prevKf.time
  if (duration === 0) return prevKf.value

  const t = (time - prevKf.time) / duration

  // Apply easing
  const easingFn = getEasingFunction(prevKf.easing, prevKf.bezier)
  const easedT = easingFn(t)

  // Linear interpolation with eased t
  return prevKf.value + (nextKf.value - prevKf.value) * easedT
}

/**
 * Get all animated property values at a given time
 */
export function getAnimatedValues(
  clipKeyframes: ClipKeyframes | undefined,
  time: number
): Record<AnimatableProperty, number> {
  const values: Record<AnimatableProperty, number> = {} as Record<AnimatableProperty, number>

  // Initialize with defaults
  for (const [prop, config] of Object.entries(PROPERTY_CONFIGS)) {
    values[prop as AnimatableProperty] = config.defaultValue
  }

  if (!clipKeyframes) return values

  // Override with animated values
  for (const track of clipKeyframes.tracks) {
    values[track.property] = interpolateKeyframes(
      track.keyframes,
      time,
      PROPERTY_CONFIGS[track.property].defaultValue
    )
  }

  return values
}

/**
 * Add a keyframe to a track
 */
export function addKeyframe(
  clipKeyframes: ClipKeyframes,
  property: AnimatableProperty,
  time: number,
  value: number,
  easing: EasingType = 'ease-in-out'
): ClipKeyframes {
  const newKeyframe: Keyframe = {
    id: generateKeyframeId(),
    time,
    value,
    easing,
  }

  const trackIndex = clipKeyframes.tracks.findIndex(t => t.property === property)

  if (trackIndex === -1) {
    // Create new track
    return {
      ...clipKeyframes,
      tracks: [
        ...clipKeyframes.tracks,
        { property, keyframes: [newKeyframe] },
      ],
    }
  }

  // Add to existing track
  const track = clipKeyframes.tracks[trackIndex]
  const existingIndex = track.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01)

  let newKeyframes: Keyframe[]
  if (existingIndex !== -1) {
    // Update existing keyframe at this time
    newKeyframes = track.keyframes.map((kf, i) =>
      i === existingIndex ? newKeyframe : kf
    )
  } else {
    // Add new keyframe
    newKeyframes = [...track.keyframes, newKeyframe]
  }

  return {
    ...clipKeyframes,
    tracks: clipKeyframes.tracks.map((t, i) =>
      i === trackIndex ? { ...t, keyframes: newKeyframes } : t
    ),
  }
}

/**
 * Remove a keyframe
 */
export function removeKeyframe(
  clipKeyframes: ClipKeyframes,
  keyframeId: string
): ClipKeyframes {
  return {
    ...clipKeyframes,
    tracks: clipKeyframes.tracks.map(track => ({
      ...track,
      keyframes: track.keyframes.filter(kf => kf.id !== keyframeId),
    })).filter(track => track.keyframes.length > 0),
  }
}

/**
 * Update a keyframe
 */
export function updateKeyframe(
  clipKeyframes: ClipKeyframes,
  keyframeId: string,
  updates: Partial<Omit<Keyframe, 'id'>>
): ClipKeyframes {
  return {
    ...clipKeyframes,
    tracks: clipKeyframes.tracks.map(track => ({
      ...track,
      keyframes: track.keyframes.map(kf =>
        kf.id === keyframeId ? { ...kf, ...updates } : kf
      ),
    })),
  }
}

/**
 * Copy keyframes from one time to another
 */
export function copyKeyframes(
  clipKeyframes: ClipKeyframes,
  fromTime: number,
  toTime: number,
  tolerance: number = 0.05
): ClipKeyframes {
  let result = clipKeyframes

  for (const track of clipKeyframes.tracks) {
    const sourceKf = track.keyframes.find(kf => Math.abs(kf.time - fromTime) < tolerance)
    if (sourceKf) {
      result = addKeyframe(result, track.property, toTime, sourceKf.value, sourceKf.easing)
    }
  }

  return result
}

/**
 * Get keyframes at a specific time
 */
export function getKeyframesAtTime(
  clipKeyframes: ClipKeyframes,
  time: number,
  tolerance: number = 0.05
): Keyframe[] {
  const result: Keyframe[] = []

  for (const track of clipKeyframes.tracks) {
    const kf = track.keyframes.find(k => Math.abs(k.time - time) < tolerance)
    if (kf) result.push(kf)
  }

  return result
}

/**
 * Check if a property has keyframes
 */
export function hasKeyframes(
  clipKeyframes: ClipKeyframes | undefined,
  property: AnimatableProperty
): boolean {
  if (!clipKeyframes) return false
  const track = clipKeyframes.tracks.find(t => t.property === property)
  return track ? track.keyframes.length > 0 : false
}

/**
 * Reset a property to its default value (remove all keyframes)
 */
export function resetProperty(
  clipKeyframes: ClipKeyframes,
  property: AnimatableProperty
): ClipKeyframes {
  return {
    ...clipKeyframes,
    tracks: clipKeyframes.tracks.filter(t => t.property !== property),
  }
}

/**
 * Create an empty ClipKeyframes object
 */
export function createClipKeyframes(clipId: string): ClipKeyframes {
  return {
    clipId,
    tracks: [],
  }
}

// Preset easing curves
export const EASING_PRESETS: Record<string, { label: string; easing: EasingType; bezier?: BezierCurve }> = {
  linear: { label: 'Linear', easing: 'linear' },
  easeIn: { label: 'Ease In', easing: 'ease-in' },
  easeOut: { label: 'Ease Out', easing: 'ease-out' },
  easeInOut: { label: 'Ease In/Out', easing: 'ease-in-out' },
  easeInQuad: { label: 'Quad In', easing: 'bezier', bezier: { x1: 0.55, y1: 0.085, x2: 0.68, y2: 0.53 } },
  easeOutQuad: { label: 'Quad Out', easing: 'bezier', bezier: { x1: 0.25, y1: 0.46, x2: 0.45, y2: 0.94 } },
  easeInCubic: { label: 'Cubic In', easing: 'bezier', bezier: { x1: 0.55, y1: 0.055, x2: 0.675, y2: 0.19 } },
  easeOutCubic: { label: 'Cubic Out', easing: 'bezier', bezier: { x1: 0.215, y1: 0.61, x2: 0.355, y2: 1 } },
  easeInExpo: { label: 'Expo In', easing: 'bezier', bezier: { x1: 0.95, y1: 0.05, x2: 0.795, y2: 0.035 } },
  easeOutExpo: { label: 'Expo Out', easing: 'bezier', bezier: { x1: 0.19, y1: 1, x2: 0.22, y2: 1 } },
  easeInBack: { label: 'Back In', easing: 'bezier', bezier: { x1: 0.6, y1: -0.28, x2: 0.735, y2: 0.045 } },
  easeOutBack: { label: 'Back Out', easing: 'bezier', bezier: { x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275 } },
}
