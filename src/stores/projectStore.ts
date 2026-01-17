import { create } from 'zustand'
import type { ComparisonMode, BlendMode, SplitLayout, ExportSettings, ExportProgress, TransitionEngine, TransitionExportMode, WebGLComparisonSettings, WebGLComparisonMode, WebGLAnalysisMetrics, ROIRect, ScopesSettings, QuadViewSettings, RadialLoupeSettings, GridTileSettings, PixelGridSettings, MorphologicalSettings, MorphOperation, AspectRatioPreset, AspectRatioSettings, ResolutionPreset, ResolutionConfig } from '../types'

// ASPECT-001: Aspect Ratio Presets configuration
export const ASPECT_RATIO_PRESETS: Record<AspectRatioPreset, { label: string; ratio: number; description: string }> = {
  '16:9': { label: 'Landscape', ratio: 16 / 9, description: 'YouTube, TV' },
  '9:16': { label: 'Portrait', ratio: 9 / 16, description: 'TikTok, Reels' },
  '1:1': { label: 'Square', ratio: 1, description: 'Instagram Posts' },
  '4:3': { label: 'Classic', ratio: 4 / 3, description: 'Traditional' },
  '21:9': { label: 'Ultrawide', ratio: 21 / 9, description: 'Cinematic' },
  '4:5': { label: 'Portrait (4:5)', ratio: 4 / 5, description: 'Instagram Portrait' },
  'custom': { label: 'Custom', ratio: 1, description: 'Custom size' },
}

// ASPECT-002: Resolution Presets tied to aspect ratios
export const RESOLUTION_PRESETS: Record<AspectRatioPreset, Record<ResolutionPreset, ResolutionConfig>> = {
  '16:9': {
    '720p': { preset: '720p', label: 'HD', width: 1280, height: 720, description: '1280×720' },
    '1080p': { preset: '1080p', label: 'Full HD', width: 1920, height: 1080, description: '1920×1080' },
    '2160p': { preset: '2160p', label: '4K UHD', width: 3840, height: 2160, description: '3840×2160' },
    'custom': { preset: 'custom', label: 'Custom', width: 1920, height: 1080, description: 'Custom size' },
  },
  '9:16': {
    '720p': { preset: '720p', label: 'HD', width: 720, height: 1280, description: '720×1280' },
    '1080p': { preset: '1080p', label: 'Full HD', width: 1080, height: 1920, description: '1080×1920' },
    '2160p': { preset: '2160p', label: '4K UHD', width: 2160, height: 3840, description: '2160×3840' },
    'custom': { preset: 'custom', label: 'Custom', width: 1080, height: 1920, description: 'Custom size' },
  },
  '1:1': {
    '720p': { preset: '720p', label: 'HD', width: 720, height: 720, description: '720×720' },
    '1080p': { preset: '1080p', label: 'Full HD', width: 1080, height: 1080, description: '1080×1080' },
    '2160p': { preset: '2160p', label: '4K UHD', width: 2160, height: 2160, description: '2160×2160' },
    'custom': { preset: 'custom', label: 'Custom', width: 1080, height: 1080, description: 'Custom size' },
  },
  '4:3': {
    '720p': { preset: '720p', label: 'SD', width: 960, height: 720, description: '960×720' },
    '1080p': { preset: '1080p', label: 'HD', width: 1440, height: 1080, description: '1440×1080' },
    '2160p': { preset: '2160p', label: '4K', width: 2880, height: 2160, description: '2880×2160' },
    'custom': { preset: 'custom', label: 'Custom', width: 1440, height: 1080, description: 'Custom size' },
  },
  '21:9': {
    '720p': { preset: '720p', label: 'HD', width: 1680, height: 720, description: '1680×720' },
    '1080p': { preset: '1080p', label: 'Full HD', width: 2520, height: 1080, description: '2520×1080' },
    '2160p': { preset: '2160p', label: '4K', width: 5040, height: 2160, description: '5040×2160' },
    'custom': { preset: 'custom', label: 'Custom', width: 2520, height: 1080, description: 'Custom size' },
  },
  '4:5': {
    '720p': { preset: '720p', label: 'HD', width: 576, height: 720, description: '576×720' },
    '1080p': { preset: '1080p', label: 'Full HD', width: 864, height: 1080, description: '864×1080' },
    '2160p': { preset: '2160p', label: '4K', width: 1728, height: 2160, description: '1728×2160' },
    'custom': { preset: 'custom', label: 'Custom', width: 864, height: 1080, description: 'Custom size' },
  },
  'custom': {
    '720p': { preset: '720p', label: 'HD', width: 1280, height: 720, description: '1280×720' },
    '1080p': { preset: '1080p', label: 'Full HD', width: 1920, height: 1080, description: '1920×1080' },
    '2160p': { preset: '2160p', label: '4K UHD', width: 3840, height: 2160, description: '3840×2160' },
    'custom': { preset: 'custom', label: 'Custom', width: 1920, height: 1080, description: 'Custom size' },
  },
}

