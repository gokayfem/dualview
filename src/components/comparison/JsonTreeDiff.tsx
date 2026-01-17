/**
 * TXT-004: JSON Tree Diff
 * Professional side-by-side JSON comparison with tree view
 */
import { useState, useMemo } from 'react'
import { cn } from '../../lib/utils'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  PenLine,
  Eye,
  EyeOff,
  Layers,
  Copy,
  Check
} from 'lucide-react'

interface JsonTreeDiffProps {
  jsonA: string
  jsonB: string
}

type DiffType = 'added' | 'removed' | 'modified' | 'unchanged'
type ViewMode = 'tree' | 'side-by-side' | 'inline'

interface DiffNode {
  key: string
  path: string
  valueA: unknown
  valueB: unknown
  type: DiffType
  children?: DiffNode[]
  isArray?: boolean
}

function parseJSON(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch {
    const lines = str.split('\n')
    const result: Record<string, string> = {}
    for (const line of lines) {
      const match = line.match(/^(\s*)([^:]+):\s*(.*)$/)
      if (match) {
        result[match[2].trim()] = match[3].trim()
      }
    }
    return Object.keys(result).length > 0 ? result : str
  }
}

function compareValues(a: unknown, b: unknown): DiffType {
  if (a === undefined && b !== undefined) return 'added'
  if (a !== undefined && b === undefined) return 'removed'
  if (JSON.stringify(a) !== JSON.stringify(b)) return 'modified'
  return 'unchanged'
}

function buildDiffTree(a: unknown, b: unknown, key: string = 'root', path: string = ''): DiffNode {
  const currentPath = path ? `${path}.${key}` : key
  const type = compareValues(a, b)

  if (
    a && b &&
    typeof a === 'object' && typeof b === 'object' &&
    !Array.isArray(a) && !Array.isArray(b)
  ) {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
    const children: DiffNode[] = []

    for (const childKey of allKeys) {
      children.push(buildDiffTree(aObj[childKey], bObj[childKey], childKey, currentPath))
    }

    const hasChanges = children.some(c => c.type !== 'unchanged')
    return { key, path: currentPath, valueA: a, valueB: b, type: hasChanges ? 'modified' : 'unchanged', children }
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length)
    const children: DiffNode[] = []
    for (let i = 0; i < maxLen; i++) {
      children.push(buildDiffTree(a[i], b[i], `${i}`, currentPath))
    }
    const hasChanges = children.some(c => c.type !== 'unchanged')
    return { key, path: currentPath, valueA: a, valueB: b, type: hasChanges ? 'modified' : 'unchanged', children, isArray: true }
  }

  return { key, path: currentPath, valueA: a, valueB: b, type }
}

// Format value for display
function formatValue(val: unknown, truncate = true): string {
  if (val === undefined) return 'undefined'
  if (val === null) return 'null'
  if (typeof val === 'string') {
    const str = `"${val}"`
    return truncate && str.length > 50 ? str.slice(0, 47) + '..."' : str
  }
  if (typeof val === 'boolean') return String(val)
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) return `[${val.length} items]`
  if (typeof val === 'object') return `{${Object.keys(val).length} keys}`
  return String(val)
}

// Get type color
function getTypeColor(val: unknown): string {
  if (val === null || val === undefined) return 'text-text-muted'
  if (typeof val === 'string') return 'text-green-400'
  if (typeof val === 'number') return 'text-blue-400'
  if (typeof val === 'boolean') return 'text-yellow-400'
  return 'text-text-secondary'
}

