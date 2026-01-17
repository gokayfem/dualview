/**
 * Clip Context Menu (TL-013)
 *
 * Right-click context menu for timeline clips with common actions.
 * All options are FULLY FUNCTIONAL.
 */
import { useEffect, useRef, useState } from 'react'
import { useTimelineStore } from '../../stores/timelineStore'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useHistoryStore } from '../../stores/historyStore'
import {
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  CopyPlus,
  ArrowLeftToLine,
  ArrowRightToLine,
  Gauge,
  ChevronRight,
  RotateCcw,
  FlipHorizontal,
  Replace,
  AudioLines,
} from 'lucide-react'
import { useMediaStore } from '../../stores/mediaStore'

interface ClipContextMenuProps {
  x: number
  y: number
  clipId: string
  trackId: string
  onClose: () => void
}

export function ClipContextMenu({
  x, y, clipId, trackId, onClose,
}: ClipContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showSpeedSubmenu, setShowSpeedSubmenu] = useState(false)
  const [showReplaceSubmenu, setShowReplaceSubmenu] = useState(false)
  const { currentTime } = usePlaybackStore()
  const {
    removeClip,
    splitClip,
    splitAndKeepLeft,
    splitAndKeepRight,
    duplicateClip,
    copyClip,
    pasteClip,
    clipboardClipId,
    tracks,
    updateClip,
    replaceClipMedia,
    separateAudio,
  } = useTimelineStore()
  const { pushState } = useHistoryStore()
  const { files, getFile } = useMediaStore()

  // Find track and clip
  const track = tracks.find(t => t.id === trackId)
  const clip = track?.clips.find(c => c.id === clipId)
  const isLocked = track?.locked || false
  const currentSpeed = clip?.speed || 1

  // Get current media info for context-aware options
  const currentMedia = clip ? getFile(clip.mediaId) : null
  const isVideoClip = currentMedia?.type === 'video'

  // Get compatible media files for replacement (same type preferred)
  const compatibleMedia = files.filter(f =>
    f.id !== clip?.mediaId &&
    (f.type === currentMedia?.type || track?.acceptedTypes.includes(f.type))
  )

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`
      }
    }
  }, [x, y])

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  const setSpeed = (speed: number) => {
    pushState()
    updateClip(clipId, { speed })
    onClose()
  }

  const resetClip = () => {
    pushState()
    updateClip(clipId, { speed: 1, reverse: false })
    onClose()
  }

  const toggleReverse = () => {
    pushState()
    updateClip(clipId, { reverse: !clip?.reverse })
    onClose()
  }

  const speedOptions = [
    { label: '0.25x', value: 0.25 },
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1x (Normal)', value: 1 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '2x', value: 2 },
    { label: '4x', value: 4 },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] bg-surface border border-border shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {/* Copy/Paste Section */}
      <MenuButton
        icon={Copy}
        label="Copy"
        shortcut="⌘C"
        onClick={() => handleAction(() => copyClip(clipId))}
      />
      <MenuButton
        icon={Clipboard}
        label="Paste"
        shortcut="⌘V"
        disabled={!clipboardClipId || isLocked}
        onClick={() => handleAction(() => {
          if (clipboardClipId) {
            pushState()
            pasteClip(trackId, currentTime)
          }
        })}
      />
      <MenuButton
        icon={CopyPlus}
        label="Duplicate"
        shortcut="⌘D"
        disabled={isLocked}
        onClick={() => handleAction(() => {
          pushState()
          duplicateClip(clipId)
        })}
      />

      <Separator />

      {/* Split Section */}
      <MenuButton
        icon={Scissors}
        label="Split at Playhead"
        shortcut="S"
        disabled={isLocked}
        onClick={() => handleAction(() => {
          pushState()
          splitClip(clipId, currentTime)
        })}
      />
      <MenuButton
        icon={ArrowLeftToLine}
        label="Keep Left of Playhead"
        shortcut="Q"
        disabled={isLocked}
        onClick={() => handleAction(() => {
          pushState()
          splitAndKeepLeft(clipId, currentTime)
        })}
      />
      <MenuButton
        icon={ArrowRightToLine}
        label="Keep Right of Playhead"
        shortcut="W"
        disabled={isLocked}
        onClick={() => handleAction(() => {
          pushState()
          splitAndKeepRight(clipId, currentTime)
        })}
      />

      <Separator />

      {/* Replace Media - Smart Context Menu */}
      {compatibleMedia.length > 0 && (
        <div
          className="relative"
          onMouseEnter={() => setShowReplaceSubmenu(true)}
          onMouseLeave={() => setShowReplaceSubmenu(false)}
        >
          <button
            className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-text-primary hover:bg-surface-hover ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
          >
            <Replace className="w-4 h-4" />
            <span className="flex-1 text-left">Replace Media</span>
            <ChevronRight className="w-3 h-3 text-text-muted" />
          </button>

          {/* Replace Media Submenu */}
          {showReplaceSubmenu && !isLocked && (
            <div className="absolute left-full top-0 ml-1 min-w-[180px] max-h-[200px] overflow-y-auto bg-surface border border-border shadow-xl py-1">
              {compatibleMedia.map((media) => (
                <button
                  key={media.id}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => {
                    pushState()
                    replaceClipMedia(clipId, media.id, media.duration)
                    onClose()
                  }}
                >
                  {media.thumbnail ? (
                    <img src={media.thumbnail} alt="" className="w-6 h-6 object-cover" />
                  ) : (
                    <div className="w-6 h-6 bg-surface-hover flex items-center justify-center text-xs">
                      {media.type[0].toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 text-left truncate">{media.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Separate Audio - Only for video clips */}
      {isVideoClip && (
        <MenuButton
          icon={AudioLines}
          label="Separate Audio"
          disabled={isLocked}
          onClick={() => handleAction(() => {
            pushState()
            separateAudio(clipId)
          })}
        />
      )}

      <Separator />

      {/* Speed Control - FUNCTIONAL */}
      <div
        className="relative"
        onMouseEnter={() => setShowSpeedSubmenu(true)}
        onMouseLeave={() => setShowSpeedSubmenu(false)}
      >
        <button
          className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-text-primary hover:bg-surface-hover ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLocked}
        >
          <Gauge className="w-4 h-4" />
          <span className="flex-1 text-left">Speed</span>
          <span className="text-xs text-accent font-mono">{currentSpeed}x</span>
          <ChevronRight className="w-3 h-3 text-text-muted" />
        </button>

        {/* Speed Submenu */}
        {showSpeedSubmenu && !isLocked && (
          <div className="absolute left-full top-0 ml-1 min-w-[140px] bg-surface border border-border shadow-xl py-1">
            {speedOptions.map((opt) => (
              <button
                key={opt.value}
                className={`w-full px-3 py-1.5 flex items-center justify-between text-sm hover:bg-surface-hover ${
                  currentSpeed === opt.value ? 'text-accent bg-accent/10' : 'text-text-primary'
                }`}
                onClick={() => setSpeed(opt.value)}
              >
                <span>{opt.label}</span>
                {currentSpeed === opt.value && (
                  <span className="w-1.5 h-1.5 bg-accent" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reverse */}
      <MenuButton
        icon={FlipHorizontal}
        label="Reverse"
        disabled={isLocked}
        active={clip?.reverse}
        onClick={toggleReverse}
      />

      {/* Reset */}
      <MenuButton
        icon={RotateCcw}
        label="Reset to Original"
        disabled={isLocked || (currentSpeed === 1 && !clip?.reverse)}
        onClick={resetClip}
      />

      <Separator />

      {/* Delete */}
      <MenuButton
        icon={Trash2}
        label="Delete"
        shortcut="⌫"
        disabled={isLocked}
        danger
        onClick={() => handleAction(() => {
          pushState()
          removeClip(clipId)
        })}
      />
    </div>
  )
}

// Reusable menu button component
function MenuButton({
  icon: Icon,
  label,
  shortcut,
  disabled,
  danger,
  active,
  onClick,
}: {
  icon: typeof Copy
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`
        w-full px-3 py-2 flex items-center gap-2 text-sm
        ${disabled
          ? 'text-text-muted cursor-not-allowed'
          : danger
            ? 'text-error hover:bg-error/10'
            : active
              ? 'text-accent bg-accent/10'
              : 'text-text-primary hover:bg-surface-hover'
        }
      `}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-xs text-text-muted">{shortcut}</span>
      )}
    </button>
  )
}

// Separator component
function Separator() {
  return <div className="h-px bg-border my-1" />
}
