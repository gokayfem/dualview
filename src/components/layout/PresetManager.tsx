import { useState } from 'react'
import { cn } from '../../lib/utils'
import { usePresetStore, type ComparisonPreset } from '../../stores/presetStore'
import { useProjectStore } from '../../stores/projectStore'
import { Bookmark, Plus, Trash2, Edit2, Check, X, ChevronDown } from 'lucide-react'
import { Button } from '../ui'

interface PresetManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function PresetManager({ isOpen, onClose }: PresetManagerProps) {
  const [newPresetName, setNewPresetName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const { presets, activePresetId, savePreset, deletePreset, renamePreset, setActivePreset } = usePresetStore()
  const {
    comparisonMode,
    blendMode,
    splitLayout,
    sliderPosition,
    sliderOrientation,
    showMetrics,
    pixelInspectorEnabled,
    setComparisonMode,
    setBlendMode,
    setSplitLayout,
    setSliderPosition,
    setSliderOrientation,
    toggleMetrics,
    togglePixelInspector,
  } = useProjectStore()

  const getCurrentSettings = (): ComparisonPreset['settings'] => ({
    comparisonMode,
    blendMode,
    splitLayout,
    sliderPosition,
    sliderOrientation,
    showMetrics,
    pixelInspectorEnabled,
  })

  const applyPreset = (preset: ComparisonPreset) => {
    setComparisonMode(preset.settings.comparisonMode)
    setBlendMode(preset.settings.blendMode)
    setSplitLayout(preset.settings.splitLayout)
    setSliderPosition(preset.settings.sliderPosition)
    setSliderOrientation(preset.settings.sliderOrientation)

    // Toggle metrics if needed
    if (preset.settings.showMetrics !== showMetrics) {
      toggleMetrics()
    }
    if (preset.settings.pixelInspectorEnabled !== pixelInspectorEnabled) {
      togglePixelInspector()
    }

    setActivePreset(preset.id)
  }

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) return
    const preset = savePreset(newPresetName.trim(), getCurrentSettings())
    setNewPresetName('')
    setIsCreating(false)
    applyPreset(preset)
  }

  const handleRename = (id: string) => {
    if (!editName.trim()) return
    renamePreset(id, editName.trim())
    setEditingId(null)
    setEditName('')
  }

  const startEditing = (preset: ComparisonPreset) => {
    setEditingId(preset.id)
    setEditName(preset.name)
  }

  if (!isOpen) return null

  const userPresets = presets.filter(p => !p.id.startsWith('default-'))
  const defaultPresets = presets.filter(p => p.id.startsWith('default-'))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Bookmark className="w-5 h-5" />
            Comparison Presets
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Create new preset */}
          {isCreating ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreatePreset()}
              />
              <Button variant="default" size="icon" onClick={handleCreatePreset}>
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Save Current Settings as Preset
            </Button>
          )}

          {/* User presets */}
          {userPresets.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Your Presets
              </h3>
              <div className="space-y-1">
                {userPresets.map(preset => (
                  <PresetItem
                    key={preset.id}
                    preset={preset}
                    isActive={activePresetId === preset.id}
                    isEditing={editingId === preset.id}
                    editName={editName}
                    onEditNameChange={setEditName}
                    onApply={() => applyPreset(preset)}
                    onStartEdit={() => startEditing(preset)}
                    onSaveEdit={() => handleRename(preset.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={() => deletePreset(preset.id)}
                    canEdit
                  />
                ))}
              </div>
            </div>
          )}

          {/* Default presets */}
          <div>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Default Presets
            </h3>
            <div className="space-y-1">
              {defaultPresets.map(preset => (
                <PresetItem
                  key={preset.id}
                  preset={preset}
                  isActive={activePresetId === preset.id}
                  isEditing={false}
                  editName=""
                  onEditNameChange={() => {}}
                  onApply={() => applyPreset(preset)}
                  onStartEdit={() => {}}
                  onSaveEdit={() => {}}
                  onCancelEdit={() => {}}
                  onDelete={() => {}}
                  canEdit={false}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PresetItem({
  preset,
  isActive,
  isEditing,
  editName,
  onEditNameChange,
  onApply,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  canEdit,
}: {
  preset: ComparisonPreset
  isActive: boolean
  isEditing: boolean
  editName: string
  onEditNameChange: (name: string) => void
  onApply: () => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  canEdit: boolean
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-surface-hover rounded">
        <input
          type="text"
          value={editName}
          onChange={e => onEditNameChange(e.target.value)}
          className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm text-text-primary"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && onSaveEdit()}
        />
        <button onClick={onSaveEdit} className="p-1 hover:bg-surface rounded">
          <Check className="w-4 h-4 text-green-400" />
        </button>
        <button onClick={onCancelEdit} className="p-1 hover:bg-surface rounded">
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded cursor-pointer group",
        isActive ? "bg-accent/20 border border-accent/50" : "hover:bg-surface-hover"
      )}
      onClick={onApply}
    >
      <div className="flex items-center gap-2">
        <Bookmark className={cn("w-4 h-4", isActive ? "text-accent" : "text-text-muted")} />
        <span className={cn("text-sm", isActive ? "text-text-primary font-medium" : "text-text-secondary")}>
          {preset.name}
        </span>
      </div>

      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onStartEdit() }}
            className="p-1 hover:bg-surface rounded"
            title="Rename"
          >
            <Edit2 className="w-3 h-3 text-text-muted" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1 hover:bg-surface rounded"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-error" />
          </button>
        </div>
      )}
    </div>
  )
}

// Quick preset selector for header
export function PresetSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const { presets, activePresetId, setActivePreset } = usePresetStore()
  const {
    setComparisonMode,
    setBlendMode,
    setSplitLayout,
    setSliderPosition,
    setSliderOrientation,
    showMetrics,
    pixelInspectorEnabled,
    toggleMetrics,
    togglePixelInspector,
  } = useProjectStore()

  const activePreset = presets.find(p => p.id === activePresetId)

  const applyPreset = (preset: ComparisonPreset) => {
    setComparisonMode(preset.settings.comparisonMode)
    setBlendMode(preset.settings.blendMode)
    setSplitLayout(preset.settings.splitLayout)
    setSliderPosition(preset.settings.sliderPosition)
    setSliderOrientation(preset.settings.sliderOrientation)

    if (preset.settings.showMetrics !== showMetrics) {
      toggleMetrics()
    }
    if (preset.settings.pixelInspectorEnabled !== pixelInspectorEnabled) {
      togglePixelInspector()
    }

    setActivePreset(preset.id)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded"
      >
        <Bookmark className="w-3 h-3" />
        {activePreset?.name || 'Presets'}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-48 bg-surface border border-border rounded shadow-lg z-50">
            {presets.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-surface-hover flex items-center gap-2",
                  activePresetId === preset.id && "bg-accent/20 text-accent"
                )}
              >
                <Bookmark className="w-3 h-3" />
                {preset.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
