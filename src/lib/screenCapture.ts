/**
 * Screen Capture Utility
 * Uses the Screen Capture API (getDisplayMedia) to capture screen regions
 */

export interface CaptureResult {
  blob: Blob
  width: number
  height: number
  timestamp: number
}

/**
 * Capture a screenshot from screen/window/tab
 */
export async function captureScreen(): Promise<CaptureResult> {
  // Request screen capture permission
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor',
    },
    audio: false,
  })

  try {
    const track = stream.getVideoTracks()[0]
    const settings = track.getSettings()
    const width = settings.width || 1920
    const height = settings.height || 1080

    // Create video element to capture frame
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video.play()
        resolve()
      }
    })

    // Wait a frame for the video to render
    await new Promise(resolve => requestAnimationFrame(resolve))

    // Capture to canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, width, height)

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
        'image/png'
      )
    })

    return {
      blob,
      width,
      height,
      timestamp: Date.now(),
    }
  } finally {
    // Always stop the stream
    stream.getTracks().forEach(track => track.stop())
  }
}

/**
 * Capture screen region with selection UI
 * Returns the captured image as a File object ready for upload
 */
export async function captureScreenAsFile(name?: string): Promise<File> {
  const result = await captureScreen()
  const filename = name || `screen-capture-${Date.now()}.png`
  return new File([result.blob], filename, { type: 'image/png' })
}

/**
 * Capture and compare - captures two screens sequentially
 */
export async function captureTwoScreens(): Promise<{ fileA: File; fileB: File }> {
  // First capture
  const resultA = await captureScreen()
  const fileA = new File([resultA.blob], `capture-A-${Date.now()}.png`, { type: 'image/png' })

  // Prompt for second capture
  await new Promise<void>(resolve => {
    const confirmed = window.confirm(
      'First screen captured! Click OK when ready to capture the second screen.'
    )
    if (confirmed) resolve()
  })

  // Second capture
  const resultB = await captureScreen()
  const fileB = new File([resultB.blob], `capture-B-${Date.now()}.png`, { type: 'image/png' })

  return { fileA, fileB }
}

/**
 * Check if screen capture is supported
 */
export function isScreenCaptureSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
}