interface ProjectStore {
  // Comparison settings
  comparisonMode: ComparisonMode
  blendMode: BlendMode
  splitLayout: SplitLayout
  sliderPosition: number
  sliderOrientation: 'vertical' | 'horizontal'
  hideSlider: boolean

  // ASPECT-001: Aspect Ratio Settings
  aspectRatioSettings: AspectRatioSettings

  // Quality metrics (VID-004)
  showMetrics: boolean
  metricsSSIM: number | null
  metricsPSNR: number | null

  // Synchronized zoom/pan (IMG-002)
  zoom: number
  panX: number
  panY: number

  // Pixel inspector (IMG-003)
  pixelInspectorEnabled: boolean
  pixelInfoA: { x: number; y: number; r: number; g: number; b: number } | null
  pixelInfoB: { x: number; y: number; r: number; g: number; b: number } | null

  // Prompt diff
  promptA: string
  promptB: string

  // WebGL Comparison settings
  webglComparisonSettings: WebGLComparisonSettings

  // WebGL Analysis metrics (WEBGL-001)
  webglAnalysisMetrics: WebGLAnalysisMetrics | null

  // SCOPE-001, SCOPE-002, SCOPE-003: Professional video scopes
  scopesSettings: ScopesSettings

  // MODE-001 to MODE-005: New comparison mode settings
  quadViewSettings: QuadViewSettings
  radialLoupeSettings: RadialLoupeSettings
  gridTileSettings: GridTileSettings
  pixelGridSettings: PixelGridSettings
  morphologicalSettings: MorphologicalSettings

  // Export
  exportSettings: ExportSettings
  exportProgress: ExportProgress

