import { useCallback, useEffect, useState, useRef } from 'react'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { ExportDialog } from './components/layout/ExportDialog'
import { PreviewCanvas, type PreviewCanvasHandle } from './components/preview/PreviewCanvas'
import { Timeline } from './components/timeline/Timeline'
import { KeyboardShortcutsHelp, useKeyboardShortcutsHelp } from './components/ui/KeyboardShortcutsHelp'
import { ScopesPanel } from './components/scopes'
import { ProjectSelector } from './components/project'
import { useTimelineStore } from './stores/timelineStore'
import { usePlaybackStore } from './stores/playbackStore'
import { useMediaStore } from './stores/mediaStore'
import { useProjectStore } from './stores/projectStore'
import { useHistoryStore } from './stores/historyStore'
import { usePersistenceStore } from './stores/persistenceStore'
import { captureCanvasScreenshot, downloadBlob } from './lib/screenshotExport'

export default function App() {
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isTimelineVisible, setIsTimelineVisible] = useState(true)
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<PreviewCanvasHandle>(null)

  // Keyboard shortcuts help modal
  const shortcutsHelp = useKeyboardShortcutsHelp()

  // PERSIST-001: Initialize persistence store
  const { init: initPersistence, createNewProject, currentProjectId, saveCurrentProject } = usePersistenceStore()

  // Initialize persistence and create a project if none exists
  useEffect(() => {
    const initialize = async () => {
      await initPersistence()
      // If no current project, create one
      if (!currentProjectId) {
        await createNewProject()
      }
    }
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    zoomIn, zoomOut, setLoopIn, setLoopOut, clearLoop, addMarker,
    shuttleForward, shuttleBackward, shuttleStop, duration
  } = useTimelineStore()
  const {
    togglePlay, seek, currentTime, isPlaying, stepFrame
  } = usePlaybackStore()
  const { addFile } = useMediaStore()
  const { addClip, tracks } = useTimelineStore()
  const { toggleMetrics, setComparisonMode, toggleWebGLFlipAB, comparisonMode, setWebGLComparisonMode, webglComparisonSettings, toggleScopes } = useProjectStore()
  const { undo, redo } = useHistoryStore()

  // Mode shortcuts map (Serial Position Effect - number keys for quick access)
  const modeShortcuts: Record<string, Parameters<typeof setComparisonMode>[0]> = {
    'Digit1': 'slider',
    'Digit2': 'side-by-side',
    'Digit3': 'webgl-compare',
    'Digit4': 'audio',
    'Digit5': 'prompt-diff',
    'Digit6': 'json-diff',
    'Digit7': 'model-3d',
    'Digit8': 'document',
  }

  // MODE-001 to MODE-005: Additional mode shortcuts
  const newModeShortcuts: Record<string, Parameters<typeof setComparisonMode>[0]> = {
    'KeyQ': 'quad',           // MODE-001: Quad View
    'KeyR': 'radial-loupe',   // MODE-002: Radial Loupe
    'KeyG': 'grid-tile',      // MODE-003: Grid Tile
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // PERSIST-002: Save project (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        saveCurrentProject()
        return
      }

      // Undo/Redo (FIX-001)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      // Number keys 1-5 for quick mode switching (Serial Position Effect)
      if (modeShortcuts[e.code]) {
        e.preventDefault()
        setComparisonMode(modeShortcuts[e.code])
        return
      }

      // MODE-001 to MODE-003: Quick mode shortcuts (Q, R, G)
      if (newModeShortcuts[e.code]) {
        e.preventDefault()
        setComparisonMode(newModeShortcuts[e.code])
        return
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (!isPlaying && !e.shiftKey) {
            // Frame step when paused (VID-001)
            stepFrame(-1)
          } else {
            seek(Math.max(0, currentTime - (e.shiftKey ? 5 : 1)))
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (!isPlaying && !e.shiftKey) {
            // Frame step when paused (VID-001)
            stepFrame(1)
          } else {
            seek(Math.min(duration, currentTime + (e.shiftKey ? 5 : 1)))
          }
          break
        case 'KeyI':
          // Set loop in point (VID-003)
          e.preventDefault()
          setLoopIn()
          break
        case 'KeyO':
          // Set loop out point (VID-003)
          e.preventDefault()
          setLoopOut()
          break
        case 'Escape':
          // Clear loop region (VID-003)
          clearLoop()
          break
        case 'Home':
          e.preventDefault()
          seek(0)
          break
        case 'End':
          e.preventDefault()
          seek(duration)
          break
        case 'Equal':
        case 'NumpadAdd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomIn()
          }
          break
        case 'Minus':
        case 'NumpadSubtract':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomOut()
          }
          break
        case 'KeyE':
          e.preventDefault()
          setIsExportOpen(true)
          break
        case 'KeyT':
          e.preventDefault()
          setIsTimelineVisible(v => !v)
          break
        case 'KeyB':
          e.preventDefault()
          setIsSidebarVisible(v => !v)
          break
        case 'KeyM':
          // Toggle quality metrics (VID-004) with Shift, add marker without
          e.preventDefault()
          if (e.shiftKey) {
            toggleMetrics()
          } else {
            addMarker()
          }
          break
        case 'KeyS':
          // Quick screenshot (Shift+S)
          if (e.shiftKey && canvasRef.current) {
            e.preventDefault()
            captureCanvasScreenshot(canvasRef.current, 'png').then(blob => {
              if (blob) {
                downloadBlob(blob, `dualview-screenshot-${Date.now()}.png`)
              }
            })
          }
          break
        // J/K/L Shuttle controls (TL-005)
        case 'KeyJ':
          e.preventDefault()
          shuttleBackward()
          break
        case 'KeyK':
          e.preventDefault()
          shuttleStop()
          break
        case 'KeyL':
          e.preventDefault()
          shuttleForward()
          break
        // WEBGL-008: Flip A/B in WebGL comparison mode
        case 'KeyF':
          if (comparisonMode === 'webgl-compare') {
            e.preventDefault()
            toggleWebGLFlipAB()
          }
          break
        // SCOPE-005: Focus Peaking toggle (P key)
        case 'KeyP':
          e.preventDefault()
          // If already in focus-peak mode, switch back to perceptual diff
          if (comparisonMode === 'webgl-compare' && webglComparisonSettings.mode === 'exposure-focus-peak') {
            setWebGLComparisonMode('diff-perceptual')
          } else {
            // Switch to webgl-compare mode with focus-peak
            setComparisonMode('webgl-compare')
            setWebGLComparisonMode('exposure-focus-peak')
          }
          break
        // SCOPE-006: Zebra Stripes toggle (Z key)
        case 'KeyZ':
          e.preventDefault()
          // If already in zebra mode, switch back to perceptual diff
          if (comparisonMode === 'webgl-compare' && webglComparisonSettings.mode === 'exposure-zebra') {
            setWebGLComparisonMode('diff-perceptual')
          } else {
            // Switch to webgl-compare mode with zebra
            setComparisonMode('webgl-compare')
            setWebGLComparisonMode('exposure-zebra')
          }
          break
        // SCOPE-001/002/003: Toggle video scopes panel (W key)
        case 'KeyW':
          e.preventDefault()
          toggleScopes()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seek, currentTime, duration, zoomIn, zoomOut, toggleMetrics, addMarker, shuttleForward, shuttleBackward, shuttleStop, undo, redo, stepFrame, isPlaying, setComparisonMode, modeShortcuts, newModeShortcuts, toggleWebGLFlipAB, comparisonMode, setWebGLComparisonMode, webglComparisonSettings.mode, toggleScopes, saveCurrentProject])

  // Global drag and drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const files = e.dataTransfer.files

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (
          file.type.startsWith('video/') ||
          file.type.startsWith('image/') ||
          file.type.startsWith('audio/')
        ) {
          const mediaFile = await addFile(file)

          // Auto-add to timeline (respecting accepted types)
          const trackA = tracks.find(t => t.type === 'a')
          const trackB = tracks.find(t => t.type === 'b')

          if (i === 0 && trackA && trackA.clips.length === 0 && trackA.acceptedTypes.includes(mediaFile.type)) {
            addClip(trackA.id, mediaFile.id, 0, mediaFile.duration || 10)
          } else if (i === 1 && trackB && trackB.clips.length === 0 && trackB.acceptedTypes.includes(mediaFile.type)) {
            addClip(trackB.id, mediaFile.id, 0, mediaFile.duration || 10)
          }
        }
      }
    },
    [addFile, addClip, tracks]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Header
        onExport={() => setIsExportOpen(true)}
        onShowShortcuts={shortcutsHelp.open}
        onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        onOpenProjects={() => setIsProjectSelectorOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile sidebar drawer (only renders when open) */}
        {isMobileSidebarOpen && (
          <Sidebar
            isMobileOpen={true}
            onMobileClose={() => setIsMobileSidebarOpen(false)}
            onOpenProjects={() => setIsProjectSelectorOpen(true)}
          />
        )}

        {/* Desktop sidebar */}
        {isSidebarVisible ? (
          <Sidebar
            onCollapse={() => setIsSidebarVisible(false)}
            onOpenProjects={() => setIsProjectSelectorOpen(true)}
          />
        ) : (
          /* Collapsed sidebar - click to expand (desktop only) */
          <div
            onClick={() => setIsSidebarVisible(true)}
            className="w-8 bg-surface hover:bg-surface-hover border-r border-border cursor-pointer flex items-center justify-center group transition-colors hide-mobile"
            title="Open Sidebar (B)"
          >
            <span className="text-text-muted group-hover:text-text-primary text-lg">→</span>
          </div>
        )}

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <PreviewCanvas ref={previewRef} canvasRef={canvasRef} isTimelineVisible={isTimelineVisible} />
          {isTimelineVisible && <Timeline />}

          {/* Timeline toggle button */}
          <button
            onClick={() => setIsTimelineVisible(v => !v)}
            className="absolute bottom-2 right-2 z-50 bg-surface hover:bg-surface-hover border border-border px-2 py-1 text-xs text-text-secondary hide-mobile"
            title="Toggle Timeline (T)"
          >
            {isTimelineVisible ? 'Hide Timeline' : 'Show Timeline'}
          </button>
        </main>
      </div>


      {/* SCOPE-001, SCOPE-002, SCOPE-003: Video Scopes Panel */}
      <ScopesPanel />

      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        canvasRef={canvasRef}
      />
      <KeyboardShortcutsHelp isOpen={shortcutsHelp.isOpen} onClose={shortcutsHelp.close} />
      
      {/* PERSIST-003: Project selector modal */}
      <ProjectSelector
        isOpen={isProjectSelectorOpen}
        onClose={() => setIsProjectSelectorOpen(false)}
      />
    </div>
  )
}
