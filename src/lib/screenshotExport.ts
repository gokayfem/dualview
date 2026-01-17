/**
 * Screenshot and PDF Export utilities
 */

export interface ScreenshotOptions {
  format: 'png' | 'jpg'
  quality: number // 0-1 for jpg
  includeAnnotations: boolean
  includeUI: boolean
}

export interface PDFExportOptions {
  title: string
  includeMetadata: boolean
  includeAnnotations: boolean
  includeSettings: boolean
}

/**
 * Capture the current comparison view as an image
 */
export async function captureScreenshot(
  element: HTMLElement,
  options: ScreenshotOptions
): Promise<Blob> {
  // Use html2canvas-style approach with native canvas
  const rect = element.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to create canvas context')
  }

  // Set canvas size with device pixel ratio for sharpness
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  // Try to use the experimental drawWindow or fallback
  // For now, we'll capture video/image elements directly
  const videos = element.querySelectorAll('video')
  const images = element.querySelectorAll('img')
  const canvases = element.querySelectorAll('canvas')

  // Fill background
  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, rect.width, rect.height)

  // Draw each media element
  const drawMedia = (media: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
    const mediaRect = media.getBoundingClientRect()
    const x = mediaRect.left - rect.left
    const y = mediaRect.top - rect.top

    try {
      ctx.drawImage(media, x, y, mediaRect.width, mediaRect.height)
    } catch (e) {
      console.warn('Failed to draw media element:', e)
    }
  }

  videos.forEach(v => drawMedia(v))
  images.forEach(i => drawMedia(i))
  canvases.forEach(c => drawMedia(c))

  // Convert to blob
  return new Promise((resolve, reject) => {
    const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg'
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      },
      mimeType,
      options.format === 'jpg' ? options.quality : undefined
    )
  })
}

/**
 * Simple screenshot using canvas capture
 */
