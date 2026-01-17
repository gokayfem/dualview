/**
 * Comparison Shader Index
 * Exports all comparison shaders and helper functions
 */

import type { WebGLComparisonMode, WebGLComparisonCategory } from '../../../types'
import type { ComparisonShader } from './common'

// Import all shader collections
import { DIFFERENCE_SHADERS, DIFFERENCE_VARIANTS } from './difference'
import { STRUCTURAL_SHADERS, STRUCTURAL_VARIANTS } from './structural'
import { COLOR_SHADERS, COLOR_VARIANTS } from './color'
import { PROFESSIONAL_SHADERS, PROFESSIONAL_VARIANTS } from './professional'
import { VIDEO_SHADERS, VIDEO_VARIANTS } from './video'
import { WEIGHTING_SHADERS, WEIGHTING_VARIANTS } from './weighting'
import { STRUCTURAL_ANALYSIS_SHADERS, STRUCTURAL_ANALYSIS_VARIANTS } from './structural-analysis'
import { ANALYSIS_SHADERS, ANALYSIS_VARIANTS } from './analysis'
import { EXPOSURE_SHADERS, EXPOSURE_VARIANTS } from './exposure'

// Merge all analysis shaders (ANALYSIS-001 to 003 from structural-analysis + ANALYSIS-004 to 008 from analysis)
const MERGED_ANALYSIS_SHADERS = { ...STRUCTURAL_ANALYSIS_SHADERS, ...ANALYSIS_SHADERS }
const MERGED_ANALYSIS_VARIANTS = [...STRUCTURAL_ANALYSIS_VARIANTS, ...ANALYSIS_VARIANTS]

// Re-export common utilities
export { COMPARISON_VERTEX_SHADER, COMPARISON_COMMON, type ComparisonShader } from './common'

// Map modes to shader collections
const SHADER_COLLECTIONS: Record<WebGLComparisonCategory, Record<string, ComparisonShader>> = {
  difference: DIFFERENCE_SHADERS,
  structural: STRUCTURAL_SHADERS,
  color: COLOR_SHADERS,
  professional: PROFESSIONAL_SHADERS,
  video: VIDEO_SHADERS,
  weighting: WEIGHTING_SHADERS,
  analysis: MERGED_ANALYSIS_SHADERS,
  exposure: EXPOSURE_SHADERS
}

// Map categories to variant lists
const VARIANT_LISTS: Record<WebGLComparisonCategory, string[]> = {
  difference: DIFFERENCE_VARIANTS,
  structural: STRUCTURAL_VARIANTS,
  color: COLOR_VARIANTS,
  professional: PROFESSIONAL_VARIANTS,
  video: VIDEO_VARIANTS,
  weighting: WEIGHTING_VARIANTS,
  analysis: MERGED_ANALYSIS_VARIANTS,
  exposure: EXPOSURE_VARIANTS
}

// All shaders in a flat map
const ALL_SHADERS: Record<string, ComparisonShader> = {
  ...DIFFERENCE_SHADERS,
  ...STRUCTURAL_SHADERS,
  ...COLOR_SHADERS,
  ...PROFESSIONAL_SHADERS,
  ...VIDEO_SHADERS,
  ...WEIGHTING_SHADERS,
  ...MERGED_ANALYSIS_SHADERS,
  ...EXPOSURE_SHADERS
}

/**
 * Get a specific shader by mode name
 */
export function getComparisonShader(mode: WebGLComparisonMode): ComparisonShader | undefined {
  return ALL_SHADERS[mode]
}

/**
 * Get all shaders for a category
 */
export function getCategoryShaders(category: WebGLComparisonCategory): ComparisonShader[] {
  const collection = SHADER_COLLECTIONS[category]
  return collection ? Object.values(collection) : []
}

/**
 * Get all mode names for a category
 */
export function getCategoryModes(category: WebGLComparisonCategory): WebGLComparisonMode[] {
  return (VARIANT_LISTS[category] || []) as WebGLComparisonMode[]
}

/**
 * Get total shader count
 */
export function getTotalComparisonShaderCount(): number {
  return Object.keys(ALL_SHADERS).length
}

/**
 * Category info with display label and icon
 */
export interface ComparisonCategoryInfo {
  id: WebGLComparisonCategory
  label: string
  icon: string
  description: string
  modes: WebGLComparisonMode[]
}

/**
 * Get all category info for UI
 */
export function getAllComparisonCategories(): ComparisonCategoryInfo[] {
  return [
    {
      id: 'difference',
      label: 'Difference',
      icon: '◐',
      description: 'Pixel and perceptual difference analysis',
      modes: DIFFERENCE_VARIANTS as WebGLComparisonMode[]
    },
    {
      id: 'structural',
      label: 'Structural',
      icon: '▦',
      description: 'Structure, edges, and quality metrics',
      modes: STRUCTURAL_VARIANTS as WebGLComparisonMode[]
    },
    {
      id: 'color',
      label: 'Color',
      icon: '◈',
      description: 'Color space and channel analysis',
      modes: COLOR_VARIANTS as WebGLComparisonMode[]
    },
    {
      id: 'professional',
      label: 'Professional',
      icon: '◎',
      description: 'Advanced tools for professionals',
      modes: PROFESSIONAL_VARIANTS as WebGLComparisonMode[]
    },
    {
      id: 'video',
      label: 'Video',
      icon: '▶',
      description: 'Video-specific analysis tools',
      modes: VIDEO_VARIANTS as WebGLComparisonMode[]
    },
    {
      id: 'weighting',
      label: 'Weighted',
      icon: '⚖',
      description: 'Perceptual importance weighting (WEBGL-012)',
      modes: WEIGHTING_VARIANTS as WebGLComparisonMode[]
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: '🔬',
      description: 'Advanced analysis: optical flow, FFT spectrum, band-pass filters, temporal noise, motion history',
      modes: MERGED_ANALYSIS_VARIANTS as WebGLComparisonMode[]
    },
    {
      id: 'exposure',
      label: 'Exposure',
      icon: '☀',
      description: 'Exposure analysis: false color, zebras, focus peaking, zone system',
      modes: EXPOSURE_VARIANTS as WebGLComparisonMode[]
    }
  ]
}

/**
 * Mode info with display label and description
 */
export interface ComparisonModeInfo {
  id: WebGLComparisonMode
  label: string
  category: WebGLComparisonCategory
  description: string
}

/**
 * Get info for a specific mode
 */
export function getComparisonModeInfo(mode: WebGLComparisonMode): ComparisonModeInfo | undefined {
  const shader = ALL_SHADERS[mode]
  if (!shader) return undefined

  return {
    id: mode,
    label: shader.label,
    category: shader.category,
    description: shader.description
  }
}

/**
 * Get all modes with their info
 */
export function getAllComparisonModes(): ComparisonModeInfo[] {
  return Object.values(ALL_SHADERS).map(shader => ({
    id: shader.name as WebGLComparisonMode,
    label: shader.label,
    category: shader.category,
    description: shader.description
  }))
}

// Re-export individual collections for direct access
export {
  DIFFERENCE_SHADERS,
  STRUCTURAL_SHADERS,
  COLOR_SHADERS,
  PROFESSIONAL_SHADERS,
  VIDEO_SHADERS,
  WEIGHTING_SHADERS,
  STRUCTURAL_ANALYSIS_SHADERS,
  ANALYSIS_SHADERS,
  EXPOSURE_SHADERS,
  MERGED_ANALYSIS_SHADERS,
  MERGED_ANALYSIS_VARIANTS
}
