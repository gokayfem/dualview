import { useState, useMemo, useRef } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { cn } from '../../lib/utils'
import { FileText, Columns, Layers, Eye, ChevronLeft, ChevronRight, BarChart3, AlertTriangle } from 'lucide-react'
import { diffWords } from 'diff'
import type { ParsedPDFPage } from '../../types'

type ViewMode = 'side-by-side' | 'overlay' | 'slider' | 'text'

interface PageDiff {
  pageNumber: number
  similarity: number // 0-100
  hasTextChanges: boolean
}

export function PDFComparison() {
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()

  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [currentPage, setCurrentPage] = useState(1)
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)
  const [sliderPosition, setSliderPosition] = useState(50)
  const [showThumbnails, setShowThumbnails] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)

  // Get current clips at playhead
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')

  const clipA = trackA?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)
  const clipB = trackB?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)

  const mediaA = clipA ? getFile(clipA.mediaId) : null
  const mediaB = clipB ? getFile(clipB.mediaId) : null

  // Get parsed PDF data
  const pagesA: ParsedPDFPage[] = useMemo(() => {
    return mediaA?.documentMeta?.parsedContent?.pages || []
  }, [mediaA])

  const pagesB: ParsedPDFPage[] = useMemo(() => {
    return mediaB?.documentMeta?.parsedContent?.pages || []
  }, [mediaB])

  const maxPages = Math.max(pagesA.length, pagesB.length)

  // Current page content
  const pageA = pagesA[currentPage - 1]
  const pageB = pagesB[currentPage - 1]

  // Calculate page differences
  const pageDiffs = useMemo(() => {
    const diffs: PageDiff[] = []

    for (let i = 0; i < maxPages; i++) {
      const textA = pagesA[i]?.text || ''
      const textB = pagesB[i]?.text || ''

      // Simple text similarity
      const wordsA = new Set(textA.toLowerCase().split(/\s+/))
      const wordsB = new Set(textB.toLowerCase().split(/\s+/))
      const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
      const union = new Set([...wordsA, ...wordsB])
      const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 100

      const hasTextChanges = textA !== textB

      diffs.push({
        pageNumber: i + 1,
        similarity,
        hasTextChanges
      })
    }

    return diffs
  }, [pagesA, pagesB, maxPages])

  // Calculate text diff for current page
  const textDiff = useMemo(() => {
    const textA = pageA?.text || ''
    const textB = pageB?.text || ''
    return diffWords(textA, textB)
  }, [pageA, pageB])

  // Statistics
  const stats = useMemo(() => {
    const hasTextA = mediaA?.documentMeta?.hasText
    const hasTextB = mediaB?.documentMeta?.hasText

    let changedPages = 0
    let avgSimilarity = 0

    pageDiffs.forEach(diff => {
      if (diff.hasTextChanges) changedPages++
      avgSimilarity += diff.similarity
    })

    avgSimilarity = maxPages > 0 ? avgSimilarity / maxPages : 100

    return {
      pagesA: pagesA.length,
      pagesB: pagesB.length,
      hasTextA,
      hasTextB,
      changedPages,
      avgSimilarity: avgSimilarity.toFixed(1)
    }
  }, [pagesA, pagesB, pageDiffs, maxPages, mediaA, mediaB])

  if (pagesA.length === 0 && pagesB.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No PDF files loaded</p>
          <p className="text-sm mt-2">Upload PDF files to Track A and Track B</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-alt border-b border-border">
        <div className="flex items-center gap-2">
          {/* View mode buttons */}
          <div className="flex items-center bg-background rounded overflow-hidden">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                viewMode === 'side-by-side'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Columns className="w-3 h-3" />
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('overlay')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                viewMode === 'overlay'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Layers className="w-3 h-3" />
              Overlay
            </button>
            <button
              onClick={() => setViewMode('slider')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                viewMode === 'slider'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Eye className="w-3 h-3" />
              Slider
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                viewMode === 'text'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <FileText className="w-3 h-3" />
              Text
            </button>
          </div>

          {/* View options */}
          {viewMode === 'overlay' && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Opacity:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={overlayOpacity * 100}
                onChange={(e) => setOverlayOpacity(parseInt(e.target.value) / 100)}
                className="w-20"
              />
              <span>{Math.round(overlayOpacity * 100)}%</span>
            </div>
          )}

          {/* Page navigation */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-surface rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-text-muted px-2">
              Page {currentPage} / {maxPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(maxPages, p + 1))}
              disabled={currentPage >= maxPages}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-surface rounded disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="flex items-center gap-4 text-xs">
          {(!stats.hasTextA || !stats.hasTextB) && (
            <div className="flex items-center gap-1 text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              <span>Scanned PDF detected</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-text-muted" />
            <span className="text-text-muted">Similarity:</span>
            <span className="text-green-400 font-medium">{stats.avgSimilarity}%</span>
          </div>
          <div className="text-text-muted">
            Changed: {stats.changedPages}/{maxPages} pages
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnails sidebar */}
        {showThumbnails && (
          <div className="w-32 bg-surface-alt border-r border-border overflow-y-auto p-2 flex flex-col gap-2">
            {Array.from({ length: maxPages }).map((_, idx) => {
              const pageNum = idx + 1
              const diff = pageDiffs[idx]
              const thumbA = pagesA[idx]?.imageDataUrl
              // thumbB available for future B-side thumbnail display
              void pagesB[idx]?.imageDataUrl

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    'relative p-1 rounded border-2 transition-colors',
                    currentPage === pageNum
                      ? 'border-accent'
                      : diff?.hasTextChanges
                        ? 'border-yellow-500/50 hover:border-yellow-500'
                        : 'border-border hover:border-text-muted'
                  )}
                >
                  <div className="relative aspect-[3/4] bg-white rounded overflow-hidden">
                    {thumbA && (
                      <img
                        src={thumbA}
                        alt={`Page ${pageNum}`}
                        className="w-full h-full object-contain"
                      />
                    )}
                    {diff?.hasTextChanges && (
                      <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-yellow-500 rounded-full" />
                    )}
                  </div>
                  <div className="text-[10px] text-text-muted text-center mt-1">
                    {pageNum}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Page view */}
        <div className="flex-1 overflow-hidden" ref={containerRef}>
          {viewMode === 'side-by-side' && (
            <div className="flex h-full">
              {/* Page A */}
              <div className="flex-1 flex flex-col border-r border-border">
                <div className="px-3 py-1 bg-orange-500/10 border-b border-border text-xs font-medium text-orange-400">
                  A: {mediaA?.name || 'No file'}
                </div>
                <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-neutral-800">
                  {pageA?.imageDataUrl ? (
                    <img
                      src={pageA.imageDataUrl}
                      alt={`Page ${currentPage} A`}
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                  ) : (
                    <div className="text-text-muted">No page</div>
                  )}
                </div>
              </div>

              {/* Page B */}
              <div className="flex-1 flex flex-col">
                <div className="px-3 py-1 bg-lime-400/10 border-b border-border text-xs font-medium text-lime-400">
                  B: {mediaB?.name || 'No file'}
                </div>
                <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-neutral-800">
                  {pageB?.imageDataUrl ? (
                    <img
                      src={pageB.imageDataUrl}
                      alt={`Page ${currentPage} B`}
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                  ) : (
                    <div className="text-text-muted">No page</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'overlay' && (
            <div className="h-full flex items-center justify-center p-4 bg-neutral-800">
              <div className="relative">
                {pageA?.imageDataUrl && (
                  <img
                    src={pageA.imageDataUrl}
                    alt={`Page ${currentPage} A`}
                    className="max-w-full max-h-[80vh] object-contain shadow-lg"
                  />
                )}
                {pageB?.imageDataUrl && (
                  <img
                    src={pageB.imageDataUrl}
                    alt={`Page ${currentPage} B`}
                    className="absolute inset-0 max-w-full max-h-[80vh] object-contain"
                    style={{ opacity: overlayOpacity }}
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === 'slider' && (
            <div
              className="h-full flex items-center justify-center p-4 bg-neutral-800 cursor-ew-resize"
              onMouseDown={() => {
                const handleMove = (e: MouseEvent) => {
                  if (!containerRef.current) return
                  const rect = containerRef.current.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
                  setSliderPosition(percent)
                }
                const handleUp = () => {
                  window.removeEventListener('mousemove', handleMove)
                  window.removeEventListener('mouseup', handleUp)
                }
                window.addEventListener('mousemove', handleMove)
                window.addEventListener('mouseup', handleUp)
              }}
            >
              <div className="relative">
                {pageA?.imageDataUrl && (
                  <img
                    src={pageA.imageDataUrl}
                    alt={`Page ${currentPage} A`}
                    className="max-w-full max-h-[80vh] object-contain shadow-lg"
                  />
                )}
                {pageB?.imageDataUrl && (
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                  >
                    <img
                      src={pageB.imageDataUrl}
                      alt={`Page ${currentPage} B`}
                      className="max-w-full max-h-[80vh] object-contain"
                    />
                  </div>
                )}
                {/* Slider line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow-lg">
                    <ChevronLeft className="w-3 h-3 text-white" />
                    <ChevronRight className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'text' && (
            <div className="h-full overflow-auto p-4">
              <div className="max-w-4xl mx-auto">
                <div className="mb-4 text-xs text-text-muted">
                  Page {currentPage} Text Comparison
                </div>
                <div className="text-sm leading-relaxed">
                  {textDiff.map((part, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        part.added && 'bg-green-500/20 text-green-400',
                        part.removed && 'bg-red-500/20 text-red-400 line-through'
                      )}
                    >
                      {part.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-alt border-t border-border text-xs text-text-muted">
        <div className="flex items-center gap-4">
          <span>Pages: A={stats.pagesA}, B={stats.pagesB}</span>
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className="text-text-muted hover:text-text-primary"
          >
            {showThumbnails ? 'Hide' : 'Show'} Thumbnails
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-yellow-500/50 rounded"></span>
          <span>Changed Page</span>
        </div>
      </div>
    </div>
  )
}
