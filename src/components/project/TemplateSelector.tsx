/**
 * TemplateSelector Component (PROJECT-002)
 * 
 * Allows users to create new projects from templates,
 * save current settings as templates, and manage templates.
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Layout,
  Grid,
  Columns,
  Plus,
  Trash2,
  Download,
  Upload,
  Edit2,
  X,
  Check,
  Bookmark,
  Smartphone,
  Square,
  Monitor,
  Clapperboard,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  getAllTemplates,
  getTemplatesByCategory,
  saveTemplate,
  deleteTemplate,
  renameTemplate,
  exportTemplates,
  importTemplates,
  type ProjectTemplate,
  type TemplateCategory,
  type TemplateConfig,
} from '../../lib/projectTemplates'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'

interface TemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onApplyTemplate: (template: ProjectTemplate) => void
}

// Category icons and labels
const CATEGORY_CONFIG: Record<TemplateCategory, { icon: typeof Layout; label: string; description: string }> = {
  'comparison': { icon: Columns, label: 'Comparison', description: 'Standard A/B comparison' },
  'before-after': { icon: Clapperboard, label: 'Before & After', description: 'Reveal transitions' },
  'ab-test': { icon: Grid, label: 'A/B Test', description: 'Multi-variant testing' },
  'custom': { icon: Bookmark, label: 'Custom', description: 'Your saved templates' },
}

// Aspect ratio icons
const ASPECT_ICONS: Record<string, typeof Monitor> = {
  '16:9': Monitor,
  '9:16': Smartphone,
  '1:1': Square,
  '4:3': Monitor,
  '21:9': Monitor,
  '4:5': Smartphone,
}

export function TemplateSelector({ isOpen, onClose, onApplyTemplate }: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  // Counter to force template refresh after save/delete
  const [templateVersion, setTemplateVersion] = useState(0)
  
  // Store references for saving current as template
  const projectStore = useProjectStore()
  const timelineStore = useTimelineStore()

  // Force refresh templates
  const refreshTemplates = useCallback(() => {
    setTemplateVersion(v => v + 1)
  }, [])

  // Get templates - re-fetch when templateVersion changes
  const allTemplates = useMemo(() => getAllTemplates(), [templateVersion])
  
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return allTemplates
    return getTemplatesByCategory(selectedCategory)
  }, [allTemplates, selectedCategory])

  if (!isOpen) return null

  const handleApply = (template: ProjectTemplate) => {
    onApplyTemplate(template)
    onClose()
  }

  const handleDelete = (templateId: string) => {
    deleteTemplate(templateId)
    setDeleteConfirmId(null)
    refreshTemplates()
  }

  const handleRename = (templateId: string) => {
    if (editingName.trim()) {
      renameTemplate(templateId, editingName.trim())
      refreshTemplates()
    }
    setEditingTemplateId(null)
    setEditingName('')
  }

  const handleExport = () => {
    const json = exportTemplates()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dualview-templates.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const json = await file.text()
        const count = importTemplates(json)
        alert(`Imported ${count} template(s)`)
        setSelectedCategory('custom') // Show the imported templates
        refreshTemplates()
      } catch (error) {
        alert('Failed to import templates: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }
    input.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Layout className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Project Templates</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Save Current
            </button>
            <button
              onClick={handleImport}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
              title="Import templates"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
              title="Export custom templates"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800 overflow-x-auto">
          <button
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors flex-shrink-0',
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
            )}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          {(Object.entries(CATEGORY_CONFIG) as [TemplateCategory, typeof CATEGORY_CONFIG[TemplateCategory]][]).map(([category, config]) => {
            const CategoryIcon = config.icon
            return (
              <button
                key={category}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors flex-shrink-0',
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                )}
                onClick={() => setSelectedCategory(category)}
              >
                <CategoryIcon className="w-3.5 h-3.5" />
                {config.label}
              </button>
            )
          })}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isEditing={editingTemplateId === template.id}
                editingName={editingName}
                showDeleteConfirm={deleteConfirmId === template.id}
                onApply={() => handleApply(template)}
                onStartEdit={() => {
                  setEditingTemplateId(template.id)
                  setEditingName(template.name)
                }}
                onSaveEdit={() => handleRename(template.id)}
                onCancelEdit={() => {
                  setEditingTemplateId(null)
                  setEditingName('')
                }}
                onEditNameChange={setEditingName}
                onDelete={() => setDeleteConfirmId(template.id)}
                onConfirmDelete={() => handleDelete(template.id)}
                onCancelDelete={() => setDeleteConfirmId(null)}
              />
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Layout className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No templates in this category</p>
            </div>
          )}
        </div>

        {/* Save current as template dialog */}
        {showSaveDialog && (
          <SaveTemplateDialog
            onSave={(name, description, category) => {
              // Create template config from current project state
              const config: TemplateConfig = {
                aspectRatioSettings: projectStore.aspectRatioSettings,
                trackCount: timelineStore.tracks.length,
                trackNames: timelineStore.tracks.map(t => t.name),
                trackTypes: timelineStore.tracks.map(t => t.type as 'a' | 'b' | 'c' | 'd'),
                comparisonMode: projectStore.comparisonMode,
                blendMode: projectStore.blendMode,
                sliderOrientation: projectStore.sliderOrientation,
                sliderPosition: projectStore.sliderPosition,
              }

              saveTemplate({
                name,
                description,
                category,
                config,
              })

              setShowSaveDialog(false)
              setSelectedCategory('custom')
              refreshTemplates()
            }}
            onClose={() => setShowSaveDialog(false)}
          />
        )}
      </div>
    </div>
  )
}

