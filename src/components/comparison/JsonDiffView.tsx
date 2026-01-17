/**
 * JSON Diff View - Dedicated JSON comparison mode
 */
import { useState, useRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { cn } from '../../lib/utils'
import { JsonTreeDiff } from './JsonTreeDiff'
import {
  Upload,
  Copy,
  Trash2,
  Check,
  Braces,
  ArrowLeftRight
} from 'lucide-react'

export function JsonDiffView() {
  const { promptA, promptB, setPromptA, setPromptB } = useProjectStore()
  const [copiedA, setCopiedA] = useState(false)
  const [copiedB, setCopiedB] = useState(false)
  const fileInputARef = useRef<HTMLInputElement>(null)
  const fileInputBRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (side: 'a' | 'b') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (side === 'a') {
        setPromptA(content)
      } else {
        setPromptB(content)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCopy = async (text: string, side: 'a' | 'b') => {
    await navigator.clipboard.writeText(text)
    if (side === 'a') {
      setCopiedA(true)
      setTimeout(() => setCopiedA(false), 2000)
    } else {
      setCopiedB(true)
      setTimeout(() => setCopiedB(false), 2000)
    }
  }

  const handleSwap = () => {
    const tempA = promptA
    setPromptA(promptB || '')
    setPromptB(tempA || '')
  }

  const formatJson = (text: string): string => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }

  const handleFormat = (side: 'a' | 'b') => {
    if (side === 'a' && promptA) {
      setPromptA(formatJson(promptA))
    } else if (side === 'b' && promptB) {
      setPromptB(formatJson(promptB))
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Top: JSON Editors */}
      <div className="h-[35%] min-h-[200px] flex border-b border-border">
        {/* JSON A Editor */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="h-10 bg-surface border-b border-border flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-accent flex items-center justify-center text-white text-xs font-bold">A</span>
              <span className="text-xs font-medium text-text-secondary">Original JSON</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={fileInputARef}
                type="file"
                accept=".json"
                onChange={handleFileUpload('a')}
                className="hidden"
              />
              <button
                onClick={() => fileInputARef.current?.click()}
                className="p-1.5 text-text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                title="Upload JSON file"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleFormat('a')}
                disabled={!promptA}
                className={cn(
                  "p-1.5 transition-colors",
                  promptA ? "text-text-muted hover:text-accent hover:bg-surface-hover" : "text-text-muted/30"
                )}
                title="Format JSON"
              >
                <Braces className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleCopy(promptA || '', 'a')}
                disabled={!promptA}
                className={cn(
                  "p-1.5 transition-colors",
                  promptA ? "text-text-muted hover:text-text-primary hover:bg-surface-hover" : "text-text-muted/30"
                )}
                title="Copy"
              >
                {copiedA ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setPromptA('')}
                disabled={!promptA}
                className={cn(
                  "p-1.5 transition-colors",
                  promptA ? "text-text-muted hover:text-error hover:bg-surface-hover" : "text-text-muted/30"
                )}
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <textarea
              value={promptA || ''}
              onChange={(e) => setPromptA(e.target.value)}
              placeholder='{"key": "value"}'
              className="w-full h-full p-3 bg-transparent text-text-primary text-sm resize-none focus:outline-none font-mono"
              spellCheck={false}
            />
            {!promptA && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-text-muted">
                  <Braces className="w-8 h-8 text-accent/30" />
                  <span className="text-xs">Paste or upload JSON A</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex items-center bg-surface">
          <button
            onClick={handleSwap}
            className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="Swap A ↔ B"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        {/* JSON B Editor */}
        <div className="flex-1 flex flex-col">
          <div className="h-10 bg-surface border-b border-border flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-secondary flex items-center justify-center text-black text-xs font-bold">B</span>
              <span className="text-xs font-medium text-text-secondary">Modified JSON</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={fileInputBRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload('b')}
                className="hidden"
              />
              <button
                onClick={() => fileInputBRef.current?.click()}
                className="p-1.5 text-text-muted hover:text-secondary hover:bg-surface-hover transition-colors"
                title="Upload JSON file"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleFormat('b')}
                disabled={!promptB}
                className={cn(
                  "p-1.5 transition-colors",
                  promptB ? "text-text-muted hover:text-secondary hover:bg-surface-hover" : "text-text-muted/30"
                )}
                title="Format JSON"
              >
                <Braces className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleCopy(promptB || '', 'b')}
                disabled={!promptB}
                className={cn(
                  "p-1.5 transition-colors",
                  promptB ? "text-text-muted hover:text-text-primary hover:bg-surface-hover" : "text-text-muted/30"
                )}
                title="Copy"
              >
                {copiedB ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setPromptB('')}
                disabled={!promptB}
                className={cn(
                  "p-1.5 transition-colors",
                  promptB ? "text-text-muted hover:text-error hover:bg-surface-hover" : "text-text-muted/30"
                )}
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <textarea
              value={promptB || ''}
              onChange={(e) => setPromptB(e.target.value)}
              placeholder='{"key": "new value"}'
              className="w-full h-full p-3 bg-transparent text-text-primary text-sm resize-none focus:outline-none font-mono"
              spellCheck={false}
            />
            {!promptB && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-text-muted">
                  <Braces className="w-8 h-8 text-secondary/30" />
                  <span className="text-xs">Paste or upload JSON B</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Tree Diff View */}
      <div className="flex-1 min-h-0 overflow-auto">
        <JsonTreeDiff jsonA={promptA || ''} jsonB={promptB || ''} />
      </div>
    </div>
  )
}
