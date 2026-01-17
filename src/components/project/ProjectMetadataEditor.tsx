/**
 * ProjectMetadataEditor Component (PROJECT-001)
 * 
 * Editable fields for project name, description, and tags.
 */

import { useState, useEffect, useRef } from 'react'
import { Edit2, X, Plus, Check } from 'lucide-react'
import { usePersistenceStore } from '../../stores/persistenceStore'

interface ProjectMetadataEditorProps {
  compact?: boolean
}

export function ProjectMetadataEditor({ compact = false }: ProjectMetadataEditorProps) {
  const { projectMetadata, updateProjectMetadata } = usePersistenceStore()
  
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [tempName, setTempName] = useState('')
  const [tempDescription, setTempDescription] = useState('')
  const [newTag, setNewTag] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  
  const nameInputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLTextAreaElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  useEffect(() => {
    if (isEditingDescription && descInputRef.current) {
      descInputRef.current.focus()
    }
  }, [isEditingDescription])

  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus()
    }
  }, [showTagInput])

  if (!projectMetadata) return null

  const handleStartEditName = () => {
    setTempName(projectMetadata.name)
    setIsEditingName(true)
  }

  const handleSaveName = () => {
    if (tempName.trim()) {
      updateProjectMetadata({ name: tempName.trim() })
    }
    setIsEditingName(false)
  }

  const handleStartEditDescription = () => {
    setTempDescription(projectMetadata.description)
    setIsEditingDescription(true)
  }

  const handleSaveDescription = () => {
    updateProjectMetadata({ description: tempDescription })
    setIsEditingDescription(false)
  }

  const handleAddTag = () => {
    if (newTag.trim() && !projectMetadata.tags.includes(newTag.trim())) {
      updateProjectMetadata({ tags: [...projectMetadata.tags, newTag.trim()] })
    }
    setNewTag('')
    setShowTagInput(false)
  }

  const handleRemoveTag = (tagToRemove: string) => {
    updateProjectMetadata({ tags: projectMetadata.tags.filter(t => t !== tagToRemove) })
  }

  const handleKeyDown = (e: React.KeyboardEvent, saveHandler: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveHandler()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
      setIsEditingDescription(false)
      setShowTagInput(false)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => handleKeyDown(e, handleSaveName)}
            className="bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        ) : (
          <button
            onClick={handleStartEditName}
            className="flex items-center gap-1.5 text-white hover:text-blue-400 transition-colors group"
          >
            <span className="text-sm font-medium">{projectMetadata.name}</span>
            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Project Name */}
      <div>
        <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">
          Project Name
        </label>
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <input
              ref={nameInputRef}
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleSaveName)}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter project name"
            />
            <button
              onClick={handleSaveName}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsEditingName(false)}
              className="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEditName}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded hover:border-zinc-600 transition-colors group"
          >
            <span className="text-white">{projectMetadata.name}</span>
            <Edit2 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
          </button>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">
          Description
        </label>
        {isEditingDescription ? (
          <div className="space-y-2">
            <textarea
              ref={descInputRef}
              value={tempDescription}
              onChange={(e) => setTempDescription(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleSaveDescription)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Add a description..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditingDescription(false)}
                className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDescription}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStartEditDescription}
            className="w-full text-left px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded hover:border-zinc-600 transition-colors group min-h-[60px]"
          >
            {projectMetadata.description ? (
              <span className="text-zinc-300 text-sm">{projectMetadata.description}</span>
            ) : (
              <span className="text-zinc-500 text-sm italic">Add a description...</span>
            )}
          </button>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1 block">
          Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {projectMetadata.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded-full group"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="p-0.5 hover:bg-zinc-600 rounded-full transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {showTagInput ? (
            <div className="flex items-center gap-1">
              <input
                ref={tagInputRef}
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleAddTag)}
                onBlur={handleAddTag}
                className="w-24 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="Add tag..."
              />
            </div>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 px-2 py-1 border border-dashed border-zinc-600 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 text-xs rounded-full transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add tag
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
        <div>
          <label className="text-xs text-zinc-500 block">Created</label>
          <span className="text-sm text-zinc-300">
            {projectMetadata.createdAt.toLocaleDateString()}
          </span>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block">Last Modified</label>
          <span className="text-sm text-zinc-300">
            {projectMetadata.updatedAt.toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  )
}
