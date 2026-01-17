export type MediaType = 'video' | 'image' | 'audio' | 'prompt' | 'model' | 'csv' | 'excel' | 'docx' | 'pdf'

export type ComparisonMode = 'slider' | 'side-by-side' | 'blend' | 'split' | 'flicker' | 'prompt-diff' | 'json-diff' | 'heatmap' | 'audio' | 'model-3d' | 'webgl-compare' | 'quad' | 'radial-loupe' | 'grid-tile' | 'morphological' | 'document'

// ASPECT-001: Aspect Ratio Presets
export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | '4:3' | '21:9' | '4:5' | 'custom'

export interface AspectRatioConfig {
  preset: AspectRatioPreset
  label: string
  ratio: number // width / height
  icon?: string
  description: string
}

// ASPECT-002: Resolution Presets tied to aspect ratios
export type ResolutionPreset = '720p' | '1080p' | '2160p' | 'custom'

export interface ResolutionConfig {
  preset: ResolutionPreset
  label: string
  width: number
  height: number
  description: string
}

export interface AspectRatioSettings {
  preset: AspectRatioPreset
  customWidth?: number
  customHeight?: number
  resolutionPreset: ResolutionPreset
  customResolutionWidth?: number
  customResolutionHeight?: number
}

// WebGL Comparison Mode Types
export type WebGLComparisonCategory = 'difference' | 'structural' | 'color' | 'professional' | 'video' | 'weighting' | 'analysis' | 'exposure'

export type WebGLComparisonMode =
  // Debug
  | 'diff-debug'         // Debug - just show texture A
  // Difference Analysis (10 modes)
  | 'diff-absolute'      // RGB channel difference with amplification
  | 'diff-perceptual'    // Delta E in LAB color space
  | 'diff-luminance'     // Grayscale-only comparison
  | 'diff-chroma'        // Color-only comparison
  | 'diff-threshold'     // Binary black/white at threshold
  | 'diff-amplified'     // Magnify tiny differences 10x-100x
  | 'diff-wipe'          // Vertical wipe A/B comparison
  | 'diff-wipe-horizontal' // Horizontal wipe A/B comparison
  | 'diff-split'         // Side by side 50/50 split
  // Structural Analysis (5 modes)
  | 'struct-ssim'        // Local SSIM visualization
  | 'struct-edge'        // Sobel edge comparison
  | 'struct-gradient'    // Gradient magnitude comparison
  | 'struct-contrast'    // Local contrast comparison
  | 'struct-block'       // Block-based difference
  // Color Analysis (5 modes)
  | 'color-hue'          // Hue difference visualization
  | 'color-saturation'   // Saturation map
  | 'color-false'        // False color (rainbow gradient)
  | 'color-channels'     // R/G/B channel split
  | 'color-histogram'    // Histogram overlay
  // Professional Tools (6 modes)
  | 'pro-anaglyph'       // Red/cyan 3D view
  | 'pro-checkerboard'   // Alternating tiles
  | 'pro-onion'          // Semi-transparent overlay
  | 'pro-loupe'          // Wipe with magnifier
  | 'pro-frequency'      // Frequency split
  | 'pro-mask'           // Difference as mask
  // Video-Specific (4 modes)
  | 'video-temporal'     // Frame-to-frame difference
  | 'video-motion'       // Motion vector approximation
  | 'video-flicker'      // Flicker detection
  | 'video-blend'        // Frame blend
  // WEBGL-012: Perceptual Importance Weighting (3 modes)
  | 'weight-saliency'    // Saliency-based importance map
  | 'weight-edge'        // Edge-based importance weighting
  | 'weight-ssim'        // Weighted SSIM visualization
  // ANALYSIS-001, 002, 003: Advanced Structural Analysis (4 modes)
  | 'analysis-multiscale-edge'     // Multi-scale edge comparison (Laplacian pyramid)
  | 'analysis-local-contrast'      // Local contrast map (local std deviation)
  | 'analysis-gradient-direction'  // Gradient direction as hue
  | 'analysis-direction-histogram' // Direction histogram overlay
  // ANALYSIS-004: Optical Flow Visualization (3 variants)
  | 'analysis-optical-flow'        // Motion vectors with configurable block size
  | 'analysis-optical-flow-8'      // Fine-grained 8x8 block optical flow
  | 'analysis-optical-flow-32'     // Coarse 32x32 block optical flow
  // ANALYSIS-005: FFT Spectrum Visualization (2 modes)
  | 'analysis-fft-magnitude'       // Frequency spectrum magnitude (Laplacian approximation)
  | 'analysis-fft-phase'           // Phase spectrum via gradient direction
  // ANALYSIS-006: Band-Pass Frequency Filter (3 modes)
  | 'analysis-bandpass-low'        // Low-pass filter (structure only)
  | 'analysis-bandpass-high'       // High-pass filter (detail/noise only)
  | 'analysis-bandpass-band'       // Band-pass filter (specific range)
  // ANALYSIS-007: Temporal Noise Analysis (2 modes)
  | 'analysis-temporal-noise'      // Frame-to-frame noise (temporal vs static)
  | 'analysis-noise-variance'      // Spatial noise variance map
  // ANALYSIS-008: Frame Difference Accumulator (3 modes)
  | 'analysis-diff-accumulator'    // Max accumulation (any change ever)
  | 'analysis-diff-accumulator-avg' // Average accumulation (frequent changes)
  | 'analysis-motion-history'      // Motion history with decay
  // SCOPE-004 to SCOPE-007: Exposure Analysis (8 modes)
  | 'exposure-false-color'       // False Color exposure map
  | 'exposure-false-color-compare' // False Color A vs B comparison
  | 'exposure-focus-peak'        // Focus Peaking overlay
  | 'exposure-focus-peak-compare' // Focus Peaking A vs B comparison
  | 'exposure-zebra'             // Zebra Stripes overlay
  | 'exposure-zebra-compare'     // Zebra Stripes A vs B comparison
  | 'exposure-zone-system'       // Zone System overlay (Ansel Adams)
  | 'exposure-zone-compare'      // Zone System A vs B comparison

