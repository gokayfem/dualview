/**
 * TXT-001: Advanced Text Diff
 * TXT-002: Token Counter
 * TXT-003: Syntax Highlighting
 * TXT-004: JSON Tree Diff
 * Redesigned with elegant, professional UI
 */
import { useState, useMemo, useRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { cn } from '../../lib/utils'
import { JsonTreeDiff, isStructuredData } from './JsonTreeDiff'
import {
  Copy,
  Trash2,
  ArrowLeftRight,
  Check,
  FileText,
  Eye,
  Hash,
  Type,
  AlignLeft,
  List,
  GitCompare,
  Percent,
  Upload,
  FileJson
} from 'lucide-react'

type DiffMode = 'character' | 'word' | 'line' | 'tree'

interface DiffPart {
  type: 'equal' | 'added' | 'removed'
  text: string
  lineNumber?: number
}

// Character-level diff using LCS
function computeCharDiff(textA: string, textB: string): DiffPart[] {
  const result: DiffPart[] = []
  const charsA = textA.split('')
  const charsB = textB.split('')
  const m = charsA.length
  const n = charsB.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (charsA[i - 1] === charsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  let i = m, j = n
  const parts: DiffPart[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && charsA[i - 1] === charsB[j - 1]) {
      parts.unshift({ type: 'equal', text: charsA[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      parts.unshift({ type: 'added', text: charsB[j - 1] })
      j--
    } else if (i > 0) {
      parts.unshift({ type: 'removed', text: charsA[i - 1] })
      i--
    }
  }

  for (const part of parts) {
    if (result.length > 0 && result[result.length - 1].type === part.type) {
      result[result.length - 1].text += part.text
    } else {
      result.push({ ...part })
    }
  }
  return result
}

// Word-level diff
function computeWordDiff(textA: string, textB: string): DiffPart[] {
  const wordsA = textA.split(/(\s+)/)
  const wordsB = textB.split(/(\s+)/)
  const result: DiffPart[] = []
  const m = wordsA.length
  const n = wordsB.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  let i = m, j = n
  const parts: DiffPart[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      parts.unshift({ type: 'equal', text: wordsA[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      parts.unshift({ type: 'added', text: wordsB[j - 1] })
      j--
    } else if (i > 0) {
      parts.unshift({ type: 'removed', text: wordsA[i - 1] })
      i--
    }
  }

  for (const part of parts) {
    if (result.length > 0 && result[result.length - 1].type === part.type) {
      result[result.length - 1].text += part.text
    } else {
      result.push({ ...part })
    }
  }
  return result
}

// Line-level diff
function computeLineDiff(textA: string, textB: string): DiffPart[] {
  const linesA = textA.split('\n')
  const linesB = textB.split('\n')
  const m = linesA.length
  const n = linesB.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  let i = m, j = n
  const parts: DiffPart[] = []
  let lineNumA = linesA.length
  let lineNumB = linesB.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      parts.unshift({ type: 'equal', text: linesA[i - 1] + '\n', lineNumber: lineNumA })
      i--; j--; lineNumA--; lineNumB--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      parts.unshift({ type: 'added', text: linesB[j - 1] + '\n', lineNumber: lineNumB })
      j--; lineNumB--
    } else if (i > 0) {
      parts.unshift({ type: 'removed', text: linesA[i - 1] + '\n', lineNumber: lineNumA })
      i--; lineNumA--
    }
  }
  return parts
}

function detectLanguage(text: string): string | null {
  if (/^{[\s\S]*}$/.test(text.trim()) || /^\[[\s\S]*\]$/.test(text.trim())) return 'JSON'
  if (/function\s+\w+|const\s+\w+\s*=|=>|import\s+.*from/.test(text)) return 'JavaScript'
  if (/def\s+\w+|import\s+\w+|from\s+\w+\s+import/.test(text)) return 'Python'
  if (/\.([\w-]+)\s*\{|@media|#[\w-]+\s*\{/.test(text)) return 'CSS'
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return 'HTML'
  return null
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function calculateSimilarity(textA: string, textB: string): number {
  if (!textA && !textB) return 100
  if (!textA || !textB) return 0
  const wordsA = textA.toLowerCase().split(/\s+/).filter(Boolean)
  const wordsB = textB.toLowerCase().split(/\s+/).filter(Boolean)
  if (wordsA.length === 0 && wordsB.length === 0) return 100
  if (wordsA.length === 0 || wordsB.length === 0) return 0
  const setA = new Set(wordsA)
  const setB = new Set(wordsB)
  let intersection = 0
  setA.forEach(word => { if (setB.has(word)) intersection++ })
  const union = new Set([...wordsA, ...wordsB]).size
  return Math.round((intersection / union) * 100)
}

// Toggle button component
function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
  title
}: {
  active: boolean
  onClick: () => void
  icon: typeof Eye
  label: string
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title || label}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium transition-all',
        active
          ? 'bg-accent/20 text-accent'
          : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  )
}

export function PromptDiff() {
  const { promptA, promptB, setPromptA, setPromptB } = useProjectStore()
  const [diffMode, setDiffMode] = useState<DiffMode>('word')
  const [showWhitespace, setShowWhitespace] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [copiedA, setCopiedA] = useState(false)
  const [copiedB, setCopiedB] = useState(false)
  const [focusedPanel, setFocusedPanel] = useState<'a' | 'b' | null>(null)

  // File upload refs
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

      // Auto-switch to tree mode if JSON is detected
      if (isStructuredData(content)) {
        setDiffMode('tree')
      }
    }
    reader.readAsText(file)

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const similarity = useMemo(() => calculateSimilarity(promptA || '', promptB || ''), [promptA, promptB])

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

  const diffParts = useMemo(() => {
    if (!promptA && !promptB) return []
    const a = promptA || ''
    const b = promptB || ''
    switch (diffMode) {
      case 'character': return computeCharDiff(a, b)
      case 'line': return computeLineDiff(a, b)
      default: return computeWordDiff(a, b)
    }
  }, [promptA, promptB, diffMode])

  const stats = useMemo(() => {
    let added = 0, removed = 0
    diffParts.forEach(part => {
      const content = part.text.trim()
      if (part.type === 'added') added += content.split(/\s+/).filter(Boolean).length || (content.length > 0 ? 1 : 0)
      if (part.type === 'removed') removed += content.split(/\s+/).filter(Boolean).length || (content.length > 0 ? 1 : 0)
    })
    return { added, removed }
  }, [diffParts])

  const languageA = useMemo(() => detectLanguage(promptA || ''), [promptA])
  const languageB = useMemo(() => detectLanguage(promptB || ''), [promptB])
  const tokensA = useMemo(() => estimateTokens(promptA || ''), [promptA])
  const tokensB = useMemo(() => estimateTokens(promptB || ''), [promptB])
  const wordsA = (promptA || '').trim().split(/\s+/).filter(Boolean).length
  const wordsB = (promptB || '').trim().split(/\s+/).filter(Boolean).length
  const charsA = (promptA || '').length
  const charsB = (promptB || '').length
  const isStructured = useMemo(() => isStructuredData(promptA || '') || isStructuredData(promptB || ''), [promptA, promptB])

  const renderWhitespace = (text: string) => {
    if (!showWhitespace) return text
    return text.replace(/ /g, '·').replace(/\t/g, '→   ').replace(/\n/g, '↵\n')
  }

  const diffModes: { mode: DiffMode; icon: typeof Type; label: string }[] = [
    { mode: 'character', icon: Type, label: 'Char' },
    { mode: 'word', icon: AlignLeft, label: 'Word' },
    { mode: 'line', icon: List, label: 'Line' },
  ]

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Top Control Bar */}
      <div className="h-12 bg-surface border-b border-border flex items-center justify-between px-4">
        {/* Left: Diff mode selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium">DIFF MODE</span>
          <div className="flex items-center bg-background border border-border">
            {diffModes.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setDiffMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all',
                  diffMode === mode
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
            {isStructured && (
              <button
                onClick={() => setDiffMode('tree')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all',
                  diffMode === 'tree'
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                <GitCompare className="w-3 h-3" />
                Tree
              </button>
            )}
          </div>
        </div>

        {/* Center: Similarity & Stats */}
        <div className="flex items-center gap-4">
          {(promptA || promptB) && (
            <>
              <div className="flex items-center gap-2">
                <Percent className="w-3 h-3 text-text-muted" />
                <span className="text-xs text-text-muted">Similarity</span>
                <span className={cn(
                  'text-sm font-bold tabular-nums px-2 py-0.5',
                  similarity >= 80 ? 'bg-green-500/20 text-green-400' :
                  similarity >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                )}>
                  {similarity}%
                </span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span className="text-red-400 font-medium">−{stats.removed}</span>
                <span className="text-green-400 font-medium">+{stats.added}</span>
              </div>
            </>
          )}
        </div>

        {/* Right: View options */}
        <div className="flex items-center gap-1">
          <ToggleButton
            active={showLineNumbers}
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            icon={Hash}
            label="Lines"
            title="Show line numbers"
          />
          <ToggleButton
            active={showWhitespace}
            onClick={() => setShowWhitespace(!showWhitespace)}
            icon={Eye}
            label="Spaces"
            title="Show whitespace"
          />
        </div>
      </div>

      {/* Editor Panels */}
      <div className="flex-1 flex min-h-0">
        {/* Panel A */}
        <div className={cn(
          'flex-1 flex flex-col border-r border-border transition-all',
          focusedPanel === 'a' && 'bg-accent/5'
        )}>
          {/* Panel A Header */}
          <div className="h-10 bg-surface/50 border-b border-border flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-accent flex items-center justify-center text-white text-xs font-bold">A</span>
              <span className="text-xs font-medium text-text-secondary">Original</span>
              {languageA && (
                <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 font-medium">
                  {languageA}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-[10px] text-text-muted tabular-nums">
                <span>{wordsA} words</span>
                <span>{charsA} chars</span>
                <span className="text-accent">~{tokensA} tokens</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-0.5">
                <input
                  ref={fileInputARef}
                  type="file"
                  accept=".json,.txt,.md,.js,.ts,.jsx,.tsx,.py,.css,.html,.xml,.yaml,.yml"
                  onChange={handleFileUpload('a')}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputARef.current?.click()}
                  className="p-1.5 transition-colors text-text-muted hover:text-accent hover:bg-surface-hover"
                  title="Upload file (JSON, TXT, etc.)"
                >
                  <Upload className="w-3.5 h-3.5" />
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
          </div>

          {/* Panel A Editor */}
          <div className="flex-1 flex min-h-0 relative">
            {showLineNumbers && promptA && (
              <div className="w-10 bg-surface/30 border-r border-border py-3 text-right pr-2 text-[10px] text-text-muted select-none font-mono overflow-hidden">
                {(promptA || '').split('\n').map((_, i) => (
                  <div key={i} className="h-5 leading-5">{i + 1}</div>
                ))}
              </div>
            )}
            <textarea
              value={promptA || ''}
              onChange={(e) => setPromptA(e.target.value)}
              onFocus={() => setFocusedPanel('a')}
              onBlur={() => setFocusedPanel(null)}
              placeholder="Paste your original text here..."
              className="flex-1 w-full p-3 bg-transparent text-text-primary text-sm resize-none focus:outline-none font-mono leading-5"
              spellCheck={false}
            />
            {/* Empty state */}
            {!promptA && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 text-text-muted">
                  <div className="w-14 h-14 bg-accent/10 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-accent/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-secondary">Original Text</p>
                    <p className="text-xs mt-1">Paste, type, or upload a file</p>
                    <p className="text-[10px] mt-2 text-text-muted/60 flex items-center justify-center gap-1">
                      <FileJson className="w-3 h-3" />
                      JSON files auto-switch to Tree view
                    </p>
                  </div>
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

        {/* Panel B */}
        <div className={cn(
          'flex-1 flex flex-col transition-all',
          focusedPanel === 'b' && 'bg-secondary/5'
        )}>
          {/* Panel B Header */}
          <div className="h-10 bg-surface/50 border-b border-border flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-secondary flex items-center justify-center text-black text-xs font-bold">B</span>
              <span className="text-xs font-medium text-text-secondary">Modified</span>
              {languageB && (
                <span className="text-[10px] text-secondary bg-secondary/10 px-1.5 py-0.5 font-medium">
                  {languageB}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-[10px] text-text-muted tabular-nums">
                <span>{wordsB} words</span>
                <span>{charsB} chars</span>
                <span className="text-secondary">~{tokensB} tokens</span>
                {tokensB !== tokensA && (promptA || promptB) && (
                  <span className={cn(
                    'font-medium',
                    tokensB > tokensA ? 'text-green-400' : 'text-red-400'
                  )}>
                    ({tokensB > tokensA ? '+' : ''}{tokensB - tokensA})
                  </span>
                )}
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-0.5">
                <input
                  ref={fileInputBRef}
                  type="file"
                  accept=".json,.txt,.md,.js,.ts,.jsx,.tsx,.py,.css,.html,.xml,.yaml,.yml"
                  onChange={handleFileUpload('b')}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputBRef.current?.click()}
                  className="p-1.5 transition-colors text-text-muted hover:text-secondary hover:bg-surface-hover"
                  title="Upload file (JSON, TXT, etc.)"
                >
                  <Upload className="w-3.5 h-3.5" />
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
          </div>

          {/* Panel B Editor */}
          <div className="flex-1 flex min-h-0 relative">
            {showLineNumbers && promptB && (
              <div className="w-10 bg-surface/30 border-r border-border py-3 text-right pr-2 text-[10px] text-text-muted select-none font-mono overflow-hidden">
                {(promptB || '').split('\n').map((_, i) => (
                  <div key={i} className="h-5 leading-5">{i + 1}</div>
                ))}
              </div>
            )}
            <textarea
              value={promptB || ''}
              onChange={(e) => setPromptB(e.target.value)}
              onFocus={() => setFocusedPanel('b')}
              onBlur={() => setFocusedPanel(null)}
              placeholder="Paste your modified text here..."
              className="flex-1 w-full p-3 bg-transparent text-text-primary text-sm resize-none focus:outline-none font-mono leading-5"
              spellCheck={false}
            />
            {/* Empty state */}
            {!promptB && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 text-text-muted">
                  <div className="w-14 h-14 bg-secondary/10 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-secondary/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-secondary">Modified Text</p>
                    <p className="text-xs mt-1">Paste, type, or upload a file</p>
                    <p className="text-[10px] mt-2 text-text-muted/60 flex items-center justify-center gap-1">
                      <FileJson className="w-3 h-3" />
                      JSON files auto-switch to Tree view
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diff View */}
      <div className="h-[40%] border-t border-border flex flex-col bg-surface/30">
        {/* Diff Header */}
        <div className="h-8 bg-surface border-b border-border flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-medium text-text-secondary">Diff Output</span>
          </div>
          {diffParts.length > 0 && (
            <span className="text-[10px] text-text-muted">
              {diffParts.filter(p => p.type !== 'equal').length} changes
            </span>
          )}
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto">
          {diffParts.length === 0 && diffMode !== 'tree' ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-text-muted">
                <GitCompare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Enter text in both panels to see differences</p>
              </div>
            </div>
          ) : diffMode === 'tree' ? (
            <JsonTreeDiff jsonA={promptA || ''} jsonB={promptB || ''} />
          ) : diffMode === 'line' ? (
            <div className="font-mono text-sm">
              {diffParts.map((part, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex',
                    part.type === 'added' && 'bg-green-500/10',
                    part.type === 'removed' && 'bg-red-500/10'
                  )}
                >
                  {showLineNumbers && (
                    <div className="w-12 text-right pr-2 text-text-muted/50 text-[10px] select-none border-r border-border py-0.5 tabular-nums">
                      {part.lineNumber}
                    </div>
                  )}
                  <div className="w-6 text-center text-xs select-none py-0.5 font-bold">
                    {part.type === 'added' && <span className="text-green-400">+</span>}
                    {part.type === 'removed' && <span className="text-red-400">−</span>}
                  </div>
                  <pre className={cn(
                    'flex-1 px-2 py-0.5 whitespace-pre-wrap',
                    part.type === 'added' && 'text-green-400',
                    part.type === 'removed' && 'text-red-400 line-through opacity-70',
                    part.type === 'equal' && 'text-text-primary/70'
                  )}>
                    {showWhitespace ? renderWhitespace(part.text) : part.text}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm leading-relaxed font-mono whitespace-pre-wrap">
              {diffParts.map((part, index) => (
                <span
                  key={index}
                  className={cn(
                    part.type === 'added' && 'bg-green-500/20 text-green-400 px-0.5',
                    part.type === 'removed' && 'bg-red-500/20 text-red-400 line-through px-0.5',
                    part.type === 'equal' && 'text-text-primary'
                  )}
                >
                  {showWhitespace ? renderWhitespace(part.text) : part.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
