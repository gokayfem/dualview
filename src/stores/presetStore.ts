import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ComparisonMode, BlendMode, SplitLayout } from '../types'
import { generateId } from '../lib/utils'

export interface ComparisonPreset {
  id: string
  name: string
  createdAt: number
  settings: {
    comparisonMode: ComparisonMode
    blendMode: BlendMode
    splitLayout: SplitLayout
    sliderPosition: number
    sliderOrientation: 'vertical' | 'horizontal'
    showMetrics: boolean
    pixelInspectorEnabled: boolean
  }
}

interface PresetStore {
  presets: ComparisonPreset[]
  activePresetId: string | null

  // Actions
  savePreset: (name: string, settings: ComparisonPreset['settings']) => ComparisonPreset
  loadPreset: (id: string) => ComparisonPreset | undefined
  deletePreset: (id: string) => void
  renamePreset: (id: string, name: string) => void
  setActivePreset: (id: string | null) => void
  getDefaultPresets: () => ComparisonPreset[]
}

const defaultPresets: ComparisonPreset[] = [
  {
    id: 'default-slider',
    name: 'Slider (Default)',
    createdAt: 0,
    settings: {
      comparisonMode: 'slider',
      blendMode: 'difference',
      splitLayout: '2x1',
      sliderPosition: 50,
      sliderOrientation: 'vertical',
      showMetrics: false,
      pixelInspectorEnabled: false,
    },
  },
  {
    id: 'default-difference',
    name: 'Difference Blend',
    createdAt: 0,
    settings: {
      comparisonMode: 'blend',
      blendMode: 'difference',
      splitLayout: '2x1',
      sliderPosition: 50,
      sliderOrientation: 'vertical',
      showMetrics: false,
      pixelInspectorEnabled: false,
    },
  },
  {
    id: 'default-sidebyside',
    name: 'Side by Side',
    createdAt: 0,
    settings: {
      comparisonMode: 'side-by-side',
      blendMode: 'difference',
      splitLayout: '2x1',
      sliderPosition: 50,
      sliderOrientation: 'vertical',
      showMetrics: false,
      pixelInspectorEnabled: false,
    },
  },
  {
    id: 'default-flicker',
    name: 'Flicker Mode',
    createdAt: 0,
    settings: {
      comparisonMode: 'flicker',
      blendMode: 'difference',
      splitLayout: '2x1',
      sliderPosition: 50,
      sliderOrientation: 'vertical',
      showMetrics: false,
      pixelInspectorEnabled: false,
    },
  },
  {
    id: 'default-metrics',
    name: 'Quality Analysis',
    createdAt: 0,
    settings: {
      comparisonMode: 'side-by-side',
      blendMode: 'difference',
      splitLayout: '2x1',
      sliderPosition: 50,
      sliderOrientation: 'vertical',
      showMetrics: true,
      pixelInspectorEnabled: true,
    },
  },
]

export const usePresetStore = create<PresetStore>()(
  persist(
    (set, get) => ({
      presets: [...defaultPresets],
      activePresetId: null,

      savePreset: (name: string, settings: ComparisonPreset['settings']) => {
        const preset: ComparisonPreset = {
          id: generateId(),
          name,
          createdAt: Date.now(),
          settings,
        }

        set(state => ({
          presets: [...state.presets, preset],
          activePresetId: preset.id,
        }))

        return preset
      },

      loadPreset: (id: string) => {
        const preset = get().presets.find(p => p.id === id)
        if (preset) {
          set({ activePresetId: id })
        }
        return preset
      },

      deletePreset: (id: string) => {
        // Don't allow deleting default presets
        if (id.startsWith('default-')) return

        set(state => ({
          presets: state.presets.filter(p => p.id !== id),
          activePresetId: state.activePresetId === id ? null : state.activePresetId,
        }))
      },

      renamePreset: (id: string, name: string) => {
        // Don't allow renaming default presets
        if (id.startsWith('default-')) return

        set(state => ({
          presets: state.presets.map(p =>
            p.id === id ? { ...p, name } : p
          ),
        }))
      },

      setActivePreset: (id: string | null) => {
        set({ activePresetId: id })
      },

      getDefaultPresets: () => defaultPresets,
    }),
    {
      name: 'dualview-presets',
      version: 1,
    }
  )
)
