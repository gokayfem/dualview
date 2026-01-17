/**
 * WebGL Analysis Metrics Computation
 * WEBGL-001: Compute SSIM, Delta E, pixel difference stats from image data
 * WEBGL-004: Support ROI (Region of Interest) for localized analysis
 */

import type { WebGLAnalysisMetrics, ROIRect } from '../../types'

/**
 * Sample pixels from image data at regular intervals for performance
 * WEBGL-004: Support ROI region for localized sampling
 */
function samplePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sampleRate: number = 4,
  roi?: ROIRect | null
): { r: number; g: number; b: number }[] {
  const samples: { r: number; g: number; b: number }[] = []

  // Calculate actual pixel bounds from ROI (normalized 0-1 coords)
  const startX = roi ? Math.floor(roi.x * width) : 0
  const startY = roi ? Math.floor(roi.y * height) : 0
  const endX = roi ? Math.floor((roi.x + roi.width) * width) : width
  const endY = roi ? Math.floor((roi.y + roi.height) * height) : height

  for (let y = startY; y < endY; y += sampleRate) {
    for (let x = startX; x < endX; x += sampleRate) {
      const i = (y * width + x) * 4
      samples.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2]
      })
    }
  }

  return samples
}

/**
 * Convert RGB to LAB color space for perceptual comparison
 */
function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  // Normalize RGB to 0-1
  let rn = r / 255
  let gn = g / 255
  let bn = b / 255

  // Apply gamma correction
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92

  // Convert to XYZ
  const x = (rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375) / 0.95047
  const y = (rn * 0.2126729 + gn * 0.7151522 + bn * 0.0721750)
  const z = (rn * 0.0193339 + gn * 0.1191920 + bn * 0.9503041) / 1.08883

  // Convert to LAB
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116

  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  }
}

/**
 * Calculate Delta E (CIE94) between two LAB colors
 */
function deltaE94(lab1: { L: number; a: number; b: number }, lab2: { L: number; a: number; b: number }): number {
  const dL = lab1.L - lab2.L
  const da = lab1.a - lab2.a
  const db = lab1.b - lab2.b

  const c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b)
  const c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b)
  const dC = c1 - c2

  let dH = da * da + db * db - dC * dC
  dH = dH < 0 ? 0 : Math.sqrt(dH)

  const sL = 1
  const sC = 1 + 0.045 * c1
  const sH = 1 + 0.015 * c1

  const kL = 1
  const kC = 1
  const kH = 1

  const t1 = dL / (kL * sL)
  const t2 = dC / (kC * sC)
  const t3 = dH / (kH * sH)

  return Math.sqrt(t1 * t1 + t2 * t2 + t3 * t3)
}

/**
 * Calculate simplified SSIM for a window of pixels
 */
function calculateSSIM(
  pixelsA: { r: number; g: number; b: number }[],
  pixelsB: { r: number; g: number; b: number }[]
): number {
  if (pixelsA.length !== pixelsB.length || pixelsA.length === 0) {
    return 0
  }

  const n = pixelsA.length
  const c1 = (0.01 * 255) ** 2
  const c2 = (0.03 * 255) ** 2

  // Calculate means
  let meanA = 0, meanB = 0
  for (let i = 0; i < n; i++) {
    const lumA = 0.299 * pixelsA[i].r + 0.587 * pixelsA[i].g + 0.114 * pixelsA[i].b
    const lumB = 0.299 * pixelsB[i].r + 0.587 * pixelsB[i].g + 0.114 * pixelsB[i].b
    meanA += lumA
    meanB += lumB
  }
  meanA /= n
  meanB /= n

  // Calculate variances and covariance
  let varA = 0, varB = 0, covar = 0
  for (let i = 0; i < n; i++) {
    const lumA = 0.299 * pixelsA[i].r + 0.587 * pixelsA[i].g + 0.114 * pixelsA[i].b
    const lumB = 0.299 * pixelsB[i].r + 0.587 * pixelsB[i].g + 0.114 * pixelsB[i].b
    const diffA = lumA - meanA
    const diffB = lumB - meanB
    varA += diffA * diffA
    varB += diffB * diffB
    covar += diffA * diffB
  }
  varA /= n
  varB /= n
  covar /= n

  // SSIM formula
  const numerator = (2 * meanA * meanB + c1) * (2 * covar + c2)
  const denominator = (meanA * meanA + meanB * meanB + c1) * (varA + varB + c2)

  return numerator / denominator
}

/**
 * Compute all WebGL analysis metrics from two canvases
 * @param canvasA - Canvas containing image A
 * @param canvasB - Canvas containing image B
 * @param threshold - Threshold for "different" pixel detection (0-255)
 * @param roi - Optional ROI region for localized analysis
 */
