/**
 * ProjectSelector Component (PERSIST-003, PROJECT-001)
 * 
 * Modal for browsing, creating, loading, and managing projects.
 */

import { useState } from 'react'
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Search,
  Calendar,
  Tag,
  X,
  FileImage,
  Loader2,
} from 'lucide-react'
import { usePersistenceStore, type ProjectMetadata } from '../../stores/persistenceStore'

interface ProjectSelectorProps {
  isOpen: boolean
  onClose: () => void
}

export function ProjectSelector({ isOpen, onClose }: ProjectSelectorProps) {
  const {
    projects,
    currentProjectId,
    isLoading,
    storageUsage,
    createNewProject,
    loadProject,
    deleteProject,
    duplicateProject,
    exportProject,
    importProject,
  } = usePersistenceStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  if (!isOpen) return null

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const handleNewProject = async () => {
    await createNewProject()
    onClose()
  }

  const handleLoadProject = async (projectId: string) => {
    await loadProject(projectId)
    onClose()
  }

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId)
    setDeleteConfirmId(null)
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null)
    }
  }

  const handleDuplicateProject = async (projectId: string) => {
    await duplicateProject(projectId)
  }

  const handleExportProject = async (projectId: string) => {
    setIsExporting(true)
    try {
      const blob = await exportProject(projectId)
      const project = projects.find(p => p.id === projectId)
      const filename = `${project?.name || 'project'}.dualview`
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportProject = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.dualview'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setIsImporting(true)
      try {
        await importProject(file)
      } catch (error) {
        console.error('Import failed:', error)
      } finally {
        setIsImporting(false)
      }
    }
    input.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Projects</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800">
          <button
            onClick={handleNewProject}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
          <button
            onClick={handleImportProject}
            disabled={isImporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Import
          </button>
          
          <div className="flex-1" />
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          )}

          {!isLoading && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No projects match your search' : 'No projects yet'}
              </p>
              <button
                onClick={handleNewProject}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                Create your first project
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isActive={project.id === currentProjectId}
                isSelected={project.id === selectedProjectId}
                showDeleteConfirm={deleteConfirmId === project.id}
                isExporting={isExporting}
                onClick={() => setSelectedProjectId(project.id)}
                onDoubleClick={() => handleLoadProject(project.id)}
                onLoad={() => handleLoadProject(project.id)}
                onDelete={() => setDeleteConfirmId(project.id)}
                onConfirmDelete={() => handleDeleteProject(project.id)}
                onCancelDelete={() => setDeleteConfirmId(null)}
                onDuplicate={() => handleDuplicateProject(project.id)}
                onExport={() => handleExportProject(project.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>

        {/* Footer with storage info */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-700 text-xs text-zinc-500">
          <div>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-3">
            <span>
              Storage: {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.quota)}
            </span>
            <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(storageUsage.percentUsed, 100)}%` }}
              />
            </div>
            <span>{storageUsage.percentUsed.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProjectCardProps {
  project: ProjectMetadata
  isActive: boolean
  isSelected: boolean
  showDeleteConfirm: boolean
  isExporting: boolean
  onClick: () => void
  onDoubleClick: () => void
  onLoad: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onDuplicate: () => void
  onExport: () => void
  formatDate: (date: Date) => string
}

function ProjectCard({
  project,
  isActive,
  isSelected,
  showDeleteConfirm,
  isExporting,
  onClick,
  onDoubleClick,
  onLoad,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onDuplicate,
  onExport,
  formatDate,
}: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        relative rounded-lg border overflow-hidden cursor-pointer transition-all
        ${isActive ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 bg-zinc-800/50'}
        ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-900' : ''}
        hover:border-zinc-600
      `}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-zinc-800 flex items-center justify-center">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileImage className="w-12 h-12 text-zinc-600" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-white truncate">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{project.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(project.updatedAt)}</span>
        </div>
        {project.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <Tag className="w-3 h-3 text-zinc-500" />
            {project.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span className="text-xs text-zinc-500">+{project.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isSelected && !showDeleteConfirm && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 p-2 bg-gradient-to-t from-zinc-900/95 to-transparent">
          <button
            onClick={(e) => { e.stopPropagation(); onLoad(); }}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
          >
            Open
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            disabled={isExporting}
            className="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-50"
            title="Export"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 bg-red-600/30 hover:bg-red-600 text-red-400 hover:text-white rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 p-4">
          <p className="text-sm text-white mb-3 text-center">Delete this project?</p>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onConfirmDelete(); }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Active badge */}
      {isActive && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
          Current
        </div>
      )}
    </div>
  )
}
