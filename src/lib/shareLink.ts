/**
 * Share Link Utilities (SHARE-001, SHARE-002, SHARE-003)
 * 
 * Generate shareable links, embed codes, and social media export presets.
 */

import type { ComparisonMode } from '../types'

// Share link configuration
export interface ShareLinkConfig {
  mode: ComparisonMode
  aspectRatio: string
  sliderPosition: number
  sliderOrientation: 'vertical' | 'horizontal'
  autoplay: boolean
  loop: boolean
  showControls: boolean
  theme: 'light' | 'dark' | 'auto'
  expiration?: '24h' | '7d' | '30d' | 'never'
}

// Generate a shareable link with encoded settings
export function generateShareLink(config: ShareLinkConfig): string {
  const baseUrl = window.location.origin
  const params = new URLSearchParams()
  
  params.set('mode', config.mode)
  params.set('ar', config.aspectRatio)
  params.set('sp', String(config.sliderPosition))
  params.set('so', config.sliderOrientation === 'horizontal' ? 'h' : 'v')
  if (config.autoplay) params.set('autoplay', '1')
  if (config.loop) params.set('loop', '1')
  if (!config.showControls) params.set('nocontrols', '1')
  params.set('theme', config.theme)
  
  return `${baseUrl}/share?${params.toString()}`
}

// Parse share link parameters
export function parseShareLink(url: string): Partial<ShareLinkConfig> {
  try {
    const parsed = new URL(url)
    const params = parsed.searchParams
    
    return {
      mode: params.get('mode') as ComparisonMode || 'slider',
      aspectRatio: params.get('ar') || '16:9',
      sliderPosition: parseInt(params.get('sp') || '50'),
      sliderOrientation: params.get('so') === 'h' ? 'horizontal' : 'vertical',
      autoplay: params.get('autoplay') === '1',
      loop: params.get('loop') === '1',
      showControls: params.get('nocontrols') !== '1',
      theme: (params.get('theme') as 'light' | 'dark' | 'auto') || 'auto',
    }
  } catch {
    return {}
  }
}

// Embed code configuration
export interface EmbedConfig extends ShareLinkConfig {
  width: number | 'responsive'
  height: number
  borderRadius: number
  showBranding: boolean
}

// Generate embed code for external sites
export function generateEmbedCode(config: EmbedConfig): string {
  const shareUrl = generateShareLink(config)
  const borderRadiusStyle = config.borderRadius > 0 ? `border-radius: ${config.borderRadius}px;` : ''
  
  const iframe = `<iframe 
  src="${shareUrl}"
  width="${config.width === 'responsive' ? '100%' : config.width}"
  height="${config.height}"
  style="border: none; ${borderRadiusStyle} overflow: hidden;"
  allow="autoplay; fullscreen"
  loading="lazy"
  title="DualView Comparison"
></iframe>`
  
  // Clean up whitespace
  return iframe.replace(/\n\s+/g, '\n  ').trim()
}

// Generate responsive embed wrapper
export function generateResponsiveEmbed(config: EmbedConfig): string {
  const shareUrl = generateShareLink(config)
  
  return `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: ${config.borderRadius}px;">
  <iframe 
    src="${shareUrl}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
    allow="autoplay; fullscreen"
    loading="lazy"
    title="DualView Comparison"
  ></iframe>
</div>`
}

// Social media export presets
export interface SocialExportPreset {
  id: string
  name: string
  icon: string
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook' | 'linkedin'
  width: number
  height: number
  fps: number
  maxDuration: number
  format: 'mp4' | 'webm' | 'gif'
  overlay?: {
    beforeLabel?: string
    afterLabel?: string
    position: 'top' | 'bottom'
  }
}

export const SOCIAL_EXPORT_PRESETS: SocialExportPreset[] = [
  {
    id: 'tiktok-vertical',
    name: 'TikTok',
    icon: '🎵',
    platform: 'tiktok',
    width: 1080,
    height: 1920,
    fps: 30,
    maxDuration: 60,
    format: 'mp4',
    overlay: { beforeLabel: 'Before', afterLabel: 'After', position: 'bottom' },
  },
  {
    id: 'instagram-reels',
    name: 'Instagram Reels',
    icon: '📷',
    platform: 'instagram',
    width: 1080,
    height: 1920,
    fps: 30,
    maxDuration: 90,
    format: 'mp4',
    overlay: { beforeLabel: 'Before', afterLabel: 'After', position: 'bottom' },
  },
  {
    id: 'instagram-post',
    name: 'Instagram Post',
    icon: '📷',
    platform: 'instagram',
    width: 1080,
    height: 1080,
    fps: 30,
    maxDuration: 60,
    format: 'mp4',
  },
  {
    id: 'youtube-short',
    name: 'YouTube Shorts',
    icon: '▶️',
    platform: 'youtube',
    width: 1080,
    height: 1920,
    fps: 30,
    maxDuration: 60,
    format: 'mp4',
    overlay: { beforeLabel: 'Before', afterLabel: 'After', position: 'top' },
  },
  {
    id: 'youtube-standard',
    name: 'YouTube',
    icon: '▶️',
    platform: 'youtube',
    width: 1920,
    height: 1080,
    fps: 30,
    maxDuration: 600,
    format: 'mp4',
  },
  {
    id: 'twitter-post',
    name: 'X / Twitter',
    icon: '🐦',
    platform: 'twitter',
    width: 1280,
    height: 720,
    fps: 30,
    maxDuration: 140,
    format: 'mp4',
  },
  {
    id: 'twitter-gif',
    name: 'X / Twitter GIF',
    icon: '🐦',
    platform: 'twitter',
    width: 480,
    height: 270,
    fps: 15,
    maxDuration: 15,
    format: 'gif',
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn',
    icon: '💼',
    platform: 'linkedin',
    width: 1920,
    height: 1080,
    fps: 30,
    maxDuration: 600,
    format: 'mp4',
  },
  {
    id: 'facebook-post',
    name: 'Facebook',
    icon: '📘',
    platform: 'facebook',
    width: 1280,
    height: 720,
    fps: 30,
    maxDuration: 240,
    format: 'mp4',
  },
]

// Get preset by ID
export function getSocialPreset(id: string): SocialExportPreset | undefined {
  return SOCIAL_EXPORT_PRESETS.find(p => p.id === id)
}

// Get presets by platform
export function getPresetsByPlatform(platform: SocialExportPreset['platform']): SocialExportPreset[] {
  return SOCIAL_EXPORT_PRESETS.filter(p => p.platform === platform)
}

// QR code generation (uses external API for simplicity)
export function generateQRCodeUrl(url: string, size: number = 200): string {
  // Using goQR.me API which is free and doesn't require auth
  const encoded = encodeURIComponent(url)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`
}

// Copy to clipboard with fallback
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}

// Web Share API
export async function shareViaWebShare(data: { title: string; text?: string; url?: string; files?: File[] }): Promise<boolean> {
  if (!navigator.share) {
    return false
  }

  try {
    // Check if files can be shared
    if (data.files && data.files.length > 0 && !navigator.canShare?.({ files: data.files })) {
      // Remove files and try without them
      delete data.files
    }

    await navigator.share(data)
    return true
  } catch (error) {
    // User cancelled or other error
    return false
  }
}

// Check if Web Share API is available
export function isWebShareSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share
}