  // Actions
  setComparisonMode: (mode: ComparisonMode) => void
  setBlendMode: (mode: BlendMode) => void
  setSplitLayout: (layout: SplitLayout) => void
  setSliderPosition: (position: number) => void
  setSliderOrientation: (orientation: 'vertical' | 'horizontal') => void
  toggleHideSlider: () => void
  toggleMetrics: () => void
  setMetrics: (ssim: number | null, psnr: number | null) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  resetZoom: () => void
  togglePixelInspector: () => void
  setPixelInfo: (side: 'a' | 'b', info: { x: number; y: number; r: number; g: number; b: number } | null) => void
  setPromptA: (prompt: string) => void
  setPromptB: (prompt: string) => void
  setWebGLComparisonMode: (mode: WebGLComparisonMode) => void
  setWebGLComparisonSettings: (settings: Partial<WebGLComparisonSettings>) => void
  setWebGLAnalysisMetrics: (metrics: WebGLAnalysisMetrics | null) => void
  toggleWebGLMetricsOverlay: () => void
  toggleWebGLScaleBar: () => void
  toggleWebGLFlipAB: () => void
  toggleWebGLCursorInspector: () => void
  setWebGLZoom: (zoom: number) => void
  setWebGLPan: (x: number, y: number) => void
  resetWebGLZoom: () => void
  // WEBGL-004: ROI actions
  setROI: (roi: ROIRect | null) => void
  clearROI: () => void
  toggleROIControls: () => void
  // WEBGL-012: Importance weighting actions
  toggleWeightedAnalysis: () => void
  setWeightMode: (mode: 'saliency' | 'edge' | 'center' | 'custom') => void
  setEdgeWeight: (weight: number) => void
  setCenterWeight: (weight: number) => void
  toggleShowWeightMap: () => void
  // SCOPE-001, SCOPE-002, SCOPE-003: Scopes actions
  toggleScopes: () => void
  setScopesSettings: (settings: Partial<ScopesSettings>) => void
  toggleWaveform: () => void
  toggleVectorscope: () => void
  toggleParade: () => void
  setVectorscopeZoom: (zoom: number) => void
  setScopeIntensity: (intensity: number) => void
  setScopeSource: (source: 'a' | 'b' | 'comparison') => void
  // MODE-001 to MODE-005: New mode actions
  setQuadViewSettings: (settings: Partial<QuadViewSettings>) => void
  setQuadExpandedQuadrant: (quadrant: number | null) => void
  setRadialLoupeSettings: (settings: Partial<RadialLoupeSettings>) => void
  toggleRadialLoupeLock: () => void
  setGridTileSettings: (settings: Partial<GridTileSettings>) => void
  toggleGridTileAnimation: () => void
  setPixelGridSettings: (settings: Partial<PixelGridSettings>) => void
  togglePixelGrid: () => void
  setMorphologicalSettings: (settings: Partial<MorphologicalSettings>) => void
  addMorphOperation: (op: MorphOperation) => void
  removeMorphOperation: (index: number) => void
  clearMorphOperations: () => void
  setExportSettings: (settings: Partial<ExportSettings>) => void
  setExportProgress: (progress: Partial<ExportProgress>) => void
  // ASPECT-001: Aspect Ratio actions
  setAspectRatioPreset: (preset: AspectRatioPreset) => void
  setCustomAspectRatio: (width: number, height: number) => void
  getAspectRatio: () => number
  // ASPECT-002: Resolution preset actions
  setResolutionPreset: (preset: ResolutionPreset) => void
  setCustomResolution: (width: number, height: number) => void
  getResolution: () => { width: number; height: number }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  comparisonMode: 'slider',
  blendMode: 'difference',
  splitLayout: '2x1',
  sliderPosition: 50,
  sliderOrientation: 'vertical',
  hideSlider: false,

  // ASPECT-001, ASPECT-002: Aspect Ratio and Resolution default settings
  aspectRatioSettings: {
    preset: '16:9',
    customWidth: 1920,
    customHeight: 1080,
    resolutionPreset: '1080p',
    customResolutionWidth: 1920,
    customResolutionHeight: 1080,
  },

  // Quality metrics (VID-004)
  showMetrics: false,
  metricsSSIM: null,
  metricsPSNR: null,

  // Synchronized zoom/pan (IMG-002)
  zoom: 1,
  panX: 0,
  panY: 0,

  // Pixel inspector (IMG-003)
  pixelInspectorEnabled: false,
  pixelInfoA: null,
  pixelInfoB: null,

  promptA: '',
  promptB: '',

  // WebGL Comparison default settings
  webglComparisonSettings: {
    mode: 'diff-perceptual',
    amplification: 5,
    threshold: 0.02,
    blockSize: 16,
    opacity: 1.0,
    showOriginal: false,
    colorScheme: 'heat',
    loupeSize: 200,
    loupeZoom: 4,
    checkerSize: 32,
    onionOpacity: 0.5,
    // WEBGL-001: Metrics overlay
    showMetricsOverlay: false,
    // WEBGL-002: Scale bar
    showScaleBar: false,
    scaleBarPosition: 'bottom',
    // WEBGL-007: Zoom and pan
    webglZoom: 1,
    webglPanX: 0,
    webglPanY: 0,
    // WEBGL-008: A/B flip
    flipAB: false,
    // WEBGL-003: Cursor value inspector
    showCursorInspector: false,
    // WEBGL-004: ROI selection
    roi: null,
    showROIControls: false,
    // WEBGL-012: Perceptual Importance Weighting
    useWeightedAnalysis: false,
    weightMode: 'saliency',
    edgeWeight: 0.7,
    centerWeight: 0.5,
    showWeightMap: false,
  },

