/**
 * Project Templates (PROJECT-002)
 * 
 * System for saving and loading project templates.
 * Templates include: aspect ratio, tracks, settings, but NOT media files.
 */

import type { AspectRatioSettings, ComparisonMode, BlendMode } from '../types'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  createdAt: number
  isBuiltIn: boolean
  
  // Template configuration
  config: TemplateConfig
}

export type TemplateCategory = 'comparison' | 'before-after' | 'ab-test' | 'custom'

export interface TemplateConfig {
  // Aspect ratio and resolution
  aspectRatioSettings: AspectRatioSettings
  
  // Track configuration
  trackCount: number
  trackNames: string[]
  trackTypes: ('a' | 'b' | 'c' | 'd')[]
  
  // Comparison settings
  comparisonMode: ComparisonMode
  blendMode: BlendMode
  sliderOrientation: 'vertical' | 'horizontal'
  sliderPosition: number
  
  // Additional settings (optional)
  showFilmstrip?: boolean
  showScopes?: boolean
  webglMode?: string
}

// Built-in templates
export const BUILT_IN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'builtin-comparison-16-9',
    name: 'Standard Comparison',
    description: 'Classic 16:9 A/B comparison with slider',
    category: 'comparison',
    createdAt: Date.now(),
    isBuiltIn: true,
    config: {
      aspectRatioSettings: { preset: '16:9', resolutionPreset: '1080p' },
      trackCount: 2,
      trackNames: ['Track A', 'Track B'],
      trackTypes: ['a', 'b'],
      comparisonMode: 'slider',
      blendMode: 'difference',
      sliderOrientation: 'vertical',
      sliderPosition: 50,
    },
  },
  {
    id: 'builtin-before-after',
    name: 'Before & After',
    description: 'Horizontal wipe for before/after reveals',
    category: 'before-after',
    createdAt: Date.now(),
    isBuiltIn: true,
    config: {
      aspectRatioSettings: { preset: '16:9', resolutionPreset: '1080p' },
      trackCount: 2,
      trackNames: ['Before', 'After'],
      trackTypes: ['a', 'b'],
      comparisonMode: 'slider',
      blendMode: 'difference',
      sliderOrientation: 'horizontal',
      sliderPosition: 50,
    },
  },
  {
    id: 'builtin-ab-test-quad',
    name: 'A/B/C/D Quad Test',
    description: 'Four-way comparison for AI model testing',
    category: 'ab-test',
    createdAt: Date.now(),
    isBuiltIn: true,
    config: {
      aspectRatioSettings: { preset: '16:9', resolutionPreset: '1080p' },
      trackCount: 4,
      trackNames: ['Model A', 'Model B', 'Model C', 'Model D'],
      trackTypes: ['a', 'b', 'c', 'd'],
      comparisonMode: 'quad',
      blendMode: 'difference',
      sliderOrientation: 'vertical',
      sliderPosition: 50,
    },
  },
  {
    id: 'builtin-portrait-reels',
    name: 'Portrait Reels',
    description: '9:16 format for TikTok and Instagram Reels',
    category: 'comparison',
    createdAt: Date.now(),
    isBuiltIn: true,
    config: {
      aspectRatioSettings: { preset: '9:16', resolutionPreset: '1080p' },
      trackCount: 2,
      trackNames: ['Track A', 'Track B'],
      trackTypes: ['a', 'b'],
      comparisonMode: 'slider',
      blendMode: 'difference',
      sliderOrientation: 'horizontal',
      sliderPosition: 50,
    },
  },
  {
    id: 'builtin-square-instagram',
    name: 'Square Post',
    description: '1:1 format for Instagram posts',
    category: 'comparison',
    createdAt: Date.now(),
    isBuiltIn: true,
    config: {
      aspectRatioSettings: { preset: '1:1', resolutionPreset: '1080p' },
      trackCount: 2,
      trackNames: ['Track A', 'Track B'],
      trackTypes: ['a', 'b'],
      comparisonMode: 'side-by-side',
      blendMode: 'difference',
      sliderOrientation: 'vertical',
      sliderPosition: 50,
    },
  },
  {
    id: 'builtin-vfx-diff',
    name: 'VFX Difference',
    description: 'WebGL difference analysis for VFX work',
    category: 'comparison',
    createdAt: Date.now(),
    isBuiltIn: true,
    config: {
      aspectRatioSettings: { preset: '16:9', resolutionPreset: '1080p' },
      trackCount: 2,
      trackNames: ['Reference', 'Composite'],
      trackTypes: ['a', 'b'],
      comparisonMode: 'webgl-compare',
      blendMode: 'difference',
      sliderOrientation: 'vertical',
      sliderPosition: 50,
      webglMode: 'diff-perceptual',
      showScopes: true,
    },
  },
]

