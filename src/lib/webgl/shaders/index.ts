/**
 * Shader index - exports all transition shaders
 */

import type { TransitionEngine } from '../../../types'
import type { TransitionShader } from './common'

// Import all shader collections
import { DISSOLVE_SHADERS, DISSOLVE_VARIANTS } from './dissolve'
import { WIPE_SHADERS, WIPE_VARIANTS } from './wipe'
import { ZOOM_SHADERS, ZOOM_VARIANTS } from './zoom'
import { BLUR_SHADERS, BLUR_VARIANTS } from './blur'
import { ROTATE_SHADERS, ROTATE_VARIANTS } from './rotate'
import { LIGHT_SHADERS, LIGHT_VARIANTS } from './light'
import { PRISM_SHADERS, PRISM_VARIANTS } from './prism'
import { GLITCH_SHADERS, GLITCH_VARIANTS } from './glitch'
import { MORPH_SHADERS, MORPH_VARIANTS } from './morph'
import { PIXELATE_SHADERS, PIXELATE_VARIANTS } from './pixelate'
import { REFRACTION_SHADERS, REFRACTION_VARIANTS } from './refraction'
import { SHUTTER_SHADERS, SHUTTER_VARIANTS } from './shutter'
import { OTHER_SHADERS, OTHER_VARIANTS } from './other'

// Re-export common utilities
export { SHADER_COMMON, type TransitionShader } from './common'

// Map engine names to shader collections
const SHADER_COLLECTIONS: Record<TransitionEngine, Record<string, TransitionShader>> = {
  dissolve: DISSOLVE_SHADERS,
  wipe: WIPE_SHADERS,
  zoom: ZOOM_SHADERS,
  blur: BLUR_SHADERS,
  rotate: ROTATE_SHADERS,
  light: LIGHT_SHADERS,
  prism: PRISM_SHADERS,
  glitch: GLITCH_SHADERS,
  morph: MORPH_SHADERS,
  pixelate: PIXELATE_SHADERS,
  refraction: REFRACTION_SHADERS,
  shutter: SHUTTER_SHADERS,
  other: OTHER_SHADERS,
  crossfade: { crossfade: OTHER_SHADERS.crossfade }
}

// Map engine names to variant lists
const VARIANT_LISTS: Record<TransitionEngine, string[]> = {
  dissolve: DISSOLVE_VARIANTS,
  wipe: WIPE_VARIANTS,
  zoom: ZOOM_VARIANTS,
  blur: BLUR_VARIANTS,
  rotate: ROTATE_VARIANTS,
  light: LIGHT_VARIANTS,
  prism: PRISM_VARIANTS,
  glitch: GLITCH_VARIANTS,
  morph: MORPH_VARIANTS,
  pixelate: PIXELATE_VARIANTS,
  refraction: REFRACTION_VARIANTS,
  shutter: SHUTTER_VARIANTS,
  other: OTHER_VARIANTS,
  crossfade: ['crossfade']
}

/**
 * Get a specific shader by engine and variant name
 */
export function getShader(engine: TransitionEngine, variant: string): TransitionShader | undefined {
  const collection = SHADER_COLLECTIONS[engine]
  if (!collection) return undefined
  return collection[variant]
}

/**
 * Get all variant names for an engine
 */
export function getAllVariants(engine: TransitionEngine): string[] {
  return VARIANT_LISTS[engine] || []
}

/**
 * Get all shaders for an engine
 */
export function getAllShaders(engine: TransitionEngine): TransitionShader[] {
  const collection = SHADER_COLLECTIONS[engine]
  if (!collection) return []
  return Object.values(collection)
}

/**
 * Get total shader count
 */
export function getTotalShaderCount(): number {
  return Object.values(VARIANT_LISTS).reduce((sum, variants) => sum + variants.length, 0)
}

/**
 * Engine info with display label and icon
 */
export interface EngineInfo {
  id: TransitionEngine
  label: string
  icon: string
  description: string
  variants: string[]
}

/**
 * Get all engine info for UI
 */
export function getAllEngines(): EngineInfo[] {
  return [
    {
      id: 'crossfade',
      label: 'Crossfade',
      icon: '○',
      description: 'Simple blend transition',
      variants: VARIANT_LISTS.crossfade
    },
    {
      id: 'dissolve',
      label: 'Dissolve',
      icon: '◌',
      description: 'Noise-based dissolve effects',
      variants: VARIANT_LISTS.dissolve
    },
    {
      id: 'wipe',
      label: 'Wipe',
      icon: '▶',
      description: 'Directional wipe transitions',
      variants: VARIANT_LISTS.wipe
    },
    {
      id: 'zoom',
      label: 'Zoom',
      icon: '⊕',
      description: 'Zoom and scale effects',
      variants: VARIANT_LISTS.zoom
    },
    {
      id: 'blur',
      label: 'Blur',
      icon: '◎',
      description: 'Blur-based transitions',
      variants: VARIANT_LISTS.blur
    },
    {
      id: 'rotate',
      label: 'Rotate',
      icon: '↻',
      description: 'Rotation and flip effects',
      variants: VARIANT_LISTS.rotate
    },
    {
      id: 'light',
      label: 'Light',
      icon: '☀',
      description: 'Light leak and glow effects',
      variants: VARIANT_LISTS.light
    },
    {
      id: 'prism',
      label: 'Prism',
      icon: '◇',
      description: 'Chromatic and rainbow effects',
      variants: VARIANT_LISTS.prism
    },
    {
      id: 'glitch',
      label: 'Glitch',
      icon: '▪',
      description: 'Digital glitch effects',
      variants: VARIANT_LISTS.glitch
    },
    {
      id: 'morph',
      label: 'Morph',
      icon: '≋',
      description: 'Shape morphing transitions',
      variants: VARIANT_LISTS.morph
    },
    {
      id: 'pixelate',
      label: 'Pixelate',
      icon: '▦',
      description: 'Pixelation and retro effects',
      variants: VARIANT_LISTS.pixelate
    },
    {
      id: 'refraction',
      label: 'Refraction',
      icon: '◈',
      description: 'Glass and lens distortion',
      variants: VARIANT_LISTS.refraction
    },
    {
      id: 'shutter',
      label: 'Shutter',
      icon: '▤',
      description: 'Motion and trail effects',
      variants: VARIANT_LISTS.shutter
    },
    {
      id: 'other',
      label: 'Stylized',
      icon: '✦',
      description: 'Artistic and unique effects',
      variants: VARIANT_LISTS.other
    }
  ]
}

// Re-export individual collections for direct access
export {
  DISSOLVE_SHADERS,
  WIPE_SHADERS,
  ZOOM_SHADERS,
  BLUR_SHADERS,
  ROTATE_SHADERS,
  LIGHT_SHADERS,
  PRISM_SHADERS,
  GLITCH_SHADERS,
  MORPH_SHADERS,
  PIXELATE_SHADERS,
  REFRACTION_SHADERS,
  SHUTTER_SHADERS,
  OTHER_SHADERS
}