  // WebGL Analysis metrics (WEBGL-001)
  webglAnalysisMetrics: null,

  // SCOPE-001, SCOPE-002, SCOPE-003: Scopes default settings
  scopesSettings: {
    showScopes: false,
    scopeSource: 'a',
    scopeIntensity: 1.5,
    scopeHeight: 250,
    showWaveform: true,
    waveformMode: 'luma',
    showVectorscope: true,
    vectorscopeZoom: 1,
    showSkinToneLine: true,
    showParade: false,
    paradeChannelIsolation: 'all',
  },

  // MODE-001: Quad View default settings
  quadViewSettings: {
    sources: [null, null, null, null],
    expandedQuadrant: null,
    showDifference: false,
    diffQuadrants: [0, 1],
  },

  // MODE-002: Radial Loupe default settings
  radialLoupeSettings: {
    radius: 150,
    magnification: 4,
    featherEdge: true,
    splitMode: false,
    locked: false,
    lockedPosition: null,
    showRectangular: false,
  },

  // MODE-003: Grid Tile default settings
  gridTileSettings: {
    tileSize: 64,
    animated: false,
    animationSpeed: 1,
    offsetX: 0,
    offsetY: 0,
    hexagonal: false,
  },

  // MODE-004: Pixel Grid default settings
  pixelGridSettings: {
    enabled: true,
    showRGBValues: false,
    gridColor: 'auto',
    minZoomLevel: 8,
  },

  // MODE-005: Morphological default settings
  morphologicalSettings: {
    operations: [],
    elementSize: 3,
    elementShape: 'square',
    showOriginal: false,
  },

  exportSettings: {
    format: 'webm',
    resolution: '1080p',
    quality: 'high',
    fps: 30,
    exportSource: 'comparison',
    sliderPosition: 50,
    loopShorterVideo: true,
    videoLoops: 1,
    sweepsPerLoop: 1,
    sweepStyle: 'horizontal',
    spotlightWidth: 0.3,
    spotlightHeight: 0.3,
    spotlightSpeed: 1.0,
    // WebGL Transition defaults
    useTransition: false,
    transitionEngine: 'crossfade' as TransitionEngine,
    transitionVariant: 'crossfade',
    transitionDuration: 1.5,
    transitionIntensity: 1.0,
    transitionExportMode: 'sequential' as TransitionExportMode,
  },

  exportProgress: {
    status: 'idle',
    progress: 0,
    message: '',
  },