// Storage key for custom templates
const TEMPLATES_STORAGE_KEY = 'dualview-templates'

/**
 * Get all templates (built-in + custom)
 */
export function getAllTemplates(): ProjectTemplate[] {
  const customTemplates = getCustomTemplates()
  return [...BUILT_IN_TEMPLATES, ...customTemplates]
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): ProjectTemplate[] {
  return getAllTemplates().filter(t => t.category === category)
}

/**
 * Get custom templates from localStorage
 */
export function getCustomTemplates(): ProjectTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as ProjectTemplate[]
  } catch {
    return []
  }
}

/**
 * Save a custom template
 * @throws Error if localStorage quota is exceeded
 */
export function saveTemplate(template: Omit<ProjectTemplate, 'id' | 'createdAt' | 'isBuiltIn'>): ProjectTemplate {
  const newTemplate: ProjectTemplate = {
    ...template,
    id: `custom-${Date.now()}`,
    createdAt: Date.now(),
    isBuiltIn: false,
  }

  const existing = getCustomTemplates()
  existing.push(newTemplate)
  
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(existing))
  } catch (error) {
    // Handle quota exceeded error
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      throw new Error('Storage quota exceeded. Please delete some templates to free up space.')
    }
    throw error
  }

  return newTemplate
}

/**
 * Delete a custom template
 */
export function deleteTemplate(templateId: string): boolean {
  const templates = getCustomTemplates()
  const filtered = templates.filter(t => t.id !== templateId)
  
  if (filtered.length === templates.length) {
    return false // Template not found
  }

  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(filtered))
  return true
}

/**
 * Rename a custom template
 */
export function renameTemplate(templateId: string, newName: string): boolean {
  const templates = getCustomTemplates()
  const template = templates.find(t => t.id === templateId)
  
  if (!template) return false
  
  template.name = newName
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
  return true
}

/**
 * Export templates as JSON
 */
export function exportTemplates(templateIds?: string[]): string {
  const templates = getCustomTemplates()
  const toExport = templateIds 
    ? templates.filter(t => templateIds.includes(t.id))
    : templates

  return JSON.stringify({
    version: 1,
    exportedAt: Date.now(),
    templates: toExport,
  }, null, 2)
}

/**
 * Import templates from JSON
 * @throws Error if localStorage quota is exceeded or format is invalid
 */
export function importTemplates(json: string): number {
  const data = JSON.parse(json)
  
  if (data.version !== 1) {
    throw new Error('Unsupported template format version')
  }

  const imported = data.templates as ProjectTemplate[]
  const existing = getCustomTemplates()
  
  // Assign new IDs to avoid conflicts
  const withNewIds = imported.map(t => ({
    ...t,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    isBuiltIn: false,
    createdAt: Date.now(),
  }))

  const combined = [...existing, ...withNewIds]
  
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(combined))
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      throw new Error('Storage quota exceeded. Cannot import templates.')
    }
    throw error
  }

  return imported.length
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return getAllTemplates().find(t => t.id === id)
}
