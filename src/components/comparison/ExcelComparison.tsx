import { useState, useMemo, useRef } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useMediaStore } from '../../stores/mediaStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { cn } from '../../lib/utils'
import { Table, Columns, Filter, BarChart3, FileSpreadsheet } from 'lucide-react'
import type { ParsedSheet } from '../../types'

type ViewMode = 'side-by-side' | 'unified' | 'changes-only'

interface CellDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  valueA?: string
  valueB?: string
}

export function ExcelComparison() {
  const { tracks } = useTimelineStore()
  const { currentTime } = usePlaybackStore()
  const { getFile } = useMediaStore()

  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [syncScroll, setSyncScroll] = useState(true)
  const [activeSheetA, setActiveSheetA] = useState(0)
  const [activeSheetB, setActiveSheetB] = useState(0)

  const scrollRefA = useRef<HTMLDivElement>(null)
  const scrollRefB = useRef<HTMLDivElement>(null)

  // Get current clips at playhead
  const trackA = tracks.find(t => t.type === 'a')
  const trackB = tracks.find(t => t.type === 'b')

  const clipA = trackA?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)
  const clipB = trackB?.clips.find(c => currentTime >= c.startTime && currentTime < c.endTime)

  const mediaA = clipA ? getFile(clipA.mediaId) : null
  const mediaB = clipB ? getFile(clipB.mediaId) : null

  // Get parsed Excel data
  const sheetsA = useMemo(() => {
    return mediaA?.documentMeta?.parsedContent?.sheets || []
  }, [mediaA])

  const sheetsB = useMemo(() => {
    return mediaB?.documentMeta?.parsedContent?.sheets || []
  }, [mediaB])

  const dataA: ParsedSheet | null = sheetsA[activeSheetA] || null
  const dataB: ParsedSheet | null = sheetsB[activeSheetB] || null

  // Calculate cell diffs for current sheets
  const cellDiffs = useMemo(() => {
    if (!dataA && !dataB) return []

    const maxRows = Math.max(dataA?.data.length || 0, dataB?.data.length || 0)
    const maxCols = Math.max(
      dataA?.data[0]?.length || 0,
      dataB?.data[0]?.length || 0
    )

    const diffs: CellDiff[][] = []

    for (let row = 0; row < maxRows; row++) {
      const rowDiffs: CellDiff[] = []
      for (let col = 0; col < maxCols; col++) {
        const valueA = dataA?.data[row]?.[col] || ''
        const valueB = dataB?.data[row]?.[col] || ''

        if (valueA === valueB) {
          rowDiffs.push({ type: 'unchanged', valueA, valueB })
        } else if (!valueA && valueB) {
          rowDiffs.push({ type: 'added', valueA, valueB })
        } else if (valueA && !valueB) {
          rowDiffs.push({ type: 'removed', valueA, valueB })
        } else {
          rowDiffs.push({ type: 'modified', valueA, valueB })
        }
      }
      diffs.push(rowDiffs)
    }

    return diffs
  }, [dataA, dataB])

  // Calculate statistics
  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    let modified = 0
    let unchanged = 0

    cellDiffs.forEach(row => {
      row.forEach(cell => {
        switch (cell.type) {
          case 'added': added++; break
          case 'removed': removed++; break
          case 'modified': modified++; break
          case 'unchanged': unchanged++; break
        }
      })
    })

    const total = added + removed + modified + unchanged
    const matchPercent = total > 0 ? ((unchanged / total) * 100).toFixed(1) : '0'

    return {
      sheetsA: sheetsA.length,
      sheetsB: sheetsB.length,
      rowsA: dataA?.data.length || 0,
      rowsB: dataB?.data.length || 0,
      added,
      removed,
      modified,
      unchanged,
      matchPercent
    }
  }, [cellDiffs, dataA, dataB, sheetsA, sheetsB])

  // Synced scroll handler
  const handleScroll = (source: 'a' | 'b') => {
    if (!syncScroll) return
    const srcRef = source === 'a' ? scrollRefA : scrollRefB
    const dstRef = source === 'a' ? scrollRefB : scrollRefA

    if (srcRef.current && dstRef.current) {
      dstRef.current.scrollTop = srcRef.current.scrollTop
      dstRef.current.scrollLeft = srcRef.current.scrollLeft
    }
  }

  // Filter rows for changes-only mode
  const filteredDiffs = useMemo(() => {
    if (viewMode !== 'changes-only') return cellDiffs
    return cellDiffs.filter(row =>
      row.some(cell => cell.type !== 'unchanged')
    )
  }, [cellDiffs, viewMode])

  // Get column letter (A, B, C, ..., AA, AB, etc.)
  const getColumnLetter = (idx: number): string => {
    let letter = ''
    while (idx >= 0) {
      letter = String.fromCharCode((idx % 26) + 65) + letter
      idx = Math.floor(idx / 26) - 1
    }
    return letter
  }

  const getCellClass = (type: CellDiff['type']) => {
    switch (type) {
      case 'added': return 'bg-green-500/20 text-green-400'
      case 'removed': return 'bg-red-500/20 text-red-400 line-through'
      case 'modified': return 'bg-yellow-500/20 text-yellow-400'
      default: return ''
    }
  }

  if (sheetsA.length === 0 && sheetsB.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No Excel files loaded</p>
          <p className="text-sm mt-2">Upload Excel files (.xlsx, .xls) to Track A and Track B</p>
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
              <Table className="w-3 h-3" />
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

          {/* Sync scroll toggle */}
          {viewMode === 'side-by-side' && (
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                className="rounded"
              />
              Sync Scroll
            </label>
          )}
        </div>

        {/* Statistics */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-text-muted" />
            <span className="text-text-muted">Match:</span>
            <span className="text-green-400 font-medium">{stats.matchPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">+{stats.added}</span>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">-{stats.removed}</span>
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">~{stats.modified}</span>
          </div>
        </div>
      </div>

      {/* Table content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'side-by-side' ? (
          <div className="flex h-full">
            {/* Table A */}
            <div className="flex-1 flex flex-col border-r border-border">
              <div className="px-3 py-2 bg-orange-500/10 border-b border-border text-xs font-medium text-orange-400">
                A: {mediaA?.name || 'No file'} ({stats.rowsA} rows)
              </div>
              <div
                ref={scrollRefA}
                className="flex-1 overflow-auto"
                onScroll={() => handleScroll('a')}
              >
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-surface-alt z-10">
                    <tr className="border-b border-border">
                      <th className="px-2 py-1 text-text-muted font-medium w-10">#</th>
                      {Array.from({ length: cellDiffs[0]?.length || 0 }).map((_, idx) => (
                        <th key={idx} className="px-2 py-1 text-text-muted font-medium text-center min-w-[60px]">
                          {getColumnLetter(idx)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiffs.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-border/50">
                        <td className="px-2 py-1 text-text-muted bg-surface-alt sticky left-0 border-r border-border w-10 text-right">
                          {rowIdx + 1}
                        </td>
                        {row.map((cell, colIdx) => (
                          <td
                            key={colIdx}
                            className={cn(
                              'px-2 py-1 border-r border-border/30 whitespace-nowrap',
                              getCellClass(cell.type === 'added' ? 'unchanged' : cell.type)
                            )}
                            title={`${getColumnLetter(colIdx)}${rowIdx + 1}`}
                          >
                            {cell.valueA || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Sheet tabs for A */}
              <div className="flex items-center gap-1 px-2 py-1 bg-surface-alt border-t border-border overflow-x-auto">
                {sheetsA.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSheetA(idx)}
                    className={cn(
                      'px-3 py-1 text-xs rounded whitespace-nowrap',
                      activeSheetA === idx
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface'
                    )}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Table B */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 bg-lime-400/10 border-b border-border text-xs font-medium text-lime-400">
                B: {mediaB?.name || 'No file'} ({stats.rowsB} rows)
              </div>
              <div
                ref={scrollRefB}
                className="flex-1 overflow-auto"
                onScroll={() => handleScroll('b')}
              >
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-surface-alt z-10">
                    <tr className="border-b border-border">
                      <th className="px-2 py-1 text-text-muted font-medium w-10">#</th>
                      {Array.from({ length: cellDiffs[0]?.length || 0 }).map((_, idx) => (
                        <th key={idx} className="px-2 py-1 text-text-muted font-medium text-center min-w-[60px]">
                          {getColumnLetter(idx)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiffs.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-border/50">
                        <td className="px-2 py-1 text-text-muted bg-surface-alt sticky left-0 border-r border-border w-10 text-right">
                          {rowIdx + 1}
                        </td>
                        {row.map((cell, colIdx) => (
                          <td
                            key={colIdx}
                            className={cn(
                              'px-2 py-1 border-r border-border/30 whitespace-nowrap',
                              getCellClass(cell.type === 'removed' ? 'unchanged' : cell.type)
                            )}
                            title={`${getColumnLetter(colIdx)}${rowIdx + 1}`}
                          >
                            {cell.valueB || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Sheet tabs for B */}
              <div className="flex items-center gap-1 px-2 py-1 bg-surface-alt border-t border-border overflow-x-auto">
                {sheetsB.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSheetB(idx)}
                    className={cn(
                      'px-3 py-1 text-xs rounded whitespace-nowrap',
                      activeSheetB === idx
                        ? 'bg-lime-400/20 text-lime-400'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface'
                    )}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Unified view */
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-surface-alt z-10">
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 text-left text-text-muted font-medium w-10">#</th>
                    {Array.from({ length: cellDiffs[0]?.length || 0 }).map((_, idx) => (
                      <th key={idx} className="px-2 py-2 text-center text-text-muted font-medium min-w-[60px]">
                        {getColumnLetter(idx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDiffs.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-border/50 hover:bg-surface-alt/50">
                      <td className="px-2 py-1 text-text-muted bg-surface-alt sticky left-0 border-r border-border text-right">
                        {rowIdx + 1}
                      </td>
                      {row.map((cell, colIdx) => (
                        <td
                          key={colIdx}
                          className={cn(
                            'px-2 py-1 border-r border-border/30',
                            getCellClass(cell.type)
                          )}
                          title={`${getColumnLetter(colIdx)}${rowIdx + 1}`}
                        >
                          {cell.type === 'modified' ? (
                            <div className="flex flex-col">
                              <span className="line-through text-red-400/70">{cell.valueA}</span>
                              <span className="text-green-400">{cell.valueB}</span>
                            </div>
                          ) : cell.type === 'added' ? (
                            cell.valueB
                          ) : (
                            cell.valueA || cell.valueB
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Sheet tabs for unified view */}
            <div className="flex items-center gap-4 px-2 py-1 bg-surface-alt border-t border-border">
              <div className="flex items-center gap-1">
                <span className="text-xs text-orange-400 mr-2">A:</span>
                {sheetsA.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSheetA(idx)}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded whitespace-nowrap',
                      activeSheetA === idx
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1">
                <span className="text-xs text-lime-400 mr-2">B:</span>
                {sheetsB.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSheetB(idx)}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded whitespace-nowrap',
                      activeSheetB === idx
                        ? 'bg-lime-400/20 text-lime-400'
                        : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-alt border-t border-border text-xs text-text-muted">
        <div className="flex items-center gap-4">
          <span>Sheets: A={stats.sheetsA}, B={stats.sheetsB}</span>
          <span>Rows: A={stats.rowsA}, B={stats.rowsB}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500/20 rounded"></span>
          <span>Added</span>
          <span className="w-3 h-3 bg-red-500/20 rounded ml-2"></span>
          <span>Removed</span>
          <span className="w-3 h-3 bg-yellow-500/20 rounded ml-2"></span>
          <span>Modified</span>
        </div>
      </div>
    </div>
  )
}