interface TemplateCardProps {
  template: ProjectTemplate
  isEditing: boolean
  editingName: string
  showDeleteConfirm: boolean
  onApply: () => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditNameChange: (name: string) => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function TemplateCard({
  template,
  isEditing,
  editingName,
  showDeleteConfirm,
  onApply,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditNameChange,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: TemplateCardProps) {
  const AspectIcon = ASPECT_ICONS[template.config.aspectRatioSettings.preset] || Monitor
  const CategoryConfig = CATEGORY_CONFIG[template.category]
  const CategoryIcon = CategoryConfig.icon

  return (
    <div className="relative rounded-lg border border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 transition-colors overflow-hidden group">
      {/* Preview header with aspect ratio indicator */}
      <div className="h-20 bg-zinc-900 flex items-center justify-center relative">
        <div className="flex items-center gap-2 text-zinc-500">
          <AspectIcon className="w-8 h-8" />
          <span className="text-xs">{template.config.aspectRatioSettings.preset}</span>
        </div>
        {/* Category badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-zinc-700/80 rounded text-[10px] text-zinc-300">
          <CategoryIcon className="w-3 h-3" />
          {CategoryConfig.label}
        </div>
        {/* Built-in badge */}
        {template.isBuiltIn && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600/20 rounded text-[10px] text-blue-400">
            Built-in
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit()
                if (e.key === 'Escape') onCancelEdit()
              }}
            />
            <button onClick={onSaveEdit} className="p-1 text-green-400 hover:bg-zinc-700 rounded">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={onCancelEdit} className="p-1 text-zinc-400 hover:bg-zinc-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <h3 className="font-medium text-white text-sm">{template.name}</h3>
        )}
        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{template.description}</p>
        
        {/* Config summary */}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
          <span>{template.config.trackCount} tracks</span>
          <span>•</span>
          <span className="capitalize">{template.config.comparisonMode.replace('-', ' ')}</span>
        </div>
      </div>

      {/* Action buttons */}
      {!showDeleteConfirm && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 p-2 bg-gradient-to-t from-zinc-900/95 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onApply}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
          >
            Use Template
          </button>
          {!template.isBuiltIn && (
            <>
              <button
                onClick={onStartEdit}
                className="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                title="Rename"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 bg-red-600/30 hover:bg-red-600 text-red-400 hover:text-white rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 p-4">
          <p className="text-sm text-white mb-3 text-center">Delete this template?</p>
          <div className="flex gap-2">
            <button
              onClick={onCancelDelete}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmDelete}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface SaveTemplateDialogProps {
  onSave: (name: string, description: string, category: TemplateCategory) => void
  onClose: () => void
}

function SaveTemplateDialog({ onSave, onClose }: SaveTemplateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('custom')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSave(name.trim(), description.trim(), category)
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl border border-zinc-700"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Save as Template</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="My Template"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
              placeholder="What is this template for?"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Category</label>
            <div className="flex gap-2">
              {(Object.entries(CATEGORY_CONFIG) as [TemplateCategory, typeof CATEGORY_CONFIG[TemplateCategory]][]).map(([cat, config]) => (
                <button
                  key={cat}
                  type="button"
                  className={cn(
                    'flex-1 py-2 px-3 rounded text-xs transition-colors',
                    category === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-700 text-zinc-400 hover:text-white'
                  )}
                  onClick={() => setCategory(cat)}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
          >
            Save Template
          </button>
        </div>
      </form>
    </div>
  )
}
