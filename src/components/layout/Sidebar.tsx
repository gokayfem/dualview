import { useState, useEffect } from 'react'
import { Select, Slider, AspectRatioSelector, Button } from '../ui'
import { useProjectStore } from '../../stores/projectStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePersistenceStore } from '../../stores/persistenceStore'
import { MediaUpload } from '../media/MediaUpload'
import { MediaLibrary } from '../media/MediaLibrary'
import {
  FolderOpen,
  Settings,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  X,
  Microscope,
  Save,
} from 'lucide-react'
import type { BlendMode, SplitLayout, ExportSettings, WebGLComparisonMode } from '../../types'
import { getAllComparisonCategories, getComparisonModeInfo } from '../../lib/webgl/comparison-shaders'

type Tab = 'media' | 'settings'

interface SidebarProps {
  onCollapse?: () => void
  isMobileOpen?: boolean
  onMobileClose?: () => void
  onOpenProjects?: () => void
}

export function Sidebar({ onCollapse, isMobileOpen, onMobileClose, onOpenProjects }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('media')
  const { saveCurrentProject, saveStatus, projectMetadata } = usePersistenceStore()
  const {
    comparisonMode,
    blendMode,
    setBlendMode,
    splitLayout,
    setSplitLayout,
    sliderPosition,
    setSliderPosition,
    sliderOrientation,
    setSliderOrientation,
    hideSlider,
    toggleHideSlider,
    exportSettings,
    setExportSettings,
    webglComparisonSettings,
    setWebGLComparisonMode,
    setWebGLComparisonSettings,
  } = useProjectStore()

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.classList.add('body-no-scroll')
    } else {
      document.body.classList.remove('body-no-scroll')
    }
    return () => document.body.classList.remove('body-no-scroll')
  }, [isMobileOpen])

  // Desktop sidebar
  const sidebarContent = (
    <aside className={`
      bg-surface border-r border-border flex flex-col
      ${isMobileOpen ? 'mobile-drawer animate-slide-in-left' : 'w-72 hide-mobile'}
    `}>
      {/* Project controls - at top of sidebar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-surface-alt/50">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            title="Open Projects"
            onClick={onOpenProjects}
            className="h-7 px-2 gap-1.5 text-xs"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Projects</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Save Project (Ctrl+S)"
            onClick={() => saveCurrentProject()}
            disabled={saveStatus === 'saving' || !projectMetadata}
            className={`h-7 px-2 gap-1.5 text-xs ${saveStatus === 'saving' ? 'animate-pulse' : ''}`}
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
        {saveStatus === 'saved' && (
          <span className="text-[10px] text-text-muted">Saved</span>
        )}
        {saveStatus === 'saving' && (
          <span className="text-[10px] text-accent">Saving...</span>
        )}
      </div>

      {/* Tab navigation - Jakob's Law: Familiar tab pattern */}
      <div className="flex border-b border-border shrink-0">
        {/* Mobile close button */}
        {isMobileOpen && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="px-3 py-3 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
            title="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button
          className={`flex-1 py-3 text-sm font-medium transition-all duration-150 relative ${
            activeTab === 'media'
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('media')}
        >
          <FolderOpen className={`w-4 h-4 inline-block mr-2 transition-transform ${activeTab === 'media' ? 'scale-110' : ''}`} />
          Media
          {/* Active indicator - Von Restorff Effect */}
          {activeTab === 'media' && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent" />
          )}
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium transition-all duration-150 relative ${
            activeTab === 'settings'
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings className={`w-4 h-4 inline-block mr-2 transition-transform ${activeTab === 'settings' ? 'scale-110' : ''}`} />
          Settings
          {activeTab === 'settings' && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent" />
          )}
        </button>
        {onCollapse && !isMobileOpen && (
          <button
            onClick={onCollapse}
            className="px-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all duration-150 group hide-mobile"
            title="Collapse Sidebar (B)"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'media' && <MediaPanel />}
        {activeTab === 'settings' && (
          <SettingsPanel
            comparisonMode={comparisonMode}
            blendMode={blendMode}
            setBlendMode={setBlendMode}
            splitLayout={splitLayout}
            setSplitLayout={setSplitLayout}
            sliderPosition={sliderPosition}
            setSliderPosition={setSliderPosition}
            sliderOrientation={sliderOrientation}
            setSliderOrientation={setSliderOrientation}
            hideSlider={hideSlider}
            toggleHideSlider={toggleHideSlider}
            exportSettings={exportSettings}
            setExportSettings={setExportSettings}
            webglComparisonSettings={webglComparisonSettings}
            setWebGLComparisonMode={setWebGLComparisonMode}
            setWebGLComparisonSettings={setWebGLComparisonSettings}
          />
        )}
      </div>

      {/* Social links - moved from footer */}
      <div className="shrink-0 p-3 border-t border-border/50 bg-background/50 safe-area-bottom">
        <div className="flex items-center justify-center gap-5">
          <a
            href="https://huggingface.co/gokaygokay"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted/50 hover:text-amber-500 transition-colors flex items-center justify-center w-5 h-5"
            title="Hugging Face"
          >
            <svg className="w-5 h-5" viewBox="0 0 120 120" fill="currentColor">
              <path d="M60 0C26.9 0 0 26.9 0 60s26.9 60 60 60 60-26.9 60-60S93.1 0 60 0zm0 110C32.4 110 10 87.6 10 60S32.4 10 60 10s50 22.4 50 50-22.4 50-50 50z"/>
              <circle cx="40" cy="50" r="8"/>
              <circle cx="80" cy="50" r="8"/>
              <path d="M60 85c-11 0-20-9-20-20h40c0 11-9 20-20 20z"/>
            </svg>
          </a>
          <a
            href="https://github.com/gokayfem"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted/50 hover:text-text-primary transition-colors flex items-center justify-center w-5 h-5"
            title="GitHub"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <a
            href="https://x.com/gokayfem"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted/50 hover:text-text-primary transition-colors flex items-center justify-center w-5 h-5"
            title="X (Twitter)"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </div>
    </aside>
  )

  // Mobile: render with overlay backdrop
  if (isMobileOpen) {
    return (
      <>
        <div
          className="mobile-drawer-overlay"
          onClick={onMobileClose}
        />
        {sidebarContent}
      </>
    )
  }

  // Desktop: render normally
  return sidebarContent
}

function MediaPanel() {
  const { tracks } = useTimelineStore()

  // Zeigarnik Effect - Show comparison readiness
  const trackA = tracks.find((t: { type: string }) => t.type === 'a')
  const trackB = tracks.find((t: { type: string }) => t.type === 'b')
  const hasMediaA = trackA && trackA.clips?.length > 0
  const hasMediaB = trackB && trackB.clips?.length > 0
  const completionSteps = [hasMediaA, hasMediaB].filter(Boolean).length
  const isReady = completionSteps === 2

  return (
    <div className="space-y-4">
      {/* Comparison readiness indicator - Zeigarnik Effect + Goal-Gradient Effect */}
      <div className={`p-3 border transition-all duration-300 ${
        isReady
          ? 'bg-accent/10 border-accent/30'
          : 'bg-surface-alt border-border'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-secondary">
            {isReady ? '✓ Ready to Compare' : 'Setup Progress'}
          </span>
          <span className={`text-xs font-mono ${isReady ? 'text-accent' : 'text-text-muted'}`}>
            {completionSteps}/2
          </span>
        </div>
        {/* Progress bar with animation */}
        <div className="flex gap-1 mb-2">
          <div className={`flex-1 h-1.5 transition-all duration-300 ${
            hasMediaA ? 'bg-accent' : 'bg-border animate-pulse-subtle'
          }`} />
          <div className={`flex-1 h-1.5 transition-all duration-300 ${
            hasMediaB ? 'bg-secondary' : 'bg-border animate-pulse-subtle'
          }`} />
        </div>
        <div className="flex justify-between text-[10px]">
          <span className={`flex items-center gap-1 ${hasMediaA ? 'text-accent' : 'text-text-muted'}`}>
            {hasMediaA ? '● Media A' : '○ Add Media A'}
          </span>
          <span className={`flex items-center gap-1 ${hasMediaB ? 'text-secondary' : 'text-text-muted'}`}>
            {hasMediaB ? '● Media B' : '○ Add Media B'}
          </span>
        </div>
        {/* Helpful hint - Paradox of Active User */}
        {!isReady && (
          <p className="text-[10px] text-text-muted mt-2 pt-2 border-t border-border/50">
            💡 Drag files or paste URLs to add media
          </p>
        )}
      </div>

      <MediaUpload />

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
          Library
          <kbd className="kbd text-[9px]">B</kbd>
        </h3>
        <MediaLibrary />
      </div>
    </div>
  )
}

interface SettingsPanelProps {
  comparisonMode: string
  blendMode: BlendMode
  setBlendMode: (mode: BlendMode) => void
  splitLayout: SplitLayout
  setSplitLayout: (layout: SplitLayout) => void
  sliderPosition: number
  setSliderPosition: (position: number) => void
  sliderOrientation: 'vertical' | 'horizontal'
  setSliderOrientation: (orientation: 'vertical' | 'horizontal') => void
  hideSlider: boolean
  toggleHideSlider: () => void
  exportSettings: ExportSettings
  setExportSettings: (settings: Partial<ExportSettings>) => void
  webglComparisonSettings: {
    mode: WebGLComparisonMode
    amplification: number
    threshold: number
    blockSize: number
    opacity: number
    loupeSize: number
    loupeZoom: number
    checkerSize: number
  }
  setWebGLComparisonMode: (mode: WebGLComparisonMode) => void
  setWebGLComparisonSettings: (settings: Partial<{ amplification: number; threshold: number; blockSize: number; opacity: number; loupeSize: number; loupeZoom: number; checkerSize: number }>) => void
}

function SettingsPanel({
  comparisonMode,
  blendMode,
  setBlendMode,
  splitLayout,
  setSplitLayout,
  sliderPosition,
  setSliderPosition,
  sliderOrientation,
  setSliderOrientation,
  hideSlider,
  toggleHideSlider,
  exportSettings,
  setExportSettings,
  webglComparisonSettings,
  setWebGLComparisonMode,
  setWebGLComparisonSettings,
}: SettingsPanelProps) {
  // Mode-specific hints - Postel's Law: Help users understand
  const modeHints: Record<string, string> = {
    slider: 'Drag the slider or press H to hide it',
    blend: 'Difference mode highlights changes between A and B',
    split: '2x2 shows all corners for detailed comparison',
    'side-by-side': 'Perfect for comparing two versions simultaneously',
    flicker: 'Rapidly switches between A and B to spot differences',
    heatmap: 'Shows pixel-level differences as a heat map',
    'prompt-diff': 'Highlights text changes between prompts',
    'json-diff': 'Compares JSON structures with syntax highlighting',
    audio: 'Visualizes audio waveforms for comparison',
  }

  return (
    <div className="space-y-4">
      {/* Current mode indicator - helps with context */}
      <div className="p-3 bg-accent/10 border border-accent/20">
        <div className="text-[10px] uppercase tracking-wider text-accent font-medium mb-1">
          Current Mode
        </div>
        <div className="text-sm font-medium text-text-primary capitalize">
          {comparisonMode.replace('-', ' ')}
        </div>
        <p className="text-[10px] text-text-muted mt-1">
          {modeHints[comparisonMode] || 'Configure settings below'}
        </p>
      </div>

      {/* WebGL Difference settings - show at top when in webgl-compare mode */}
      {comparisonMode === 'webgl-compare' && (
        <div className="p-4 bg-surface-alt border border-border space-y-4 animate-slide-down">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Microscope className="w-4 h-4 text-accent" />
            Difference
          </h3>
          <p className="text-[10px] text-text-muted -mt-2">26 advanced comparison modes</p>

          {/* Category selector */}
          <Select
            label="Category"
            value={webglComparisonSettings.mode.split('-')[0]}
            onChange={(e) => {
              const category = e.target.value
              const categories = getAllComparisonCategories()
              const cat = categories.find(c => c.id === category || c.modes[0]?.startsWith(category))
              if (cat && cat.modes.length > 0) {
                setWebGLComparisonMode(cat.modes[0])
              }
            }}
            options={getAllComparisonCategories().map(cat => ({
              value: cat.id,
              label: `${cat.icon} ${cat.label}`,
            }))}
          />

          {/* Mode selector */}
          <Select
            label="Analysis Mode"
            value={webglComparisonSettings.mode}
            onChange={(e) => setWebGLComparisonMode(e.target.value as WebGLComparisonMode)}
            options={(() => {
              const categories = getAllComparisonCategories()
              const currentCategory = webglComparisonSettings.mode.split('-')[0]
              const cat = categories.find(c =>
                c.modes.some(m => m.startsWith(currentCategory)) ||
                c.id === currentCategory
              )
              return (cat?.modes || []).map(mode => {
                const info = getComparisonModeInfo(mode)
                return { value: mode, label: info?.label || mode }
              })
            })()}
          />

          {/* Mode description */}
          <p className="text-[10px] text-text-muted">
            {getComparisonModeInfo(webglComparisonSettings.mode)?.description || ''}
          </p>

          {/* Amplification slider */}
          <Slider
            label={`Amplification: ${webglComparisonSettings.amplification}x`}
            min={1}
            max={100}
            step={1}
            value={webglComparisonSettings.amplification}
            onChange={(e) => setWebGLComparisonSettings({ amplification: Number(e.target.value) })}
          />

          {/* Threshold slider */}
          <Slider
            label={`Threshold: ${(webglComparisonSettings.threshold * 100).toFixed(0)}%`}
            min={0}
            max={0.5}
            step={0.01}
            value={webglComparisonSettings.threshold}
            onChange={(e) => setWebGLComparisonSettings({ threshold: Number(e.target.value) })}
          />

          {/* Opacity slider */}
          <Slider
            label={`Opacity: ${(webglComparisonSettings.opacity * 100).toFixed(0)}%`}
            min={0}
            max={1}
            step={0.05}
            value={webglComparisonSettings.opacity}
            onChange={(e) => setWebGLComparisonSettings({ opacity: Number(e.target.value) })}
          />

          {/* Block size for struct-block mode */}
          {webglComparisonSettings.mode === 'struct-block' && (
            <Select
              label="Block Size"
              value={String(webglComparisonSettings.blockSize)}
              onChange={(e) => setWebGLComparisonSettings({ blockSize: Number(e.target.value) })}
              options={[
                { value: '4', label: '4x4' },
                { value: '8', label: '8x8' },
                { value: '16', label: '16x16' },
                { value: '32', label: '32x32' },
              ]}
            />
          )}

          {/* Checker size for pro-checkerboard mode */}
          {webglComparisonSettings.mode === 'pro-checkerboard' && (
            <Slider
              label={`Checker Size: ${webglComparisonSettings.checkerSize}px`}
              min={8}
              max={128}
              step={8}
              value={webglComparisonSettings.checkerSize}
              onChange={(e) => setWebGLComparisonSettings({ checkerSize: Number(e.target.value) })}
            />
          )}

          {/* Loupe settings for pro-loupe mode */}
          {webglComparisonSettings.mode === 'pro-loupe' && (
            <>
              <Slider
                label={`Loupe Size: ${webglComparisonSettings.loupeSize}px`}
                min={100}
                max={400}
                step={20}
                value={webglComparisonSettings.loupeSize}
                onChange={(e) => setWebGLComparisonSettings({ loupeSize: Number(e.target.value) })}
              />
              <Slider
                label={`Zoom: ${webglComparisonSettings.loupeZoom}x`}
                min={2}
                max={8}
                step={1}
                value={webglComparisonSettings.loupeZoom}
                onChange={(e) => setWebGLComparisonSettings({ loupeZoom: Number(e.target.value) })}
              />
            </>
          )}

          {/* ANALYSIS-001: Multi-Scale Edge scale selector */}
          {webglComparisonSettings.mode === 'analysis-multiscale-edge' && (
            <Select
              label="Scale"
              value={String(webglComparisonSettings.blockSize)}
              onChange={(e) => setWebGLComparisonSettings({ blockSize: Number(e.target.value) })}
              options={[
                { value: '1', label: 'Fine (1px) - Texture detail, noise' },
                { value: '4', label: 'Medium (4px) - Object edges' },
                { value: '16', label: 'Coarse (16px) - Large structures' },
                { value: '32', label: 'Combined - All scales (RGB)' },
              ]}
            />
          )}

          {/* ANALYSIS-002: Local Contrast Map radius slider */}
          {webglComparisonSettings.mode === 'analysis-local-contrast' && (
            <Select
              label="Analysis Radius"
              value={String(webglComparisonSettings.blockSize)}
              onChange={(e) => setWebGLComparisonSettings({ blockSize: Number(e.target.value) })}
              options={[
                { value: '4', label: '4px - Fine detail' },
                { value: '8', label: '8px - Standard' },
                { value: '16', label: '16px - Medium structures' },
                { value: '32', label: '32px - Large areas' },
              ]}
            />
          )}

          {/* ANALYSIS-003: Gradient Direction view selector */}
          {webglComparisonSettings.mode === 'analysis-gradient-direction' && (
            <Select
              label="View Mode"
              value={String(webglComparisonSettings.blockSize)}
              onChange={(e) => setWebGLComparisonSettings({ blockSize: Number(e.target.value) })}
              options={[
                { value: '4', label: 'Source A direction' },
                { value: '8', label: 'Source B direction' },
                { value: '16', label: 'Direction difference' },
                { value: '32', label: 'Split comparison (interactive)' },
              ]}
            />
          )}

          {/* SCOPE-004: False Color preset selector */}
          {(webglComparisonSettings.mode === 'exposure-false-color' || webglComparisonSettings.mode === 'exposure-false-color-compare') && (
            <Select
              label="Preset"
              value={webglComparisonSettings.amplification < 34 ? 'broadcast' : webglComparisonSettings.amplification < 67 ? 'cinematic' : 'custom'}
              onChange={(e) => {
                const preset = e.target.value
                if (preset === 'broadcast') setWebGLComparisonSettings({ amplification: 1 })
                else if (preset === 'cinematic') setWebGLComparisonSettings({ amplification: 50 })
                else setWebGLComparisonSettings({ amplification: 80 })
              }}
              options={[
                { value: 'broadcast', label: 'Broadcast Safe (IRE standard)' },
                { value: 'cinematic', label: 'Cinematic (wider range)' },
                { value: 'custom', label: 'Custom (use threshold)' },
              ]}
            />
          )}

          {/* SCOPE-005: Focus Peaking color selector */}
          {(webglComparisonSettings.mode === 'exposure-focus-peak' || webglComparisonSettings.mode === 'exposure-focus-peak-compare') && (
            <>
              <Select
                label="Peak Color"
                value={webglComparisonSettings.amplification < 21 ? 'red' : webglComparisonSettings.amplification < 41 ? 'green' : webglComparisonSettings.amplification < 61 ? 'blue' : webglComparisonSettings.amplification < 81 ? 'yellow' : 'white'}
                onChange={(e) => {
                  const color = e.target.value
                  if (color === 'red') setWebGLComparisonSettings({ amplification: 1 })
                  else if (color === 'green') setWebGLComparisonSettings({ amplification: 30 })
                  else if (color === 'blue') setWebGLComparisonSettings({ amplification: 50 })
                  else if (color === 'yellow') setWebGLComparisonSettings({ amplification: 70 })
                  else setWebGLComparisonSettings({ amplification: 90 })
                }}
                options={[
                  { value: 'red', label: 'Red' },
                  { value: 'green', label: 'Green' },
                  { value: 'blue', label: 'Blue' },
                  { value: 'yellow', label: 'Yellow' },
                  { value: 'white', label: 'White' },
                ]}
              />
              <Slider
                label={`Sensitivity: ${(webglComparisonSettings.threshold * 100).toFixed(0)}%`}
                min={0}
                max={0.5}
                step={0.01}
                value={webglComparisonSettings.threshold}
                onChange={(e) => setWebGLComparisonSettings({ threshold: Number(e.target.value) })}
              />
              <p className="text-[10px] text-text-muted">Higher = stricter edge detection (fewer peaks)</p>
            </>
          )}

          {/* SCOPE-006: Zebra Stripes level selector */}
          {(webglComparisonSettings.mode === 'exposure-zebra' || webglComparisonSettings.mode === 'exposure-zebra-compare') && (
            <>
              <Select
                label="Zebra Level"
                value={webglComparisonSettings.amplification < 34 ? '90' : webglComparisonSettings.amplification < 67 ? '95' : '100'}
                onChange={(e) => {
                  const level = e.target.value
                  if (level === '90') setWebGLComparisonSettings({ amplification: 1 })
                  else if (level === '95') setWebGLComparisonSettings({ amplification: 50 })
                  else setWebGLComparisonSettings({ amplification: 80 })
                }}
                options={[
                  { value: '90', label: '90% (highlight warning)' },
                  { value: '95', label: '95% (near clip)' },
                  { value: '100', label: '100% (clipped only)' },
                ]}
              />
              <Slider
                label={`Under-exposure: ${(webglComparisonSettings.threshold * 15).toFixed(0)}%`}
                min={0}
                max={0.5}
                step={0.05}
                value={webglComparisonSettings.threshold}
                onChange={(e) => setWebGLComparisonSettings({ threshold: Number(e.target.value) })}
              />
              <p className="text-[10px] text-text-muted">Show blue zebras for crushed blacks (0 = off)</p>
            </>
          )}

          {/* SCOPE-007: Zone System info */}
          {(webglComparisonSettings.mode === 'exposure-zone-system' || webglComparisonSettings.mode === 'exposure-zone-compare') && (
            <div className="text-[10px] text-text-muted space-y-1 p-2 bg-background/50 rounded">
              <p className="font-medium text-text-secondary">Ansel Adams Zone System:</p>
              <div className="grid grid-cols-2 gap-x-2">
                <span style={{color: '#000'}}>Zone 0: Pure black</span>
                <span style={{color: '#260080'}}>Zone I: Near black</span>
                <span style={{color: '#0000cc'}}>Zone II: Dark tones</span>
                <span style={{color: '#004d99'}}>Zone III: Dark shadows</span>
                <span style={{color: '#008080'}}>Zone IV: Shadows</span>
                <span style={{color: '#009933'}}>Zone V: Middle gray</span>
                <span style={{color: '#80b300'}}>Zone VI: Light skin</span>
                <span style={{color: '#ccb300'}}>Zone VII: Light tones</span>
                <span style={{color: '#ff8000'}}>Zone VIII: Whites</span>
                <span style={{color: '#ff3333'}}>Zone IX: Near white</span>
                <span style={{color: '#ff0080'}}>Zone X: Pure white</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ASPECT-001: Aspect Ratio Presets */}
      <div className="p-4 bg-surface-alt border border-border">
        <AspectRatioSelector showCustomInput={true} />
      </div>

      {/* Mode-specific settings - Law of Common Region */}
      {comparisonMode === 'slider' && (
        <div className="p-4 bg-surface-alt border border-border space-y-4 animate-slide-down">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent" />
            Slider Settings
          </h3>

          {/* Hide/Show Slider toggle */}
          <button
            onClick={toggleHideSlider}
            className={`w-full flex items-center justify-between p-3 border transition-colors ${
              hideSlider
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border hover:border-border-hover'
            }`}
          >
            <span className="text-sm font-medium">
              {hideSlider ? 'Slider Hidden' : 'Slider Visible'}
            </span>
            {hideSlider ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <Slider
            label="Position"
            value={sliderPosition}
            min={0}
            max={100}
            onChange={(e) => setSliderPosition(Number(e.target.value))}
          />
          <div className="flex items-center justify-between text-[10px] text-text-muted -mt-2">
            <span>A side</span>
            <span>B side</span>
          </div>
          <Select
            label="Orientation"
            value={sliderOrientation}
            onChange={(e) => setSliderOrientation(e.target.value as 'vertical' | 'horizontal')}
            options={[
              { value: 'vertical', label: 'Vertical (Left/Right)' },
              { value: 'horizontal', label: 'Horizontal (Top/Bottom)' },
            ]}
          />
          <p className="text-[10px] text-text-muted">
            Press <kbd className="kbd">H</kbd> to toggle slider visibility
          </p>
        </div>
      )}

      {comparisonMode === 'blend' && (
        <div className="p-4 bg-surface-alt border border-border space-y-4 animate-slide-down">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-accent" />
            Blend Settings
          </h3>
          <Select
            label="Blend Mode"
            value={blendMode}
            onChange={(e) => setBlendMode(e.target.value as BlendMode)}
            options={[
              { value: 'difference', label: 'Difference (highlights changes)' },
              { value: 'overlay', label: 'Overlay (enhanced contrast)' },
              { value: 'multiply', label: 'Multiply (darker result)' },
              { value: 'screen', label: 'Screen (lighter result)' },
            ]}
          />
        </div>
      )}

      {comparisonMode === 'split' && (
        <div className="p-4 bg-surface-alt border border-border space-y-4 animate-slide-down">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-accent" />
            Split Layout
          </h3>
          <Select
            label="Layout"
            value={splitLayout}
            onChange={(e) => setSplitLayout(e.target.value as SplitLayout)}
            options={[
              { value: '2x1', label: 'Horizontal (A | B)' },
              { value: '1x2', label: 'Vertical (A above B)' },
              { value: '2x2', label: 'Grid (4 corners)' },
            ]}
          />
        </div>
      )}

      {/* Export settings card - always visible */}
      <div className="p-4 bg-surface-alt border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Quick Export</h3>
          <kbd className="kbd">E</kbd>
        </div>
        <p className="text-[10px] text-text-muted -mt-2">Basic settings • Press E for full options</p>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Format"
            value={exportSettings.format}
            onChange={(e) => setExportSettings({ format: e.target.value as 'mp4' | 'webm' | 'gif' })}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' },
              { value: 'gif', label: 'GIF' },
            ]}
          />
          <Select
            label="Quality"
            value={exportSettings.quality}
            onChange={(e) => setExportSettings({ quality: e.target.value as 'low' | 'medium' | 'high' })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
        <Select
          label="Resolution"
          value={exportSettings.resolution}
          onChange={(e) => setExportSettings({ resolution: e.target.value as '720p' | '1080p' | '4k' })}
          options={[
            { value: '720p', label: '720p (HD)' },
            { value: '1080p', label: '1080p (Full HD)' },
            { value: '4k', label: '4K (Ultra HD)' },
          ]}
        />
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="p-3 border border-dashed border-border text-center">
        <p className="text-[10px] text-text-muted">
          Press <kbd className="kbd">?</kbd> for all keyboard shortcuts
        </p>
      </div>
    </div>
  )
}
