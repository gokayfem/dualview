/**
 * ShareDialog Component (SHARE-001, SHARE-002, SHARE-003)
 * 
 * Dialog for sharing comparisons via links, embeds, and social media.
 */

import { useState, useMemo } from 'react'
import {
  X,
  Link2,
  Code,
  Share2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Clock,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useProjectStore } from '../../stores/projectStore'
import {
  generateShareLink,
  generateEmbedCode,
  generateResponsiveEmbed,
  generateQRCodeUrl,
  copyToClipboard,
  shareViaWebShare,
  isWebShareSupported,
  SOCIAL_EXPORT_PRESETS,
  type ShareLinkConfig,
  type EmbedConfig,
  type SocialExportPreset,
} from '../../lib/shareLink'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
}

type ShareTab = 'link' | 'embed' | 'social'

export function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>('link')
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  
  // Link settings
  const [expiration, setExpiration] = useState<'24h' | '7d' | '30d' | 'never'>('never')
  const [autoplay, setAutoplay] = useState(false)
  const [loop, setLoop] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto')
  
  // Embed settings
  const [embedWidth, setEmbedWidth] = useState<number | 'responsive'>('responsive')
  const [embedHeight, setEmbedHeight] = useState(450)
  const [borderRadius, setBorderRadius] = useState(8)
  const [embedType, setEmbedType] = useState<'iframe' | 'responsive'>('responsive')
  
  // Social settings
  const [selectedPreset, setSelectedPreset] = useState<SocialExportPreset>(SOCIAL_EXPORT_PRESETS[0])
  const [addOverlay, setAddOverlay] = useState(true)
  
  const projectStore = useProjectStore()

  // Generate config from current project state
  const linkConfig: ShareLinkConfig = useMemo(() => ({
    mode: projectStore.comparisonMode,
    aspectRatio: projectStore.aspectRatioSettings.preset,
    sliderPosition: projectStore.sliderPosition,
    sliderOrientation: projectStore.sliderOrientation,
    autoplay,
    loop,
    showControls,
    theme,
    expiration,
  }), [projectStore, autoplay, loop, showControls, theme, expiration])

  const embedConfig: EmbedConfig = useMemo(() => ({
    ...linkConfig,
    width: embedWidth,
    height: embedHeight,
    borderRadius,
    showBranding: true,
  }), [linkConfig, embedWidth, embedHeight, borderRadius])

  const shareLink = useMemo(() => generateShareLink(linkConfig), [linkConfig])
  const embedCode = useMemo(() => 
    embedType === 'responsive' 
      ? generateResponsiveEmbed(embedConfig)
      : generateEmbedCode(embedConfig),
    [embedConfig, embedType]
  )
  const qrCodeUrl = useMemo(() => generateQRCodeUrl(shareLink, 200), [shareLink])

  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleNativeShare = async () => {
    await shareViaWebShare({
      title: 'DualView Comparison',
      text: 'Check out this comparison!',
      url: shareLink,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Share Comparison</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors',
              activeTab === 'link'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-zinc-400 hover:text-white'
            )}
            onClick={() => setActiveTab('link')}
          >
            <Link2 className="w-4 h-4" />
            Share Link
          </button>
          <button
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors',
              activeTab === 'embed'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-zinc-400 hover:text-white'
            )}
            onClick={() => setActiveTab('embed')}
          >
            <Code className="w-4 h-4" />
            Embed Code
          </button>
          <button
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors',
              activeTab === 'social'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-zinc-400 hover:text-white'
            )}
            onClick={() => setActiveTab('social')}
          >
            <Share2 className="w-4 h-4" />
            Social Media
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'link' && (
            <div className="space-y-6">
              {/* Link preview */}
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Share Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(shareLink)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    )}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  {showQR ? 'Hide' : 'Show'} QR Code
                </button>
                {isWebShareSupported() && (
                  <button
                    onClick={handleNativeShare}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Share...
                  </button>
                )}
              </div>

              {showQR && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              )}

              {/* Link options */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs text-zinc-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Link Expiration
                  </label>
                  <select
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value as typeof expiration)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="never">Never expire</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-zinc-400">Theme</label>
                  <div className="flex gap-1">
                    {[
                      { value: 'light' as const, icon: Sun, label: 'Light' },
                      { value: 'dark' as const, icon: Moon, label: 'Dark' },
                      { value: 'auto' as const, icon: Laptop, label: 'Auto' },
                    ].map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs transition-colors',
                          theme === value
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        )}
                        title={label}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoplay}
                    onChange={(e) => setAutoplay(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-zinc-300">Autoplay</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-zinc-300">Loop</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showControls}
                    onChange={(e) => setShowControls(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-zinc-300">Show Controls</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-6">
              {/* Embed type */}
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Embed Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEmbedType('responsive')}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg text-sm transition-colors',
                      embedType === 'responsive'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    )}
                  >
                    Responsive
                  </button>
                  <button
                    onClick={() => setEmbedType('iframe')}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg text-sm transition-colors',
                      embedType === 'iframe'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    )}
                  >
                    Fixed Size
                  </button>
                </div>
              </div>

              {/* Size options */}
              <div className="grid grid-cols-2 gap-4">
                {embedType === 'iframe' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-zinc-400">Width</label>
                    <input
                      type="number"
                      value={embedWidth === 'responsive' ? 800 : embedWidth}
                      onChange={(e) => setEmbedWidth(parseInt(e.target.value) || 800)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-xs text-zinc-400">Height</label>
                  <input
                    type="number"
                    value={embedHeight}
                    onChange={(e) => setEmbedHeight(parseInt(e.target.value) || 450)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-zinc-400">Border Radius</label>
                  <input
                    type="number"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Embed code */}
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Embed Code</label>
                <div className="relative">
                  <pre className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                    {embedCode}
                  </pre>
                  <button
                    onClick={() => handleCopy(embedCode)}
                    className={cn(
                      'absolute top-2 right-2 px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1',
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                    )}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Preview</label>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 flex items-center justify-center min-h-[120px]">
                  <div
                    className="bg-zinc-900 flex items-center justify-center text-xs text-zinc-500"
                    style={{
                      width: embedType === 'iframe' && embedWidth !== 'responsive' ? Math.min(embedWidth, 300) : '100%',
                      height: Math.min(embedHeight, 150),
                      borderRadius: borderRadius,
                    }}
                  >
                    Embed Preview
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-6">
              {/* Platform presets */}
              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Platform Preset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SOCIAL_EXPORT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                        selectedPreset.id === preset.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      )}
                    >
                      <span className="text-lg">{preset.icon}</span>
                      <div>
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-[10px] opacity-70">
                          {preset.width}×{preset.height}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected preset info */}
              <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">
                    {selectedPreset.icon} {selectedPreset.name}
                  </h4>
                  <span className="text-xs text-zinc-400">
                    {selectedPreset.format.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-zinc-400">Resolution</div>
                    <div className="text-white">{selectedPreset.width}×{selectedPreset.height}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">FPS</div>
                    <div className="text-white">{selectedPreset.fps}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Max Duration</div>
                    <div className="text-white">{selectedPreset.maxDuration}s</div>
                  </div>
                </div>
              </div>

              {/* Overlay options */}
              {selectedPreset.overlay && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addOverlay}
                    onChange={(e) => setAddOverlay(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-zinc-300">
                    Add "{selectedPreset.overlay.beforeLabel} / {selectedPreset.overlay.afterLabel}" overlay
                  </span>
                </label>
              )}

              {/* Export button */}
              <button
                onClick={() => {
                  // This would trigger the actual export with the selected preset
                  // For now, just show an alert
                  alert(`Export with ${selectedPreset.name} preset coming soon!\n\nResolution: ${selectedPreset.width}×${selectedPreset.height}\nFormat: ${selectedPreset.format}`)
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Export for {selectedPreset.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
