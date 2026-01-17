import { useState, useRef, useEffect } from 'react'
import { Button } from '../ui'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { useHistoryStore } from '../../stores/historyStore'
import { MetadataComparison } from './MetadataComparison'
import {
  Play,
  Pause,
  Download,
  Undo2,
  Redo2,
  Layers,
  SplitSquareHorizontal,
  Blend,
  Columns2,
  FileText,
  Braces,
  Zap,
  Flame,
  AudioLines,
  ChevronDown,
  Keyboard,
  Sparkles,
  Menu,
  X,
  Box,
  Microscope,
  // MODE-001 to MODE-005: New comparison mode icons
  Grid2X2,
  Circle,
  Grid,
  Shrink,
  // Document comparison icon
  FileSpreadsheet,
} from 'lucide-react'
import type { ComparisonMode } from '../../types'

interface ModeConfig {
  mode: ComparisonMode
  icon: typeof Layers
  label: string
  shortcut?: string
  description?: string
}

// Serial Position Effect: Most important modes first and last
// Users remember first and last items better (primacy/recency effect)
const mainModes: ModeConfig[] = [
  { mode: 'slider', icon: SplitSquareHorizontal, label: 'Slider', shortcut: '1', description: 'Drag to compare' },
  { mode: 'side-by-side', icon: Columns2, label: 'Side by Side', shortcut: '2', description: 'View both at once' },
  { mode: 'webgl-compare', icon: Microscope, label: 'Difference', shortcut: '3', description: 'Advanced difference analysis' },
  { mode: 'audio', icon: AudioLines, label: 'Audio', shortcut: '4', description: 'Compare waveforms' },
  { mode: 'prompt-diff', icon: FileText, label: 'Prompt', shortcut: '5', description: 'Compare text/prompts' },
  { mode: 'json-diff', icon: Braces, label: 'JSON', shortcut: '6', description: 'Compare JSON data' },
  { mode: 'model-3d', icon: Box, label: '3D', shortcut: '7', description: 'Compare GLB/GLTF models' },
  { mode: 'document', icon: FileSpreadsheet, label: 'Document', shortcut: '8', description: 'Compare CSV, Excel, DOCX, PDF' },
]

// Additional modes in dropdown - grouped by use case (Law of Common Region)
const moreModes: { name: string; description: string; modes: ModeConfig[] }[] = [
  {
    name: 'Multi-View',
    description: 'View multiple angles',
    modes: [
      { mode: 'split', icon: Layers, label: 'Split Screen', description: '2x2 grid layout' },
      { mode: 'quad', icon: Grid2X2, label: 'Quad View', shortcut: 'Q', description: '4-way comparison (MODE-001)' },
    ],
  },
  {
    name: 'Analysis Tools',
    description: 'Deep inspection',
    modes: [
      { mode: 'blend', icon: Blend, label: 'Blend Modes', description: 'Overlay comparisons' },
      { mode: 'flicker', icon: Zap, label: 'Flicker', description: 'Rapid A/B switch' },
      { mode: 'heatmap', icon: Flame, label: 'Heatmap', description: 'See pixel differences' },
      { mode: 'radial-loupe', icon: Circle, label: 'Radial Loupe', shortcut: 'R', description: 'Magnifier comparison (MODE-002)' },
      { mode: 'grid-tile', icon: Grid, label: 'Grid Tile', shortcut: 'G', description: 'Checkerboard A/B (MODE-003)' },
      { mode: 'morphological', icon: Shrink, label: 'Morphological', shortcut: 'M', description: 'Apply morph operations (MODE-005)' },
    ],
  },
]

// Flatten for checking if current mode is in "more"
const moreModesFlat = moreModes.flatMap(c => c.modes)

interface HeaderProps {
  onExport?: () => void
  onShowShortcuts?: () => void
  onToggleSidebar?: () => void
  onOpenProjects?: () => void
}