export type ComparisonColorScheme = 'grayscale' | 'heat' | 'rainbow' | 'redgreen' | 'custom'

// WEBGL-004: ROI (Region of Interest) rectangle in normalized coordinates (0-1)
export interface ROIRect {
  x: number       // Left edge (0-1)
  y: number       // Top edge (0-1)
  width: number   // Width (0-1)
  height: number  // Height (0-1)
}

export interface WebGLComparisonSettings {
  mode: WebGLComparisonMode
  amplification: number      // 1-100
  threshold: number          // 0-1
  blockSize: number          // 4, 8, 16, 32
  opacity: number            // 0-1 for overlays
  showOriginal: boolean      // Show original underneath
  colorScheme: ComparisonColorScheme
  // Loupe settings
  loupeSize: number          // 100-400 pixels
  loupeZoom: number          // 2-8x
  // Checkerboard settings
  checkerSize: number        // 8-128 pixels
  // Onion skin settings
  onionOpacity: number       // 0-1
  // WEBGL-001: Metrics overlay
  showMetricsOverlay: boolean
  // WEBGL-002: Scale bar
  showScaleBar: boolean
  scaleBarPosition: 'top' | 'bottom' | 'left' | 'right'
  // WEBGL-007: Zoom and pan
  webglZoom: number          // 1-10
  webglPanX: number          // -1 to 1
  webglPanY: number          // -1 to 1
  // WEBGL-008: A/B flip
  flipAB: boolean
  // WEBGL-003: Cursor value inspector
  showCursorInspector: boolean
  // WEBGL-004: ROI selection
  roi: ROIRect | null        // null = full frame
  showROIControls: boolean   // Show ROI drawing mode
  // WEBGL-012: Perceptual Importance Weighting
  useWeightedAnalysis: boolean    // Enable importance weighting
  weightMode: 'saliency' | 'edge' | 'center' | 'custom'  // Weighting method
  edgeWeight: number              // 0-1, importance of edges
  centerWeight: number            // 0-1, importance of center region
  showWeightMap: boolean          // Visualize importance weights
}

// WEBGL-001: Computed metrics for WebGL analysis
export interface WebGLAnalysisMetrics {
  ssim: number               // 0-1, Structural Similarity Index
  deltaE: number             // 0-100, perceptual color difference (CIE94)
  diffPixelPercent: number   // 0-100, percentage of pixels above threshold
  peakDifference: number     // 0-255, maximum pixel difference
  meanDifference: number     // 0-255, average pixel difference
  timestamp: number          // When metrics were computed
  // WEBGL-006: Threshold pass/fail stats
  passPixelCount: number     // Number of pixels passing threshold
  failPixelCount: number     // Number of pixels failing threshold
  totalPixelCount: number    // Total sampled pixels
}

export type BlendMode = 'difference' | 'overlay' | 'multiply' | 'screen'