// Tree Node Component
function TreeNode({ node, depth = 0, showUnchanged }: { node: DiffNode; depth?: number; showUnchanged: boolean }) {
  const [isExpanded, setIsExpanded] = useState(depth < 3 || node.type !== 'unchanged')
  const hasChildren = node.children && node.children.length > 0

  if (!showUnchanged && node.type === 'unchanged' && !hasChildren) return null

  const filteredChildren = hasChildren
    ? node.children!.filter(c => showUnchanged || c.type !== 'unchanged' || c.children?.length)
    : []

  if (!showUnchanged && node.type === 'unchanged' && filteredChildren.length === 0) return null

  const diffColors = {
    added: 'bg-green-500/10 border-l-2 border-l-green-500',
    removed: 'bg-red-500/10 border-l-2 border-l-red-500',
    modified: 'bg-amber-500/5 border-l-2 border-l-amber-500',
    unchanged: ''
  }

  const diffIcons = {
    added: <Plus className="w-3 h-3 text-green-400" />,
    removed: <Minus className="w-3 h-3 text-red-400" />,
    modified: <PenLine className="w-3 h-3 text-amber-400" />,
    unchanged: null
  }

  return (
    <div className="font-mono text-xs">
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer transition-colors',
          diffColors[node.type]
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand/collapse arrow */}
        <span className="w-4 flex-shrink-0">
          {hasChildren ? (
            isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          ) : null}
        </span>

        {/* Diff indicator */}
        <span className="w-4 flex-shrink-0 flex items-center justify-center">
          {diffIcons[node.type]}
        </span>

        {/* Key */}
        <span className={cn(
          'font-medium',
          node.isArray ? 'text-blue-300' : 'text-purple-400'
        )}>
          {node.isArray ? `[${node.key}]` : node.key}
        </span>

        {/* Colon */}
        {!hasChildren && <span className="text-text-muted">:</span>}

        {/* Value display */}
        {!hasChildren && (
          <div className="flex items-center gap-2 ml-1 flex-1 overflow-hidden">
            {(node.type === 'removed' || node.type === 'modified') && (
              <span className={cn('line-through opacity-60', getTypeColor(node.valueA))}>
                {formatValue(node.valueA)}
              </span>
            )}
            {node.type === 'modified' && (
              <span className="text-text-muted">→</span>
            )}
            {(node.type === 'added' || node.type === 'modified') && (
              <span className={getTypeColor(node.valueB)}>
                {formatValue(node.valueB)}
              </span>
            )}
            {node.type === 'unchanged' && (
              <span className={getTypeColor(node.valueA)}>
                {formatValue(node.valueA)}
              </span>
            )}
          </div>
        )}

        {/* Collapsed preview */}
        {hasChildren && !isExpanded && (
          <span className="text-text-muted ml-1 text-[10px]">
            {node.isArray ? `[${filteredChildren.length}]` : `{${filteredChildren.length}}`}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {filteredChildren.map((child, i) => (
            <TreeNode key={`${child.path}-${i}`} node={child} depth={depth + 1} showUnchanged={showUnchanged} />
          ))}
        </div>
      )}
    </div>
  )
}