export async function captureCanvasScreenshot(
  canvas: HTMLCanvasElement | null,
  format: 'png' | 'jpg' = 'png'
): Promise<Blob | null> {
  if (!canvas) return null

  return new Promise(resolve => {
    canvas.toBlob(
      blob => resolve(blob),
      format === 'png' ? 'image/png' : 'image/jpeg',
      0.95
    )
  })
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * WEBGL-010: WebGL Analysis Metrics type for PDF report
 */
export interface WebGLPDFMetrics {
  ssim: number
  deltaE: number
  diffPixelPercent: number
  peakDifference: number
  meanDifference: number
  passPixelCount: number
  failPixelCount: number
  totalPixelCount: number
}

/**
 * Generate a PDF report
 * WEBGL-010: Enhanced with WebGL analysis metrics
 */
export async function generatePDFReport(
  options: PDFExportOptions & {
    screenshotBlob: Blob
    mediaA?: { name: string; type: string; size: string; dimensions?: string }
    mediaB?: { name: string; type: string; size: string; dimensions?: string }
    comparisonMode: string
    annotations?: string[]
    metrics?: { ssim?: number; psnr?: number }
    webglMetrics?: WebGLPDFMetrics  // WEBGL-010
    webglMode?: string              // WEBGL-010
    threshold?: number              // WEBGL-010
  }
): Promise<Blob> {
  // Create a simple HTML-based PDF
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  // Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(options.title || 'DualView Comparison Report', margin, margin + 10)

  // Date
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 18)

  // Screenshot
  const imgWidth = pageWidth - margin * 2
  const imgHeight = imgWidth * (9 / 16) // 16:9 aspect ratio
  const imgY = margin + 25

  try {
    const imgData = await blobToBase64(options.screenshotBlob)
    doc.addImage(imgData, 'PNG', margin, imgY, imgWidth, imgHeight)
  } catch (e) {
    console.error('Failed to add screenshot to PDF:', e)
  }

  // Metadata section
  let yPos = imgY + imgHeight + 10

  if (options.includeSettings) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Comparison Settings', margin, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Mode: ${options.comparisonMode}`, margin, yPos)
    yPos += 5

    if (options.webglMode) {
      doc.text(`Analysis Mode: ${options.webglMode}`, margin, yPos)
      yPos += 5
    }

    if (options.threshold !== undefined) {
      doc.text(`Threshold: ${(options.threshold * 100).toFixed(0)}%`, margin, yPos)
      yPos += 5
    }

    if (options.metrics?.ssim !== undefined) {
      doc.text(`SSIM: ${options.metrics.ssim.toFixed(4)}`, margin, yPos)
      yPos += 5
    }
    if (options.metrics?.psnr !== undefined) {
      doc.text(`PSNR: ${options.metrics.psnr.toFixed(2)} dB`, margin, yPos)
      yPos += 5
    }
  }

  // WEBGL-010: WebGL Analysis Metrics Section
  if (options.webglMetrics) {
    yPos += 5
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('WebGL Analysis Metrics', margin, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    // SSIM with quality assessment
    const ssimQuality = options.webglMetrics.ssim > 0.95 ? 'Excellent' :
                        options.webglMetrics.ssim > 0.8 ? 'Good' :
                        options.webglMetrics.ssim > 0.5 ? 'Fair' : 'Poor'
    doc.text(`Structural Similarity (SSIM): ${options.webglMetrics.ssim.toFixed(4)} (${ssimQuality})`, margin, yPos)
    yPos += 5

    // Delta E with interpretation
    const deltaEInterpretation = options.webglMetrics.deltaE < 1 ? 'Imperceptible' :
                                  options.webglMetrics.deltaE < 2 ? 'Barely perceptible' :
                                  options.webglMetrics.deltaE < 5 ? 'Noticeable' : 'Obvious'
    doc.text(`Perceptual Difference (Delta E CIE94): ${options.webglMetrics.deltaE.toFixed(2)} (${deltaEInterpretation})`, margin, yPos)
    yPos += 5

    doc.text(`Different Pixels: ${options.webglMetrics.diffPixelPercent.toFixed(1)}% (${options.webglMetrics.failPixelCount.toLocaleString()} of ${options.webglMetrics.totalPixelCount.toLocaleString()})`, margin, yPos)
    yPos += 5

    doc.text(`Peak Pixel Difference: ${options.webglMetrics.peakDifference.toFixed(0)} / 255`, margin, yPos)
    yPos += 5

    doc.text(`Mean Pixel Difference: ${options.webglMetrics.meanDifference.toFixed(2)} / 255`, margin, yPos)
    yPos += 5

    // Pass/Fail summary
    const passRate = (options.webglMetrics.passPixelCount / options.webglMetrics.totalPixelCount * 100).toFixed(1)
    doc.text(`Threshold Pass Rate: ${passRate}% (${options.webglMetrics.passPixelCount.toLocaleString()} pixels)`, margin, yPos)
    yPos += 5
  }

  if (options.includeMetadata) {
    yPos += 5
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Media Information', margin, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    if (options.mediaA) {
      doc.text(`Track A: ${options.mediaA.name}`, margin, yPos)
      yPos += 5
      doc.text(`  Type: ${options.mediaA.type}, Size: ${options.mediaA.size}`, margin, yPos)
      if (options.mediaA.dimensions) {
        yPos += 5
        doc.text(`  Dimensions: ${options.mediaA.dimensions}`, margin, yPos)
      }
      yPos += 5
    }

    if (options.mediaB) {
      doc.text(`Track B: ${options.mediaB.name}`, margin, yPos)
      yPos += 5
      doc.text(`  Type: ${options.mediaB.type}, Size: ${options.mediaB.size}`, margin, yPos)
      if (options.mediaB.dimensions) {
        yPos += 5
        doc.text(`  Dimensions: ${options.mediaB.dimensions}`, margin, yPos)
      }
    }
  }

  if (options.includeAnnotations && options.annotations && options.annotations.length > 0) {
    yPos += 10
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes', margin, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const note of options.annotations) {
      doc.text(`• ${note}`, margin, yPos)
      yPos += 5
    }
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128)
  doc.text(
    'Generated with DualView - github.com/gokayfem/dualview',
    pageWidth / 2,
    pageHeight - 5,
    { align: 'center' }
  )

  return doc.output('blob')
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