export type SplitLayout = '2x1' | '1x2' | '2x2'

// MEDIA-012: Media Status Types
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'error'

export interface MediaFile {
  id: string
  name: string
  type: MediaType
  url: string
  file: File
  duration?: number
  width?: number
  height?: number
  thumbnail?: string
  promptText?: string
  waveformPeaks?: number[] // TL-006: Audio waveform peaks for timeline preview
  // MEDIA-012: Status tracking
  status: MediaStatus
  statusMessage?: string // Error message or processing info
  processingProgress?: number // 0-100 for progress display
  // Document-specific metadata (CSV, Excel, DOCX, PDF)
  documentMeta?: DocumentMetadata
}

// Document metadata for spreadsheets and documents
export interface DocumentMetadata {
  // CSV/Excel
  rowCount?: number
  columnCount?: number
  headers?: string[]
  sheetNames?: string[] // Excel only
  sheetCount?: number // Excel only
  // DOCX
  wordCount?: number
  paragraphCount?: number
  // PDF
  pageCount?: number
  hasText?: boolean // Whether PDF has extractable text
  // Common
  parsedContent?: ParsedDocumentContent
}

// Parsed document content for comparison
export interface ParsedDocumentContent {
  type: 'csv' | 'excel' | 'docx' | 'pdf'
  // CSV/Excel data
  sheets?: ParsedSheet[]
  // DOCX content
  html?: string // Rendered HTML from mammoth
  text?: string // Plain text extraction
  // PDF pages
  pages?: ParsedPDFPage[]
}

export interface ParsedSheet {
  name: string
  data: string[][] // 2D array of cell values
  headers?: string[]
}

export interface ParsedPDFPage {
  pageNumber: number
  text: string
  imageDataUrl?: string // Rendered page as image
}

// STITCH-002: Ease curve for clip timing
export interface EaseCurve {
  id: string
  name: string
  x1: number
  y1: number
  x2: number
  y2: number
}

// STITCH-004: Speed keyframe for ramping
export interface SpeedKeyframe {
  id: string
  time: number // 0-1 normalized position in clip
  speed: number // 0.1 to 10
  easeCurve: EaseCurve
}

// STITCH-004: Speed ramp configuration
export interface SpeedRamp {
  enabled: boolean
  keyframes: SpeedKeyframe[]
  reverse: boolean
}

// STITCH-003: Transition between clips
export interface ClipTransition {
  effectId: string
  duration: number // seconds
  easeCurve: EaseCurve
}

export interface TimelineClip {
  id: string
  mediaId: string
  trackId: string
  startTime: number
  endTime: number
  inPoint: number
  outPoint: number
  label?: string
  // Playback speed multiplier (0.25 to 4, default 1)
  speed?: number
  // Play clip in reverse
  reverse?: boolean
}

// Track types: 'a', 'b' are comparison tracks, 'audio' for audio-only, 'text' for captions, 'media' for additional video/image tracks
export type TrackType = 'a' | 'b' | 'audio' | 'text' | 'media'

export interface TimelineTrack {
  id: string
  name: string
  type: TrackType
  acceptedTypes: MediaType[]
  clips: TimelineClip[]
  muted: boolean
  locked: boolean
  // Track color for visual distinction
  color?: string
}

// Text element for caption/title tracks
export interface TextElement {
  id: string
  trackId: string
  startTime: number
  endTime: number
  text: string
  // Styling
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  color: string
  backgroundColor?: string
  // Position (0-100 percentage)
  positionX: number
  positionY: number
  // Alignment
  textAlign: 'left' | 'center' | 'right'
  // Animation
  animation?: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'typewriter'
}

export interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  duration: number
  comparisonMode: ComparisonMode
  blendMode: BlendMode
  splitLayout: SplitLayout
  sliderPosition: number
  sliderOrientation: 'vertical' | 'horizontal'
}

export type ExportSource = 'comparison' | 'a-only' | 'b-only'

export type SweepStyle = 'horizontal' | 'vertical' | 'diagonal' | 'circle' | 'rectangle' | 'spotlight' | 'spotlight-circle'

// WebGL Transition Types
export type TransitionEngine =
  | 'dissolve'
  | 'wipe'
  | 'zoom'
  | 'blur'
  | 'rotate'
  | 'light'
  | 'prism'
  | 'glitch'
  | 'morph'
  | 'pixelate'
  | 'refraction'
  | 'shutter'
  | 'other'
  | 'crossfade'