export function computeWebGLMetrics(
  canvasA: HTMLCanvasElement | OffscreenCanvas,
  canvasB: HTMLCanvasElement | OffscreenCanvas,
  threshold: number = 10,
  roi?: ROIRect | null
): WebGLAnalysisMetrics {
  const ctxA = canvasA.getContext('2d')
  const ctxB = canvasB.getContext('2d')

  if (!ctxA || !ctxB) {
    return {
      ssim: 0,
      deltaE: 0,
      diffPixelPercent: 0,
      peakDifference: 0,
      meanDifference: 0,
      timestamp: Date.now(),
      passPixelCount: 0,
      failPixelCount: 0,
      totalPixelCount: 0
    }
  }

  const width = Math.min(canvasA.width, canvasB.width)
  const height = Math.min(canvasA.height, canvasB.height)

  const imageDataA = ctxA.getImageData(0, 0, width, height)
  const imageDataB = ctxB.getImageData(0, 0, width, height)

  return computeMetricsFromImageData(imageDataA, imageDataB, threshold, roi)
}

/**
 * Compute metrics directly from image data
 * WEBGL-004: Support ROI region for localized analysis
 */
export function computeMetricsFromImageData(
  imageDataA: ImageData,
  imageDataB: ImageData,
  threshold: number = 10,
  roi?: ROIRect | null
): WebGLAnalysisMetrics {
  const width = imageDataA.width
  const height = imageDataA.height
  const dataA = imageDataA.data
  const dataB = imageDataB.data

  // Sample pixels for performance (every 4th pixel)
  const sampleRate = 4
  const pixelsA = samplePixels(dataA, width, height, sampleRate, roi)
  const pixelsB = samplePixels(dataB, width, height, sampleRate, roi)

  // Calculate SSIM
  const ssim = calculateSSIM(pixelsA, pixelsB)

  // Calculate Delta E and pixel differences
  let totalDeltaE = 0
  let diffPixelCount = 0
  let peakDiff = 0
  let totalDiff = 0

  for (let i = 0; i < pixelsA.length; i++) {
    const pA = pixelsA[i]
    const pB = pixelsB[i]

    // RGB difference
    const dr = Math.abs(pA.r - pB.r)
    const dg = Math.abs(pA.g - pB.g)
    const db = Math.abs(pA.b - pB.b)
    const maxDiff = Math.max(dr, dg, db)
    const avgDiff = (dr + dg + db) / 3

    totalDiff += avgDiff
    peakDiff = Math.max(peakDiff, maxDiff)

    if (maxDiff > threshold) {
      diffPixelCount++
    }

    // Delta E calculation
    const labA = rgbToLab(pA.r, pA.g, pA.b)
    const labB = rgbToLab(pB.r, pB.g, pB.b)
    totalDeltaE += deltaE94(labA, labB)
  }

  const numSamples = pixelsA.length

  const passPixelCount = numSamples - diffPixelCount

  return {
    ssim: Math.max(0, Math.min(1, ssim)),
    deltaE: numSamples > 0 ? totalDeltaE / numSamples : 0,
    diffPixelPercent: numSamples > 0 ? (diffPixelCount / numSamples) * 100 : 0,
    peakDifference: peakDiff,
    meanDifference: numSamples > 0 ? totalDiff / numSamples : 0,
    timestamp: Date.now(),
    // WEBGL-006: Threshold pass/fail stats
    passPixelCount,
    failPixelCount: diffPixelCount,
    totalPixelCount: numSamples
  }
}

/**
 * Compute metrics from WebGL canvas by reading pixels
 * This is used when we have a WebGL canvas and need to read back pixels
 * WEBGL-004: Support ROI region for localized analysis
 */
export function computeMetricsFromWebGLCanvas(
  _gl: WebGLRenderingContext,
  width: number,
  height: number,
  videoA: HTMLVideoElement | HTMLImageElement,
  videoB: HTMLVideoElement | HTMLImageElement,
  threshold: number = 10,
  roi?: ROIRect | null
): WebGLAnalysisMetrics {
  // Create temporary canvases to draw the video frames
  const canvasA = document.createElement('canvas')
  const canvasB = document.createElement('canvas')

  // Use smaller size for performance
  const sampleWidth = Math.min(320, width)
  const sampleHeight = Math.min(180, height)

  canvasA.width = sampleWidth
  canvasA.height = sampleHeight
  canvasB.width = sampleWidth
  canvasB.height = sampleHeight

  const ctxA = canvasA.getContext('2d')
  const ctxB = canvasB.getContext('2d')

  if (!ctxA || !ctxB) {
    return {
      ssim: 0,
      deltaE: 0,
      diffPixelPercent: 0,
      peakDifference: 0,
      meanDifference: 0,
      timestamp: Date.now(),
      passPixelCount: 0,
      failPixelCount: 0,
      totalPixelCount: 0
    }
  }

  // Draw video frames to canvases
  ctxA.drawImage(videoA, 0, 0, sampleWidth, sampleHeight)
  ctxB.drawImage(videoB, 0, 0, sampleWidth, sampleHeight)

  return computeWebGLMetrics(canvasA, canvasB, threshold, roi)
}