  setComparisonMode: (mode) => set({ comparisonMode: mode }),
  setBlendMode: (mode) => set({ blendMode: mode }),
  setSplitLayout: (layout) => set({ splitLayout: layout }),
  setSliderPosition: (position) => set({ sliderPosition: position }),
  setSliderOrientation: (orientation) => set({ sliderOrientation: orientation }),
  toggleHideSlider: () => set((state) => ({ hideSlider: !state.hideSlider })),
  toggleMetrics: () => set((state) => ({ showMetrics: !state.showMetrics })),
  setMetrics: (ssim, psnr) => set({ metricsSSIM: ssim, metricsPSNR: psnr }),
  setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(10, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  resetZoom: () => set({ zoom: 1, panX: 0, panY: 0 }),
  togglePixelInspector: () => set((state) => ({ pixelInspectorEnabled: !state.pixelInspectorEnabled })),
  setPixelInfo: (side, info) => set(side === 'a' ? { pixelInfoA: info } : { pixelInfoB: info }),
  setPromptA: (prompt) => set({ promptA: prompt }),
  setPromptB: (prompt) => set({ promptB: prompt }),

  setWebGLComparisonMode: (mode) =>
    set((state) => ({
      webglComparisonSettings: { ...state.webglComparisonSettings, mode },
    })),

  setWebGLComparisonSettings: (settings) =>
    set((state) => ({
      webglComparisonSettings: { ...state.webglComparisonSettings, ...settings },
    })),

  setWebGLAnalysisMetrics: (metrics) => set({ webglAnalysisMetrics: metrics }),

  toggleWebGLMetricsOverlay: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        showMetricsOverlay: !state.webglComparisonSettings.showMetricsOverlay,
      },
    })),

  toggleWebGLScaleBar: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        showScaleBar: !state.webglComparisonSettings.showScaleBar,
      },
    })),

  toggleWebGLFlipAB: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        flipAB: !state.webglComparisonSettings.flipAB,
      },
    })),

  toggleWebGLCursorInspector: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        showCursorInspector: !state.webglComparisonSettings.showCursorInspector,
      },
    })),

  setWebGLZoom: (zoom) =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        webglZoom: Math.max(1, Math.min(10, zoom)),
      },
    })),

  setWebGLPan: (x, y) =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        webglPanX: Math.max(-1, Math.min(1, x)),
        webglPanY: Math.max(-1, Math.min(1, y)),
      },
    })),

  resetWebGLZoom: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        webglZoom: 1,
        webglPanX: 0,
        webglPanY: 0,
      },
    })),

  // WEBGL-004: ROI actions
  setROI: (roi) =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        roi,
      },
    })),

  clearROI: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        roi: null,
      },
    })),

  toggleROIControls: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        showROIControls: !state.webglComparisonSettings.showROIControls,
      },
    })),

  // WEBGL-012: Importance weighting actions
  toggleWeightedAnalysis: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        useWeightedAnalysis: !state.webglComparisonSettings.useWeightedAnalysis,
      },
    })),

  setWeightMode: (mode) =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        weightMode: mode,
      },
    })),

  setEdgeWeight: (weight) =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        edgeWeight: Math.max(0, Math.min(1, weight)),
      },
    })),

  setCenterWeight: (weight) =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        centerWeight: Math.max(0, Math.min(1, weight)),
      },
    })),

  toggleShowWeightMap: () =>
    set((state) => ({
      webglComparisonSettings: {
        ...state.webglComparisonSettings,
        showWeightMap: !state.webglComparisonSettings.showWeightMap,
      },
    })),

  // SCOPE-001, SCOPE-002, SCOPE-003: Scopes actions
  toggleScopes: () =>
    set((state) => ({
      scopesSettings: {
        ...state.scopesSettings,
        showScopes: !state.scopesSettings.showScopes,
      },
    })),

  setScopesSettings: (settings) =>
    set((state) => ({
      scopesSettings: { ...state.scopesSettings, ...settings },
    })),

  toggleWaveform: () =>
    set((state) => ({
      scopesSettings: {
        ...state.scopesSettings,
        showWaveform: !state.scopesSettings.showWaveform,
      },
    })),

  toggleVectorscope: () =>
    set((state) => ({
      scopesSettings: {
        ...state.scopesSettings,
        showVectorscope: !state.scopesSettings.showVectorscope,
      },
    })),

  toggleParade: () =>
    set((state) => ({
      scopesSettings: {
        ...state.scopesSettings,
        showParade: !state.scopesSettings.showParade,
      },
    })),

  setVectorscopeZoom: (zoom) =>
    set((state) => ({
      scopesSettings: {
        ...state.scopesSettings,
        vectorscopeZoom: Math.max(1, Math.min(4, zoom)),
      },
    })),

  setScopeIntensity: (intensity) =>
    set((state) => ({
      scopesSettings: {
        ...state.scopesSettings,
        scopeIntensity: Math.max(0.5, Math.min(3, intensity)),
      },
    })),

  setScopeSource: (source) =>
    set((state) => ({
      scopesSettings: {
        ...state.scopesSettings,
        scopeSource: source,
      },
    })),

  // MODE-001: Quad View actions
  setQuadViewSettings: (settings) =>
    set((state) => ({
      quadViewSettings: { ...state.quadViewSettings, ...settings },
    })),

  setQuadExpandedQuadrant: (quadrant) =>
    set((state) => ({
      quadViewSettings: {
        ...state.quadViewSettings,
        expandedQuadrant: quadrant,
      },
    })),

  // MODE-002: Radial Loupe actions
  setRadialLoupeSettings: (settings) =>
    set((state) => ({
      radialLoupeSettings: { ...state.radialLoupeSettings, ...settings },
    })),

  toggleRadialLoupeLock: () =>
    set((state) => ({
      radialLoupeSettings: {
        ...state.radialLoupeSettings,
        locked: !state.radialLoupeSettings.locked,
        lockedPosition: state.radialLoupeSettings.locked ? null : state.radialLoupeSettings.lockedPosition,
      },
    })),

  // MODE-003: Grid Tile actions
  setGridTileSettings: (settings) =>
    set((state) => ({
      gridTileSettings: { ...state.gridTileSettings, ...settings },
    })),

  toggleGridTileAnimation: () =>
    set((state) => ({
      gridTileSettings: {
        ...state.gridTileSettings,
        animated: !state.gridTileSettings.animated,
      },
    })),

  // MODE-004: Pixel Grid actions
  setPixelGridSettings: (settings) =>
    set((state) => ({
      pixelGridSettings: { ...state.pixelGridSettings, ...settings },
    })),

  togglePixelGrid: () =>
    set((state) => ({
      pixelGridSettings: {
        ...state.pixelGridSettings,
        enabled: !state.pixelGridSettings.enabled,
      },
    })),

  // MODE-005: Morphological actions
  setMorphologicalSettings: (settings) =>
    set((state) => ({
      morphologicalSettings: { ...state.morphologicalSettings, ...settings },
    })),

  addMorphOperation: (op) =>
    set((state) => ({
      morphologicalSettings: {
        ...state.morphologicalSettings,
        operations: [...state.morphologicalSettings.operations, op],
      },
    })),

  removeMorphOperation: (index) =>
    set((state) => ({
      morphologicalSettings: {
        ...state.morphologicalSettings,
        operations: state.morphologicalSettings.operations.filter((_, i) => i !== index),
      },
    })),

  clearMorphOperations: () =>
    set((state) => ({
      morphologicalSettings: {
        ...state.morphologicalSettings,
        operations: [],
      },
    })),

  setExportSettings: (settings) =>
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...settings },
    })),

  setExportProgress: (progress) =>
    set((state) => ({
      exportProgress: { ...state.exportProgress, ...progress },
    })),

  // ASPECT-001: Aspect Ratio actions
  setAspectRatioPreset: (preset) =>
    set((state) => ({
      aspectRatioSettings: {
        ...state.aspectRatioSettings,
        preset,
      },
    })),

  setCustomAspectRatio: (width, height) =>
    set((state) => ({
      aspectRatioSettings: {
        ...state.aspectRatioSettings,
        preset: 'custom',
        customWidth: width,
        customHeight: height,
      },
    })),

  getAspectRatio: () => {
    const state = get()
    const { preset, customWidth, customHeight } = state.aspectRatioSettings
    if (preset === 'custom' && customWidth && customHeight) {
      return customWidth / customHeight
    }
    return ASPECT_RATIO_PRESETS[preset]?.ratio || 16 / 9
  },

  // ASPECT-002: Resolution preset actions
  setResolutionPreset: (resolutionPreset) =>
    set((state) => ({
      aspectRatioSettings: {
        ...state.aspectRatioSettings,
        resolutionPreset,
      },
    })),

  setCustomResolution: (width, height) =>
    set((state) => ({
      aspectRatioSettings: {
        ...state.aspectRatioSettings,
        resolutionPreset: 'custom',
        customResolutionWidth: width,
        customResolutionHeight: height,
      },
    })),

  getResolution: () => {
    const state = get()
    const { preset, resolutionPreset, customResolutionWidth, customResolutionHeight } = state.aspectRatioSettings
    
    if (resolutionPreset === 'custom' && customResolutionWidth && customResolutionHeight) {
      return { width: customResolutionWidth, height: customResolutionHeight }
    }
    
    const resPresets = RESOLUTION_PRESETS[preset] || RESOLUTION_PRESETS['16:9']
    const resConfig = resPresets[resolutionPreset] || resPresets['1080p']
    return { width: resConfig.width, height: resConfig.height }
  },
}))