// Side by side JSON view
function SideBySideView({ jsonA, jsonB }: { jsonA: string; jsonB: string }) {
  const formatJson = (str: string): string => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2)
    } catch {
      return str
    }
  }

  const linesA = formatJson(jsonA).split('\n')
  const linesB = formatJson(jsonB).split('\n')
  const maxLines = Math.max(linesA.length, linesB.length)

  return (
    <div className="flex h-full">
      {/* Side A */}
      <div className="flex-1 border-r border-border overflow-auto">
        <div className="sticky top-0 bg-surface px-3 py-1.5 border-b border-border">
          <span className="text-[10px] font-bold text-accent">A - Original</span>
        </div>
        <pre className="p-3 text-xs font-mono">
          {linesA.map((line, i) => {
            const bLine = linesB[i] || ''
            const isDiff = line !== bLine
            return (
              <div
                key={i}
                className={cn(
                  'flex',
                  isDiff && line && 'bg-red-500/10'
                )}
              >
                <span className="w-8 text-right pr-2 text-text-muted/50 select-none border-r border-border mr-2">
                  {i + 1}
                </span>
                <span className={cn(
                  isDiff && line ? 'text-red-400' : 'text-text-primary'
                )}>
                  {line || ' '}
                </span>
              </div>
            )
          })}
        </pre>
      </div>

      {/* Side B */}
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-surface px-3 py-1.5 border-b border-border">
          <span className="text-[10px] font-bold text-secondary">B - Modified</span>
        </div>
        <pre className="p-3 text-xs font-mono">
          {Array.from({ length: maxLines }).map((_, i) => {
            const lineA = linesA[i] || ''
            const lineB = linesB[i] || ''
            const isDiff = lineA !== lineB
            return (
              <div
                key={i}
                className={cn(
                  'flex',
                  isDiff && lineB && 'bg-green-500/10'
                )}
              >
                <span className="w-8 text-right pr-2 text-text-muted/50 select-none border-r border-border mr-2">
                  {i + 1}
                </span>
                <span className={cn(
                  isDiff && lineB ? 'text-green-400' : 'text-text-primary'
                )}>
                  {lineB || ' '}
                </span>
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}

export function JsonTreeDiff({ jsonA, jsonB }: JsonTreeDiffProps) {
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [copied, setCopied] = useState<'a' | 'b' | null>(null)

  const diffTree = useMemo(() => {
    const parsedA = parseJSON(jsonA)
    const parsedB = parseJSON(jsonB)
    return buildDiffTree(parsedA, parsedB)
  }, [jsonA, jsonB])

  const stats = useMemo(() => {
    let added = 0, removed = 0, modified = 0, unchanged = 0
    const countNodes = (node: DiffNode) => {
      if (!node.children) {
        switch (node.type) {
          case 'added': added++; break
          case 'removed': removed++; break
          case 'modified': modified++; break
          case 'unchanged': unchanged++; break
        }
      } else {
        node.children.forEach(countNodes)
      }
    }
    countNodes(diffTree)
    return { added, removed, modified, unchanged, total: added + removed + modified + unchanged }
  }, [diffTree])

  const handleCopy = async (content: string, side: 'a' | 'b') => {
    try {
      const formatted = JSON.stringify(JSON.parse(content), null, 2)
      await navigator.clipboard.writeText(formatted)
    } catch {
      await navigator.clipboard.writeText(content)
    }
    setCopied(side)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Control Bar */}
      <div className="h-10 bg-surface border-b border-border flex items-center justify-between px-3">
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10">
              <Plus className="w-3 h-3 text-green-400" />
              <span className="text-green-400 font-medium">{stats.added}</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10">
              <Minus className="w-3 h-3 text-red-400" />
              <span className="text-red-400 font-medium">{stats.removed}</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10">
              <PenLine className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-medium">{stats.modified}</span>
            </span>
          </div>
          {stats.total > 0 && (
            <span className="text-[10px] text-text-muted">
              {stats.unchanged} unchanged
            </span>
          )}
        </div>

        {/* View controls */}
        <div className="flex items-center gap-2">
          {/* View mode */}
          <div className="flex items-center bg-background border border-border">
            <button
              onClick={() => setViewMode('tree')}
              className={cn(
                'px-2 py-1 text-[10px] font-medium transition-colors',
                viewMode === 'tree' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'
              )}
              title="Tree view"
            >
              <Layers className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={cn(
                'px-2 py-1 text-[10px] font-medium transition-colors',
                viewMode === 'side-by-side' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'
              )}
              title="Side by side"
            >
              <span className="text-[10px]">A|B</span>
            </button>
          </div>

          <div className="w-px h-5 bg-border" />

          {/* Show unchanged toggle */}
          <button
            onClick={() => setShowUnchanged(!showUnchanged)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium transition-colors',
              showUnchanged ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {showUnchanged ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Unchanged
          </button>

          <div className="w-px h-5 bg-border" />

          {/* Copy buttons */}
          <button
            onClick={() => handleCopy(jsonA, 'a')}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-accent transition-colors"
            title="Copy A"
          >
            {copied === 'a' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            <span className="text-accent">A</span>
          </button>
          <button
            onClick={() => handleCopy(jsonB, 'b')}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-secondary transition-colors"
            title="Copy B"
          >
            {copied === 'b' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            <span className="text-secondary">B</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'tree' ? (
          diffTree.children && diffTree.children.length > 0 ? (
            <div className="py-1">
              {diffTree.children.map((child, i) => (
                <TreeNode key={`${child.path}-${i}`} node={child} showUnchanged={showUnchanged} />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No JSON structure to compare</p>
              </div>
            </div>
          )
        ) : (
          <SideBySideView jsonA={jsonA} jsonB={jsonB} />
        )}
      </div>
    </div>
  )
}

export function isStructuredData(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return true
    } catch {
      return false
    }
  }
  const lines = trimmed.split('\n')
  const yamlLikeLines = lines.filter(line => /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(line))
  return yamlLikeLines.length > lines.length * 0.5
}
