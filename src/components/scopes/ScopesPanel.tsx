/**
 * ScopesPanel Component
 * SCOPE-001: Waveform Monitor
 * SCOPE-002: Vectorscope Display
 * SCOPE-003: RGB Parade
 *
 * Professional video scopes for color grading and exposure analysis
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { ScopesRenderer } from '../../lib/webgl/ScopesRenderer'
import {
  Activity,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Settings,
  Minus,
  Plus
} from 'lucide-react'

interface ScopeCanvasProps {
  type: 'waveform' | 'vectorscope' | 'parade'
  source: HTMLVideoElement | HTMLImageElement | null
  settings: {
    intensity: number
    zoom?: number
    showSkinTone?: boolean
    isolatedChannel?: number
  }
  width: number
  height: number
}

function ScopeCanvas({ type, source, settings, width, height }: ScopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ScopesRenderer | null>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = width
    canvas.height = height

    const renderer = new ScopesRenderer(canvas)
    rendererRef.current = renderer

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      renderer.dispose()
    }
  }, [width, height])

  useEffect(() => {
    const render = () => {
      const renderer = rendererRef.current
      if (!renderer || !source) {
        animationRef.current = requestAnimationFrame(render)
        return
      }

      // Update source texture
      if ('videoWidth' in source && source.readyState >= 2) {
        renderer.updateSource(source)
      } else if ('naturalWidth' in source && source.complete) {
        renderer.updateSource(source)
      }

      // Render the scope
      const shaderType = type === 'waveform' ? 'waveform' : type
      renderer.render(shaderType, {
        intensity: settings.intensity,
        zoom: settings.zoom,
        showSkinTone: settings.showSkinTone,
        isolatedChannel: settings.isolatedChannel
      })

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [type, source, settings])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded"
      style={{ minHeight: '150px' }}
    />
  )
}

export function ScopesPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const {
    scopesSettings,
    toggleScopes,
    toggleWaveform,
    toggleVectorscope,
    toggleParade,
    setVectorscopeZoom,
    setScopeIntensity,
    setScopeSource,
    setScopesSettings
  } = useProjectStore()

  const { getFile } = useMediaStore()
  const { tracks } = useTimelineStore()

  // Hidden refs for video/image sources
  const sourceVideoRef = useRef<HTMLVideoElement>(null)
  const sourceImageRef = useRef<HTMLImageElement>(null)

  // Get source media based on selection
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')
  const firstClipA = trackA?.clips[0] || null
  const firstClipB = trackB?.clips[0] || null
  const mediaA = firstClipA ? getFile(firstClipA.mediaId) : null
  const mediaB = firstClipB ? getFile(firstClipB.mediaId) : null

  // Choose source based on setting
  const selectedMedia = scopesSettings.scopeSource === 'a' ? mediaA :
                        scopesSettings.scopeSource === 'b' ? mediaB :
                        mediaA // Comparison uses A for now

  // Track video/image loading
  const [sourceLoaded, setSourceLoaded] = useState(false)

  useEffect(() => {
    setSourceLoaded(false)
  }, [selectedMedia?.url])

  // Get the appropriate source element
  const getSourceElement = useCallback((): HTMLVideoElement | HTMLImageElement | null => {
    if (!selectedMedia || !sourceLoaded) return null

    if (selectedMedia.type === 'video' && sourceVideoRef.current) {
      return sourceVideoRef.current
    } else if (selectedMedia.type === 'image' && sourceImageRef.current) {
      return sourceImageRef.current
    }
    return null
  }, [selectedMedia, sourceLoaded])

  if (!scopesSettings.showScopes) {
    return null
  }

  // Calculate dimensions
  const scopeWidth = 280
  const scopeHeight = scopesSettings.scopeHeight

  // Count active scopes
  const activeScopeCount = [
    scopesSettings.showWaveform,
    scopesSettings.showVectorscope,
    scopesSettings.showParade
  ].filter(Boolean).length

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#333333] z-40">
      {/* Hidden video/image elements for texture source */}
      {selectedMedia?.type === 'video' && (
        <video
          ref={sourceVideoRef}
          src={selectedMedia.url}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
          muted
          playsInline
          autoPlay
          loop
          onLoadedData={() => setSourceLoaded(true)}
        />
      )}
      {selectedMedia?.type === 'image' && (
        <img
          ref={sourceImageRef}
          src={selectedMedia.url}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
          onLoad={() => setSourceLoaded(true)}
          alt=""
        />
      )}

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#333333]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 text-white hover:text-[#cddc39] transition-colors"
          >
            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span className="font-semibold text-sm">Video Scopes</span>
          </button>

          {!isCollapsed && (
            <div className="flex items-center gap-2">
              {/* Scope toggles */}
              <button
                onClick={toggleWaveform}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  scopesSettings.showWaveform
                    ? 'bg-[#ff5722] text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
                title="Waveform Monitor (SCOPE-001)"
              >
                <Activity size={14} />
                Waveform
              </button>

              <button
                onClick={toggleVectorscope}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  scopesSettings.showVectorscope
                    ? 'bg-[#ff5722] text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
                title="Vectorscope (SCOPE-002)"
              >
                <Target size={14} />
                Vectorscope
              </button>

              <button
                onClick={toggleParade}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  scopesSettings.showParade
                    ? 'bg-[#ff5722] text-white'
                    : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
                title="RGB Parade (SCOPE-003)"
              >
                <Layers size={14} />
                RGB Parade
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <>
              {/* Source selector */}
              <select
                value={scopesSettings.scopeSource}
                onChange={(e) => setScopeSource(e.target.value as 'a' | 'b' | 'comparison')}
                className="bg-[#252525] border border-[#333333] text-white text-xs px-2 py-1 rounded"
              >
                <option value="a">Source A</option>
                <option value="b">Source B</option>
              </select>

              {/* Settings toggle */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded transition-colors ${
                  showSettings ? 'bg-[#ff5722] text-white' : 'bg-[#252525] text-gray-400 hover:text-white'
                }`}
                title="Settings"
              >
                <Settings size={14} />
              </button>
            </>
          )}

          {/* Close button */}
          <button
            onClick={toggleScopes}
            className="p-1.5 rounded bg-[#252525] text-gray-400 hover:text-red-400 transition-colors"
            title="Close Scopes"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {!isCollapsed && showSettings && (
        <div className="px-4 py-2 bg-[#252525] border-b border-[#333333] flex items-center gap-6">
          {/* Intensity slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Intensity:</span>
            <button
              onClick={() => setScopeIntensity(scopesSettings.scopeIntensity - 0.25)}
              className="p-1 rounded bg-[#1a1a1a] text-gray-400 hover:text-white"
            >
              <Minus size={12} />
            </button>
            <span className="text-xs text-white w-8 text-center">
              {scopesSettings.scopeIntensity.toFixed(2)}
            </span>
            <button
              onClick={() => setScopeIntensity(scopesSettings.scopeIntensity + 0.25)}
              className="p-1 rounded bg-[#1a1a1a] text-gray-400 hover:text-white"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Vectorscope zoom */}
          {scopesSettings.showVectorscope && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">V-Scope Zoom:</span>
              <select
                value={scopesSettings.vectorscopeZoom}
                onChange={(e) => setVectorscopeZoom(Number(e.target.value))}
                className="bg-[#1a1a1a] border border-[#333333] text-white text-xs px-2 py-1 rounded"
              >
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
              </select>
            </div>
          )}

          {/* Skin tone toggle */}
          {scopesSettings.showVectorscope && (
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={scopesSettings.showSkinToneLine}
                onChange={(e) => setScopesSettings({ showSkinToneLine: e.target.checked })}
                className="rounded border-[#333333]"
              />
              Skin Tone Line
            </label>
          )}

          {/* Height slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Height:</span>
            <input
              type="range"
              min="150"
              max="400"
              step="10"
              value={scopesSettings.scopeHeight}
              onChange={(e) => setScopesSettings({ scopeHeight: Number(e.target.value) })}
              className="w-20"
            />
            <span className="text-xs text-white w-10">{scopesSettings.scopeHeight}px</span>
          </div>
        </div>
      )}

      {/* Scopes display */}
      {!isCollapsed && activeScopeCount > 0 && (
        <div
          className="flex items-stretch gap-2 p-2 overflow-x-auto"
          style={{ height: scopeHeight + 40 }}
        >
          {/* Waveform (SCOPE-001) */}
          {scopesSettings.showWaveform && (
            <div className="flex-shrink-0 flex flex-col" style={{ width: scopeWidth }}>
              <div className="text-xs text-gray-400 mb-1 px-1 flex items-center justify-between">
                <span>Waveform</span>
                <span className="text-gray-500">0-100 IRE</span>
              </div>
              <div className="flex-1 bg-black rounded overflow-hidden relative">
                <ScopeCanvas
                  type="waveform"
                  source={getSourceElement()}
                  settings={{
                    intensity: scopesSettings.scopeIntensity
                  }}
                  width={scopeWidth}
                  height={scopeHeight}
                />
                {/* IRE labels */}
                <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
                  <span className="text-[10px] text-gray-500">100</span>
                  <span className="text-[10px] text-gray-500">75</span>
                  <span className="text-[10px] text-gray-500">50</span>
                  <span className="text-[10px] text-gray-500">25</span>
                  <span className="text-[10px] text-gray-500">0</span>
                </div>
              </div>
            </div>
          )}

          {/* Vectorscope (SCOPE-002) */}
          {scopesSettings.showVectorscope && (
            <div className="flex-shrink-0 flex flex-col" style={{ width: scopeHeight + 20 }}>
              <div className="text-xs text-gray-400 mb-1 px-1 flex items-center justify-between">
                <span>Vectorscope</span>
                <span className="text-gray-500">{scopesSettings.vectorscopeZoom}x</span>
              </div>
              <div className="flex-1 bg-black rounded overflow-hidden aspect-square">
                <ScopeCanvas
                  type="vectorscope"
                  source={getSourceElement()}
                  settings={{
                    intensity: scopesSettings.scopeIntensity,
                    zoom: scopesSettings.vectorscopeZoom,
                    showSkinTone: scopesSettings.showSkinToneLine
                  }}
                  width={scopeHeight}
                  height={scopeHeight}
                />
              </div>
            </div>
          )}

          {/* RGB Parade (SCOPE-003) */}
          {scopesSettings.showParade && (
            <div className="flex-shrink-0 flex flex-col" style={{ width: scopeWidth * 1.2 }}>
              <div className="text-xs text-gray-400 mb-1 px-1 flex items-center justify-between">
                <span>RGB Parade</span>
                <div className="flex gap-2 text-[10px]">
                  <span className="text-red-400">R</span>
                  <span className="text-green-400">G</span>
                  <span className="text-blue-400">B</span>
                </div>
              </div>
              <div className="flex-1 bg-black rounded overflow-hidden relative">
                <ScopeCanvas
                  type="parade"
                  source={getSourceElement()}
                  settings={{
                    intensity: scopesSettings.scopeIntensity,
                    isolatedChannel: scopesSettings.paradeChannelIsolation === 'all' ? 0 :
                                     scopesSettings.paradeChannelIsolation === 'r' ? 1 :
                                     scopesSettings.paradeChannelIsolation === 'g' ? 2 : 3
                  }}
                  width={Math.round(scopeWidth * 1.2)}
                  height={scopeHeight}
                />
                {/* IRE labels */}
                <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
                  <span className="text-[10px] text-gray-500">100</span>
                  <span className="text-[10px] text-gray-500">75</span>
                  <span className="text-[10px] text-gray-500">50</span>
                  <span className="text-[10px] text-gray-500">25</span>
                  <span className="text-[10px] text-gray-500">0</span>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!selectedMedia && (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Add media to Track A or B to view scopes
            </div>
          )}
        </div>
      )}

      {/* Collapsed state */}
      {isCollapsed && (
        <div className="px-4 py-1 text-xs text-gray-500">
          {activeScopeCount} scope{activeScopeCount !== 1 ? 's' : ''} active | Source: {scopesSettings.scopeSource.toUpperCase()}
        </div>
      )}
    </div>
  )
}

// Toggle button for the header
export function ScopesToggle({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        isActive ? 'bg-[#ff5722] text-white' : 'bg-black/70 text-gray-400 hover:text-white'
      }`}
      title="Video Scopes (Waveform, Vectorscope, Parade)"
    >
      <Activity size={16} />
    </button>
  )
}