export function Header({ onExport, onShowShortcuts, onToggleSidebar }: HeaderProps) {
  const { comparisonMode, setComparisonMode } = useProjectStore()
  const { isPlaying, togglePlay } = useTimelineStore()
  const { undo, redo, canUndo, canRedo } = useHistoryStore()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.classList.add('body-no-scroll')
    } else {
      document.body.classList.remove('body-no-scroll')
    }
    return () => document.body.classList.remove('body-no-scroll')
  }, [showMobileMenu])

  // All modes combined for mobile menu
  const allModes = [...mainModes, ...moreModesFlat]

  // Check if current mode is in the "more" dropdown
  const isMoreModeActive = moreModesFlat.some(m => m.mode === comparisonMode)
  const activeMoreMode = moreModesFlat.find(m => m.mode === comparisonMode)

  // Get current mode info for mobile display
  const currentMode = allModes.find(m => m.mode === comparisonMode) || mainModes[0]
  const CurrentModeIcon = currentMode.icon

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-2 md:px-3">
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Mobile hamburger menu */}
          <button
            onClick={onToggleSidebar}
            className="show-mobile p-1.5 -ml-1 text-text-muted hover:text-text-primary"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          <h1 className="text-base font-bold text-text-primary">DualView</h1>

          <div className="h-5 w-px bg-border hide-mobile" />

          <div className="flex items-center gap-0.5 hide-mobile">
            <Button
              variant="ghost"
              size="icon"
              title="Undo (Ctrl+Z)"
              onClick={undo}
              disabled={!canUndo()}
              className={`w-7 h-7 ${!canUndo() ? 'opacity-40' : ''}`}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Redo (Ctrl+Shift+Z)"
              onClick={redo}
              disabled={!canRedo()}
              className={`w-7 h-7 ${!canRedo() ? 'opacity-40' : ''}`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Mobile mode selector button */}
        <button
          onClick={() => setShowMobileMenu(true)}
          className="show-mobile flex items-center gap-2 px-3 py-2 bg-surface-hover border border-border"
        >
          <CurrentModeIcon className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">{currentMode.label}</span>
          <ChevronDown className="w-3 h-3 text-text-muted" />
        </button>

        {/* Mode selector - main buttons + more dropdown (hidden on mobile)
            Miller's Law: Chunked into 5 main + overflow
            Serial Position Effect: Most used first, advanced last
            Fitts's Law: Good sized touch targets */}
        <div className="hide-mobile flex items-center gap-0.5" role="tablist" aria-label="Comparison modes">
          {/* Main mode buttons with tooltips */}
          {mainModes.map(({ mode, icon: Icon, label, shortcut, description }, index) => (
            <div key={mode} className="relative group">
              <Button
                variant={comparisonMode === mode ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setComparisonMode(mode)}
                className={`gap-1 px-2 h-7 text-xs relative transition-all duration-150 ${
                  comparisonMode === mode
                    ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(255,87,34,0.3)]'
                    : 'hover:bg-surface-hover'
                } ${index === 0 ? 'primary-glow' : ''}`}
                aria-selected={comparisonMode === mode}
                role="tab"
              >
                <Icon className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                  comparisonMode === mode ? 'text-accent' : ''
                }`} />
                <span className="hidden lg:inline">{label}</span>
                {/* Von Restorff Effect: Active indicator stands out */}
                {comparisonMode === mode && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-accent animate-in" />
                )}
              </Button>
              {/* Tooltip with description - Postel's Law: Help users understand */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1.5 bg-surface border border-border shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap pointer-events-none">
                <div className="text-[11px] font-medium text-text-primary">{label}</div>
                <div className="text-[9px] text-text-muted mt-0.5">{description}</div>
                {shortcut && (
                  <div className="flex items-center gap-1 mt-1">
                    <kbd className="kbd text-[9px]">{shortcut}</kbd>
                    <span className="text-[8px] text-text-muted">to switch</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Visual divider - Law of Common Region: Groups related items */}
          <div className="w-px h-4 bg-border mx-0.5" />

          {/* More dropdown - Hick's Law: Progressive disclosure of less-used options */}
          <div className="relative group" ref={menuRef}>
            <Button
              variant={isMoreModeActive ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`gap-1 px-2 h-7 text-xs ${isMoreModeActive ? 'bg-accent/15 text-accent' : ''}`}
            >
              {isMoreModeActive && activeMoreMode ? (
                <>
                  <activeMoreMode.icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{activeMoreMode.label}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">More</span>
                </>
              )}
              <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${showMoreMenu ? 'rotate-180' : ''}`} />
            </Button>

            {/* Dropdown menu with Law of Common Region grouping */}
            {showMoreMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-surface border border-border shadow-2xl z-50 py-2 animate-slide-down">
                {/* Header hint - Paradox of Active User */}
                <div className="px-3 py-2 border-b border-border mb-2">
                  <div className="text-[10px] text-text-muted">
                    Advanced comparison tools for detailed analysis
                  </div>
                </div>
                {moreModes.map((category, idx) => (
                  <div key={category.name}>
                    {idx > 0 && <div className="h-px bg-border my-2" />}
                    <div className="px-3 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">
                        {category.name}
                      </div>
                      <div className="text-[9px] text-text-muted mt-0.5">{category.description}</div>
                    </div>
                    {category.modes.map(({ mode, icon: Icon, label, description }) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setComparisonMode(mode)
                          setShowMoreMenu(false)
                        }}
                        className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-surface-hover text-left transition-colors ${
                          comparisonMode === mode ? 'bg-accent/10 text-accent' : 'text-text-primary'
                        }`}
                      >
                        <div className={`w-8 h-8 flex items-center justify-center ${
                          comparisonMode === mode ? 'bg-accent/20' : 'bg-surface-alt'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{label}</div>
                          {description && (
                            <div className="text-[10px] text-text-muted truncate">{description}</div>
                          )}
                        </div>
                        {comparisonMode === mode && (
                          <span className="w-2 h-2 bg-accent" />
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Metadata Comparison - hidden on mobile */}
        <div className="hide-mobile">
          <MetadataComparison />
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            title="Keyboard Shortcuts (?)"
            onClick={onShowShortcuts}
            className="hide-mobile w-7 h-7"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </Button>

          <div className="h-4 w-px bg-border mx-0.5 hide-mobile" />

          {/* Play/Pause with clear feedback - Doherty Threshold */}
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1 px-2 h-7 text-xs group transition-all duration-150 ${isPlaying ? 'bg-accent/10 text-accent' : ''}`}
            onClick={togglePlay}
            title="Toggle playback (Space)"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 animate-pulse-subtle" />
            ) : (
              <Play className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            )}
            <span className="hidden xl:inline">{isPlaying ? 'Pause' : 'Play'}</span>
          </Button>

          {/* Export button - Von Restorff Effect: Primary action stands out */}
          <Button
            size="sm"
            className="gap-1 px-2 md:px-3 h-7 text-xs bg-accent hover:bg-accent-hover text-white group primary-glow relative overflow-hidden"
            onClick={onExport}
            title="Export (E)"
          >
            {/* Subtle shine effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
            <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform relative z-10" />
            <span className="hidden md:inline relative z-10">Export</span>
          </Button>
        </div>

        {/* Mobile mode menu - bottom sheet */}
        {showMobileMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowMobileMenu(false)}
            />
            {/* Menu */}
            <div
              ref={mobileMenuRef}
              className="mobile-mode-menu safe-area-bottom"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">Comparison Mode</h3>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="p-2 text-text-muted hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 grid grid-cols-2 gap-2">
                {allModes.map(({ mode, icon: Icon, label, description }) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setComparisonMode(mode)
                      setShowMobileMenu(false)
                    }}
                    className={`p-4 flex flex-col items-center gap-2 text-center transition-colors ${
                      comparisonMode === mode
                        ? 'bg-accent/15 text-accent border-2 border-accent'
                        : 'bg-surface-alt border border-border hover:border-accent/50'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-sm font-medium">{label}</span>
                    {description && (
                      <span className="text-[10px] text-text-muted">{description}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
    </header>
  )
}
