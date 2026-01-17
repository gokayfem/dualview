/**
 * WEBGL-015: WebGL Comparison Presets Panel
 * UI for saving, loading, and managing presets
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import {
  loadPresets,
  savePreset,
  deletePreset,
  exportPresets,
  importPresets,
  saveImportedPresets,
  PRESET_CATEGORIES,
  type WebGLPreset
} from '../../lib/webgl/presets'
import { Bookmark, Save, Trash2, Download, Upload, ChevronDown, ChevronRight, X } from 'lucide-react'

interface WebGLPresetsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function WebGLPresetsPanel({ isOpen, onClose }: WebGLPresetsPanelProps) {
  const [presets, setPresets] = useState<WebGLPreset[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['builtin', 'custom']))
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetDescription, setNewPresetDescription] = useState('')
  const [newPresetCategory, setNewPresetCategory] = useState<'qa' | 'ai' | 'vfx' | 'custom'>('custom')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { webglComparisonSettings, setWebGLComparisonSettings } = useProjectStore()

  // Load presets on mount
  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  // Group presets by category
  const presetsByCategory = presets.reduce((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = []
    acc[preset.category].push(preset)
    return acc
  }, {} as Record<string, WebGLPreset[]>)

  // Apply preset
  const applyPreset = useCallback((preset: WebGLPreset) => {
    setWebGLComparisonSettings(preset.settings)
  }, [setWebGLComparisonSettings])

  // Save current settings as preset
  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) return

    savePreset({
      name: newPresetName.trim(),
      description: newPresetDescription.trim(),
      category: newPresetCategory,
      settings: {
        mode: webglComparisonSettings.mode,
        amplification: webglComparisonSettings.amplification,
        threshold: webglComparisonSettings.threshold,
        blockSize: webglComparisonSettings.blockSize,
        opacity: webglComparisonSettings.opacity,
        colorScheme: webglComparisonSettings.colorScheme,
        loupeSize: webglComparisonSettings.loupeSize,
        loupeZoom: webglComparisonSettings.loupeZoom,
        checkerSize: webglComparisonSettings.checkerSize,
        onionOpacity: webglComparisonSettings.onionOpacity,
        showMetricsOverlay: webglComparisonSettings.showMetricsOverlay,
        showScaleBar: webglComparisonSettings.showScaleBar
      }
    })

    setPresets(loadPresets())
    setShowSaveDialog(false)
    setNewPresetName('')
    setNewPresetDescription('')
  }, [newPresetName, newPresetDescription, newPresetCategory, webglComparisonSettings])

  // Delete preset
  const handleDeletePreset = useCallback((presetId: string) => {
    deletePreset(presetId)
    setPresets(loadPresets())
  }, [])

  // Export presets
  const handleExport = useCallback(() => {
    const customPresets = presets.filter(p => !p.isBuiltin)
    const json = exportPresets(customPresets)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dualview-presets-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [presets])

  // Import presets
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const json = evt.target?.result as string
      const imported = importPresets(json)
      if (imported.length > 0) {
        saveImportedPresets(imported)
        setPresets(loadPresets())
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }, [])

  // Toggle category
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  if (!isOpen) return null

  return (
    <div className="absolute top-12 right-4 w-80 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bookmark size={16} className="text-[#ff5722]" />
          <span className="font-medium text-white">Presets</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="p-1.5 rounded bg-[#ff5722] text-white hover:bg-[#e64a19] transition-colors"
            title="Save Current Settings"
          >
            <Save size={14} />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Export Presets"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Import Presets"
          >
            <Upload size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:text-white transition-colors ml-2"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="p-4 border-b border-gray-700 bg-[#252525]">
          <div className="text-sm text-gray-400 mb-2">Save Current Settings</div>
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset name"
            className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-3 py-2 text-sm text-white mb-2"
            autoFocus
          />
          <input
            type="text"
            value={newPresetDescription}
            onChange={(e) => setNewPresetDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-3 py-2 text-sm text-white mb-2"
          />
          <select
            value={newPresetCategory}
            onChange={(e) => setNewPresetCategory(e.target.value as 'qa' | 'ai' | 'vfx' | 'custom')}
            className="w-full bg-[#1a1a1a] border border-gray-600 rounded px-3 py-2 text-sm text-white mb-3"
          >
            <option value="custom">Custom</option>
            <option value="qa">QA & Testing</option>
            <option value="ai">AI Comparison</option>
            <option value="vfx">VFX & Post</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleSavePreset}
              disabled={!newPresetName.trim()}
              className="flex-1 bg-[#ff5722] text-white py-1.5 rounded text-sm hover:bg-[#e64a19] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Preset
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Presets List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(PRESET_CATEGORIES).map(([category, label]) => {
          const categoryPresets = presetsByCategory[category] || []
          if (categoryPresets.length === 0) return null

          const isExpanded = expandedCategories.has(category)

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-2 bg-[#252525] hover:bg-[#2a2a2a] transition-colors"
              >
                <span className="text-sm text-gray-300 font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{categoryPresets.length}</span>
                  {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                </div>
              </button>

              {isExpanded && (
                <div className="bg-[#1a1a1a]">
                  {categoryPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between px-4 py-2 hover:bg-[#252525] group cursor-pointer"
                      onClick={() => applyPreset(preset)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{preset.name}</div>
                        {preset.description && (
                          <div className="text-xs text-gray-500 truncate">{preset.description}</div>
                        )}
                      </div>
                      {!preset.isBuiltin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePreset(preset.id)
                          }}
                          className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
        Click a preset to apply • Ctrl+1-9 for quick access
      </div>
    </div>
  )
}

// Toggle button for the presets panel
export function PresetsToggle({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-colors ${isActive ? 'bg-[#ff5722] text-white' : 'bg-black/70 text-gray-400 hover:text-white'}`}
      title="Comparison Presets (WEBGL-015)"
    >
      <Bookmark size={16} />
    </button>
  )
}
