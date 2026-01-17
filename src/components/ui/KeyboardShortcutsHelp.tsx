/**
 * Keyboard Shortcuts Help Modal (OpenCut Pattern)
 *
 * Shows all available keyboard shortcuts in a categorized modal
 */
import { useEffect, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutCategory {
  title: string
  shortcuts: ShortcutItem[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Comparison Modes',
    shortcuts: [
      { keys: ['1'], description: 'Slider mode' },
      { keys: ['2'], description: 'Side by Side mode' },
      { keys: ['3'], description: 'Audio mode' },
      { keys: ['4'], description: 'Prompt Diff mode' },
      { keys: ['5'], description: 'JSON Diff mode' },
      { keys: ['H'], description: 'Toggle slider visibility' },
    ],
  },
  {
    title: 'Playback',
    shortcuts: [
      { keys: ['Space', 'K'], description: 'Toggle play/pause' },
      { keys: ['J'], description: 'Shuttle backward (1x, 2x, 4x, 8x)' },
      { keys: ['L'], description: 'Shuttle forward (1x, 2x, 4x, 8x)' },
      { keys: ['←'], description: 'Frame step backward (when paused)' },
      { keys: ['→'], description: 'Frame step forward (when paused)' },
      { keys: ['Shift', '←'], description: 'Jump backward 5 seconds' },
      { keys: ['Shift', '→'], description: 'Jump forward 5 seconds' },
      { keys: ['Home'], description: 'Go to start' },
      { keys: ['End'], description: 'Go to end' },
    ],
  },
  {
    title: 'Timeline Editing',
    shortcuts: [
      { keys: ['S'], description: 'Split selected clip at playhead' },
      { keys: ['Q'], description: 'Keep left of playhead (trim right)' },
      { keys: ['W'], description: 'Keep right of playhead (trim left)' },
      { keys: ['Delete'], description: 'Delete selected clips' },
      { keys: ['Ctrl', 'A'], description: 'Select all clips' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate selected clip' },
      { keys: ['Ctrl', 'C'], description: 'Copy selected clip' },
      { keys: ['Ctrl', 'V'], description: 'Paste at playhead' },
      { keys: ['N'], description: 'Toggle snapping' },
      { keys: ['R'], description: 'Toggle ripple edit mode' },
    ],
  },
  {
    title: 'Loop Region',
    shortcuts: [
      { keys: ['I'], description: 'Set loop in-point' },
      { keys: ['O'], description: 'Set loop out-point' },
      { keys: ['Esc'], description: 'Clear loop region' },
    ],
  },
  {
    title: 'History',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['Ctrl', '+'], description: 'Zoom in timeline' },
      { keys: ['Ctrl', '-'], description: 'Zoom out timeline' },
      { keys: ['T'], description: 'Toggle timeline visibility' },
      { keys: ['B'], description: 'Toggle sidebar visibility' },
      { keys: ['E'], description: 'Open export dialog' },
    ],
  },
  {
    title: 'Markers & Metrics',
    shortcuts: [
      { keys: ['M'], description: 'Add marker at playhead' },
      { keys: ['Shift', 'M'], description: 'Toggle quality metrics overlay' },
      { keys: ['Shift', 'S'], description: 'Take screenshot' },
    ],
  },
  {
    title: 'Exposure Tools',
    shortcuts: [
      { keys: ['P'], description: 'Toggle Focus Peaking overlay' },
      { keys: ['Z'], description: 'Toggle Zebra Stripes overlay' },
      { keys: ['F'], description: 'Flip A/B sources (in Difference mode)' },
    ],
  },
  {
    title: 'Scopes (Difference Mode)',
    shortcuts: [
      { keys: ['G'], description: 'Toggle Gamut Warning overlay' },
    ],
  },
]

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title}>
                <h3 className="text-sm font-medium text-accent mb-3">
                  {category.title}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-text-secondary">
                        {shortcut.description}
                      </span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <span key={keyIndex}>
                            <kbd className={cn(
                              "px-2 py-0.5 text-xs font-mono rounded",
                              "bg-background border border-border text-text-primary"
                            )}>
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="mx-1 text-text-muted">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface-hover">
          <p className="text-xs text-text-muted text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-background border border-border rounded">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  )
}

// Hook to manage keyboard shortcuts help visibility
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Toggle with ? key
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  }
}
