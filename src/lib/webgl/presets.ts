/**
 * WEBGL-015: Comparison Presets System
 * Save, load, and manage WebGL comparison presets
 */

import type { WebGLComparisonSettings, WebGLComparisonMode } from '../../types'

export interface WebGLPreset {
  id: string
  name: string
  description: string
  category: 'builtin' | 'qa' | 'ai' | 'vfx' | 'custom'
  settings: Partial<WebGLComparisonSettings>
  createdAt: number
  isBuiltin?: boolean
}

export const PRESET_CATEGORIES = {
  builtin: 'Built-in',
  qa: 'QA & Testing',
  ai: 'AI Comparison',
  vfx: 'VFX & Post',
  custom: 'Custom'
} as const

// Built-in presets for common use cases
export const BUILTIN_PRESETS: WebGLPreset[] = [
  {
    id: 'preset-quick-diff',
    name: 'Quick Difference',
    description: 'Fast visual difference check with moderate amplification',
    category: 'builtin',
    settings: {
      mode: 'diff-absolute' as WebGLComparisonMode,
      amplification: 5,
      threshold: 0.02,
      colorScheme: 'heat'
    },
    createdAt: 0,
    isBuiltin: true
  },
  {
    id: 'preset-perceptual',
    name: 'Perceptual Analysis',
    description: 'Delta E color difference for human perception',
    category: 'builtin',
    settings: {
      mode: 'diff-perceptual' as WebGLComparisonMode,
      amplification: 3,
      threshold: 0.01,
      colorScheme: 'rainbow'
    },
    createdAt: 0,
    isBuiltin: true
  },
  {
    id: 'preset-structure',
    name: 'Structural SSIM',
    description: 'Structural similarity index visualization',
    category: 'builtin',
    settings: {
      mode: 'struct-ssim' as WebGLComparisonMode,
      amplification: 5,
      threshold: 0.05,
      colorScheme: 'heat'
    },
    createdAt: 0,
    isBuiltin: true
  },
  // QA Presets
  {
    id: 'preset-qa-strict',
    name: 'Strict QA',
    description: 'Strict pixel comparison for QA testing',
    category: 'qa',
    settings: {
      mode: 'diff-threshold' as WebGLComparisonMode,
      amplification: 1,
      threshold: 0.01,
      colorScheme: 'redgreen',
      showMetricsOverlay: true
    },
    createdAt: 0,
    isBuiltin: true
  },
  {
    id: 'preset-qa-tolerance',
    name: 'Tolerant QA',
    description: 'QA with some tolerance for minor differences',
    category: 'qa',
    settings: {
      mode: 'diff-threshold' as WebGLComparisonMode,
      amplification: 1,
      threshold: 0.05,
      colorScheme: 'redgreen',
      showMetricsOverlay: true
    },
    createdAt: 0,
    isBuiltin: true
  },
  // AI Comparison Presets
  {
    id: 'preset-ai-model',
    name: 'AI Model Comparison',
    description: 'Compare AI-generated images with enhanced difference view',
    category: 'ai',
    settings: {
      mode: 'diff-amplified' as WebGLComparisonMode,
      amplification: 20,
      threshold: 0.03,
      colorScheme: 'rainbow',
      showMetricsOverlay: true
    },
    createdAt: 0,
    isBuiltin: true
  },
  {
    id: 'preset-ai-upscale',
    name: 'Upscale Analysis',
    description: 'Analyze AI upscaling quality with edge detection',
    category: 'ai',
    settings: {
      mode: 'struct-edge' as WebGLComparisonMode,
      amplification: 10,
      threshold: 0.02,
      colorScheme: 'grayscale'
    },
    createdAt: 0,
    isBuiltin: true
  },
  // VFX Presets
  {
    id: 'preset-vfx-comp',
    name: 'VFX Compositing',
    description: 'Check compositing with checkerboard view',
    category: 'vfx',
    settings: {
      mode: 'pro-checkerboard' as WebGLComparisonMode,
      checkerSize: 32,
      opacity: 1.0
    },
    createdAt: 0,
    isBuiltin: true
  },
  {
    id: 'preset-vfx-color',
    name: 'Color Grading',
    description: 'Analyze color differences in graded footage',
    category: 'vfx',
    settings: {
      mode: 'color-hue' as WebGLComparisonMode,
      amplification: 5,
      colorScheme: 'rainbow',
      showScaleBar: true
    },
    createdAt: 0,
    isBuiltin: true
  },
  {
    id: 'preset-vfx-flicker',
    name: 'Flicker Check',
    description: 'Detect temporal inconsistencies in video',
    category: 'vfx',
    settings: {
      mode: 'video-flicker' as WebGLComparisonMode,
      amplification: 15,
      threshold: 0.03
    },
    createdAt: 0,
    isBuiltin: true
  }
]

const STORAGE_KEY = 'dualview-webgl-presets'

/**
 * Load all presets (built-in + custom from localStorage)
 */
export function loadPresets(): WebGLPreset[] {
  const builtins = BUILTIN_PRESETS

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const customPresets: WebGLPreset[] = JSON.parse(stored)
      return [...builtins, ...customPresets]
    }
  } catch (e) {
    console.error('Failed to load custom presets:', e)
  }

  return builtins
}

/**
 * Save a custom preset
 */
export function savePreset(preset: Omit<WebGLPreset, 'id' | 'createdAt' | 'isBuiltin'>): WebGLPreset {
  const newPreset: WebGLPreset = {
    ...preset,
    id: `preset-custom-${Date.now()}`,
    createdAt: Date.now(),
    isBuiltin: false
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const customPresets: WebGLPreset[] = stored ? JSON.parse(stored) : []
    customPresets.push(newPreset)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets))
  } catch (e) {
    console.error('Failed to save preset:', e)
  }

  return newPreset
}

/**
 * Delete a custom preset
 */
export function deletePreset(presetId: string): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const customPresets: WebGLPreset[] = JSON.parse(stored)
      const filtered = customPresets.filter(p => p.id !== presetId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      return true
    }
  } catch (e) {
    console.error('Failed to delete preset:', e)
  }
  return false
}

/**
 * Export presets as JSON string
 */
export function exportPresets(presets: WebGLPreset[]): string {
  return JSON.stringify(presets, null, 2)
}

/**
 * Import presets from JSON string
 */
export function importPresets(json: string): WebGLPreset[] {
  try {
    const presets: WebGLPreset[] = JSON.parse(json)
    // Validate and re-id imported presets
    return presets.map(p => ({
      ...p,
      id: `preset-imported-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      isBuiltin: false,
      createdAt: Date.now()
    }))
  } catch (e) {
    console.error('Failed to import presets:', e)
    return []
  }
}

/**
 * Save imported presets to localStorage
 */
export function saveImportedPresets(presets: WebGLPreset[]): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const customPresets: WebGLPreset[] = stored ? JSON.parse(stored) : []
    customPresets.push(...presets)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets))
  } catch (e) {
    console.error('Failed to save imported presets:', e)
  }
}
