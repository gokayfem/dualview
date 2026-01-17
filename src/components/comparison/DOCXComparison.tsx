import { useState, useMemo, useRef } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { cn } from '../../lib/utils'
import { FileText, Columns, AlignJustify, Filter, BarChart3, ChevronUp, ChevronDown } from 'lucide-react'
import { diffWords } from 'diff'

type ViewMode = 'side-by-side' | 'unified' | 'changes-only'

interface TextDiff {
  value: string
  added?: boolean
  removed?: boolean
}

export function DOCXComparison() {
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()

  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [syncScroll, setSyncScroll] = useState(true)
  const [showHtml, setShowHtml] = useState(true)
  const [currentChangeIdx, setCurrentChangeIdx] = useState(0)

  const scrollRefA = useRef<HTMLDivElement>(null)
  const scrollRefB = useRef<HTMLDivElement>(null)
  const changeRefs = useRef<(HTMLSpanElement | null)[]>([])

  // Get current clips at playhead
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')

  const clipA = trackA?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)
  const clipB = trackB?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)

  const mediaA = clipA ? getFile(clipA.mediaId) : null
  const mediaB = clipB ? getFile(clipB.mediaId) : null

  // Get parsed DOCX data
  const contentA = useMemo(() => {
    return mediaA?.documentMeta?.parsedContent || null
  }, [mediaA])

  const contentB = useMemo(() => {
    return mediaB?.documentMeta?.parsedContent || null
  }, [mediaB])

  // Calculate word-level diff
  const textDiffs = useMemo(() => {
    const textA = contentA?.text || ''
    const textB = contentB?.text || ''

    if (!textA && !textB) return []

    // Use diff library for word-level comparison
    const diffs = diffWords(textA, textB)
    return diffs as TextDiff[]
  }, [contentA, contentB])

  // Find change positions for navigation
  const changePositions = useMemo(() => {
    const positions: number[] = []
    textDiffs.forEach((diff, idx) => {
      if (diff.added || diff.removed) {
        positions.push(idx)
      }
    })
    return positions
  }, [textDiffs])

  // Calculate statistics
  const stats = useMemo(() => {
    const textA = contentA?.text || ''
    const textB = contentB?.text || ''

    const wordsA = textA.trim().split(/\s+/).filter(w => w.length > 0).length
    const wordsB = textB.trim().split(/\s+/).filter(w => w.length > 0).length

    let added = 0
    let removed = 0

    textDiffs.forEach(diff => {
      const words = diff.value.trim().split(/\s+/).filter(w => w.length > 0).length
      if (diff.added) added += words
      if (diff.removed) removed += words
    })

    const total = Math.max(wordsA, wordsB)
    const unchanged = total - Math.max(added, removed)
    const matchPercent = total > 0 ? ((unchanged / total) * 100).toFixed(1) : '100'

    return {
      wordsA,
      wordsB,
      paragraphsA: mediaA?.documentMeta?.paragraphCount || 0,
      paragraphsB: mediaB?.documentMeta?.paragraphCount || 0,
      added,
      removed,
      unchanged,
      matchPercent,
      totalChanges: changePositions.length
    }
  }, [contentA, contentB, textDiffs, changePositions, mediaA, mediaB])

  // Synced scroll handler
  const handleScroll = (source: 'a' | 'b') => {
    if (!syncScroll) return
    const srcRef = source === 'a' ? scrollRefA : scrollRefB
    const dstRef = source === 'a' ? scrollRefB : scrollRefA

    if (srcRef.current && dstRef.current) {
      const scrollRatio = srcRef.current.scrollTop / (srcRef.current.scrollHeight - srcRef.current.clientHeight)
      dstRef.current.scrollTop = scrollRatio * (dstRef.current.scrollHeight - dstRef.current.clientHeight)
    }
  }

  // Navigate to change
  const navigateToChange = (direction: 'prev' | 'next') => {
    if (changePositions.length === 0) return

    let newIdx = currentChangeIdx
    if (direction === 'next') {
      newIdx = (currentChangeIdx + 1) % changePositions.length
    } else {
      newIdx = (currentChangeIdx - 1 + changePositions.length) % changePositions.length
    }

    setCurrentChangeIdx(newIdx)

    // Scroll to change
    const changeRef = changeRefs.current[changePositions[newIdx]]
    if (changeRef) {
      changeRef.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  if (!contentA && !contentB) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No Word documents loaded</p>
          <p className="text-sm mt-2">Upload DOCX files to Track A and Track B</p>
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
              onClick={() => setViewMode('unified')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                viewMode === 'unified'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <AlignJustify className="w-3 h-3" />
              Unified
            </button>
            <button
              onClick={() => setViewMode('changes-only')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                viewMode === 'changes-only'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Filter className="w-3 h-3" />
              Changes Only
            </button>
          </div>

          {/* View options */}
          {viewMode === 'side-by-side' && (
            <>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={syncScroll}
                  onChange={(e) => setSyncScroll(e.target.checked)}
                  className="rounded"
                />
                Sync Scroll
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={showHtml}
                  onChange={(e) => setShowHtml(e.target.checked)}
                  className="rounded"
                />
                Show Formatting
              </label>
            </>
          )}

          {/* Change navigation */}
          {changePositions.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => navigateToChange('prev')}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-surface rounded"
                title="Previous change"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-muted">
                {currentChangeIdx + 1}/{changePositions.length}
              </span>
              <button
                onClick={() => navigateToChange('next')}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-surface rounded"
                title="Next change"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-text-muted" />
            <span className="text-text-muted">Similarity:</span>
            <span className="text-green-400 font-medium">{stats.matchPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">+{stats.added}</span>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">-{stats.removed}</span>
          </div>
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'side-by-side' ? (
          <div className="flex h-full">
            {/* Document A */}
            <div className="flex-1 flex flex-col border-r border-border">
              <div className="px-3 py-2 bg-orange-500/10 border-b border-border text-xs font-medium text-orange-400">
                A: {mediaA?.name || 'No file'} ({stats.wordsA} words, {stats.paragraphsA} paragraphs)
              </div>
              <div
                ref={scrollRefA}
                className="flex-1 overflow-auto p-4"
                onScroll={() => handleScroll('a')}
              >
                {showHtml && contentA?.html ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: contentA.html }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {contentA?.text || ''}
                  </div>
                )}
              </div>
            </div>

            {/* Document B */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 bg-lime-400/10 border-b border-border text-xs font-medium text-lime-400">
                B: {mediaB?.name || 'No file'} ({stats.wordsB} words, {stats.paragraphsB} paragraphs)
              </div>
              <div
                ref={scrollRefB}
                className="flex-1 overflow-auto p-4"
                onScroll={() => handleScroll('b')}
              >
                {showHtml && contentB?.html ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: contentB.html }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {contentB?.text || ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Unified/Changes view */
          <div className="h-full overflow-auto p-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-sm leading-relaxed">
                {textDiffs.map((diff, idx) => {
                  // Skip unchanged text in changes-only mode
                  if (viewMode === 'changes-only' && !diff.added && !diff.removed) {
                    // Show ellipsis for context
                    if (idx > 0 && idx < textDiffs.length - 1) {
                      const prevDiff = textDiffs[idx - 1]
                      const nextDiff = textDiffs[idx + 1]
                      if ((prevDiff.added || prevDiff.removed) || (nextDiff.added || nextDiff.removed)) {
                        return (
                          <span key={idx} className="text-text-muted">
                            {diff.value.slice(0, 50)}...
                          </span>
                        )
                      }
                    }
                    return null
                  }

                  const isChange = diff.added || diff.removed
                  const isCurrentChange = changePositions[currentChangeIdx] === idx

                  return (
                    <span
                      key={idx}
                      ref={el => { if (isChange) changeRefs.current[idx] = el }}
                      className={cn(
                        diff.added && 'bg-green-500/20 text-green-400',
                        diff.removed && 'bg-red-500/20 text-red-400 line-through',
                        isCurrentChange && 'ring-2 ring-accent ring-offset-2 ring-offset-background rounded'
                      )}
                    >
                      {diff.value}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-alt border-t border-border text-xs text-text-muted">
        <div className="flex items-center gap-4">
          <span>Words: A={stats.wordsA}, B={stats.wordsB}</span>
          <span>Paragraphs: A={stats.paragraphsA}, B={stats.paragraphsB}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500/20 rounded"></span>
          <span>Added</span>
          <span className="w-3 h-3 bg-red-500/20 rounded ml-2"></span>
          <span>Removed</span>
        </div>
      </div>
    </div>
  )
}