export type TransitionExportMode =
  | 'sequential'      // Full A → Transition → Full B
  | 'overlap'         // Videos overlap during transition
  | 'loop'            // A → B → A → B continuous
  | 'transition-only' // Just the transition

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'gif'
  resolution: '720p' | '1080p' | '4k'
  quality: 'low' | 'medium' | 'high'
  fps: 24 | 30 | 60
  gifPreset?: 'small' | 'medium' | 'large' | 'hd'
  // Export source options
  exportSource: ExportSource
  sliderPosition: number // 0-100, only for comparison export
  loopShorterVideo: boolean // Loop shorter video to match longer
  // Sweep export settings
  videoLoops: number // Number of times the video plays through
  sweepsPerLoop: number // Number of sweep animations per video loop
  sweepStyle: SweepStyle // Animation style for sweep
  // Spotlight rectangle settings (0-1 normalized)
  spotlightWidth: number
  spotlightHeight: number
  spotlightSpeed: number // Speed multiplier for DVD bounce (0.1-5)
  // WebGL Transition settings
  useTransition: boolean
  transitionEngine: TransitionEngine
  transitionVariant: string
  transitionDuration: number      // 0.5 - 5.0 seconds
  transitionIntensity: number     // 0 - 1
  transitionExportMode: TransitionExportMode
}

export interface ExportProgress {
  status: 'idle' | 'preparing' | 'encoding' | 'done' | 'error'
  progress: number
  message: string
}

// MODE-001: Quad View Settings
export interface QuadViewSettings {
  sources: [string | null, string | null, string | null, string | null] // Media IDs for 4 quadrants
  expandedQuadrant: number | null  // 0-3 for expanded view, null for 2x2 grid
  showDifference: boolean          // Show difference between selected quadrants
  diffQuadrants: [number, number]  // Which two quadrants to compare [0-3, 0-3]
}

// MODE-002: Radial Loupe Settings
export interface RadialLoupeSettings {
  radius: number          // 50-300px
  magnification: number   // 2-16x
  featherEdge: boolean    // Smooth edge feathering
  splitMode: boolean      // A|B split inside circle
  locked: boolean         // Lock position on click
  lockedPosition: { x: number; y: number } | null
  showRectangular: boolean // Toggle between radial and rectangular loupe
}

// MODE-003: Grid Tile Settings
export interface GridTileSettings {
  tileSize: number        // 8-256px
  animated: boolean       // Animated tile swap
  animationSpeed: number  // 0.5-5 seconds per swap
  offsetX: number         // Grid offset X (0-1)
  offsetY: number         // Grid offset Y (0-1)
  hexagonal: boolean      // Use hexagonal grid pattern
}

// MODE-004: Pixel Grid Overlay Settings
export interface PixelGridSettings {
  enabled: boolean        // Show pixel grid
  showRGBValues: boolean  // Show RGB values in cells
  gridColor: 'white' | 'black' | 'auto' // Grid line color
  minZoomLevel: number    // Min zoom to show grid (default 800%)
}

// MODE-005: Morphological Operations Settings
export type MorphOperation = 'erosion' | 'dilation' | 'opening' | 'closing' | 'gradient'
export type MorphElementSize = 3 | 5 | 7
export type MorphElementShape = 'square' | 'circle' | 'cross'

export interface MorphologicalSettings {
  operations: MorphOperation[]     // Chain of operations
  elementSize: MorphElementSize    // 3x3, 5x5, 7x7
  elementShape: MorphElementShape  // square, circle, cross
  showOriginal: boolean            // Show original underneath
}

// SCOPE-001, SCOPE-002, SCOPE-003: Professional Video Scopes
export type ScopeType = 'waveform' | 'vectorscope' | 'parade'

export interface ScopesSettings {
  // Global scope settings
  showScopes: boolean
  scopeSource: 'a' | 'b' | 'comparison'
  scopeIntensity: number      // 0.5-3.0, brightness of scope display
  scopeHeight: number         // Panel height in pixels (200-400)

  // SCOPE-001: Waveform Monitor
  showWaveform: boolean
  waveformMode: 'luma' | 'parade'  // Luma only or RGB Parade

  // SCOPE-002: Vectorscope
  showVectorscope: boolean
  vectorscopeZoom: number     // 1-4x magnification
  showSkinToneLine: boolean   // Show skin tone indicator (~123 degrees)

  // SCOPE-003: RGB Parade
  showParade: boolean
  paradeChannelIsolation: 'all' | 'r' | 'g' | 'b'  // Show all or isolate channel
}
