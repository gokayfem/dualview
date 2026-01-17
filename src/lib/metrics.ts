/**
 * Video Quality Metrics - SSIM and PSNR calculations
 * VID-004: Video Quality Metrics
 */

/**
 * Calculate Mean Squared Error between two image data arrays
 */
function calculateMSE(dataA: Uint8ClampedArray, dataB: Uint8ClampedArray): number {
  if (dataA.length !== dataB.length) return Infinity

  let sum = 0
  const pixelCount = dataA.length / 4 // RGBA

  for (let i = 0; i < dataA.length; i += 4) {
    // Only compare RGB, skip alpha
    const diffR = dataA[i] - dataB[i]
    const diffG = dataA[i + 1] - dataB[i + 1]
    const diffB = dataA[i + 2] - dataB[i + 2]

    sum += (diffR * diffR + diffG * diffG + diffB * diffB) / 3
  }

  return sum / pixelCount
}

/**
 * Calculate PSNR (Peak Signal-to-Noise Ratio)
 * Higher values indicate better quality / more similarity
 * Typical values: 30-50 dB for good quality, Infinity for identical images
 */
export function calculatePSNR(dataA: Uint8ClampedArray, dataB: Uint8ClampedArray): number {
  const mse = calculateMSE(dataA, dataB)

  if (mse === 0) return Infinity // Identical images
  if (mse === Infinity) return 0

  // PSNR = 10 * log10(MAX^2 / MSE) where MAX = 255 for 8-bit images
  const maxValue = 255
  return 10 * Math.log10((maxValue * maxValue) / mse)
}

/**
 * Calculate mean and variance of image data
 */
function calculateStats(data: Uint8ClampedArray): { mean: number; variance: number } {
  const pixelCount = data.length / 4
  let sum = 0

  // Calculate mean (luminance only for simplicity)
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale: 0.299*R + 0.587*G + 0.114*B
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sum += luminance
  }
  const mean = sum / pixelCount

  // Calculate variance
  let varianceSum = 0
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    varianceSum += (luminance - mean) * (luminance - mean)
  }
  const variance = varianceSum / pixelCount

  return { mean, variance }
}

/**
 * Calculate covariance between two images
 */
function calculateCovariance(
  dataA: Uint8ClampedArray,
  dataB: Uint8ClampedArray,
  meanA: number,
  meanB: number
): number {
  const pixelCount = dataA.length / 4
  let sum = 0

  for (let i = 0; i < dataA.length; i += 4) {
    const lumA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2]
    const lumB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2]
    sum += (lumA - meanA) * (lumB - meanB)
  }

  return sum / pixelCount
}

/**
 * Calculate SSIM (Structural Similarity Index)
 * Range: -1 to 1, where 1 = identical images
 * Typical threshold: > 0.98 considered visually identical
 */
export function calculateSSIM(dataA: Uint8ClampedArray, dataB: Uint8ClampedArray): number {
  if (dataA.length !== dataB.length) return 0

  const statsA = calculateStats(dataA)
  const statsB = calculateStats(dataB)
  const covariance = calculateCovariance(dataA, dataB, statsA.mean, statsB.mean)

  // SSIM constants
  const L = 255 // Dynamic range
  const k1 = 0.01
  const k2 = 0.03
  const c1 = (k1 * L) * (k1 * L)
  const c2 = (k2 * L) * (k2 * L)

  const numerator = (2 * statsA.mean * statsB.mean + c1) * (2 * covariance + c2)
  const denominator =
    (statsA.mean * statsA.mean + statsB.mean * statsB.mean + c1) *
    (statsA.variance + statsB.variance + c2)

  return numerator / denominator
}

/**
 * Get frame data from a video element
 */
export function getVideoFrameData(
  video: HTMLVideoElement,
  width: number = 256,
  height: number = 144
): Uint8ClampedArray | null {
  if (!video || video.readyState < 2) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return null

  ctx.drawImage(video, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height).data
}

export interface QualityMetrics {
  ssim: number
  psnr: number
}

/**
 * Calculate quality metrics between two video elements
 */
export function calculateVideoMetrics(
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement
): QualityMetrics | null {
  const dataA = getVideoFrameData(videoA)
  const dataB = getVideoFrameData(videoB)

  if (!dataA || !dataB) return null

  return {
    ssim: calculateSSIM(dataA, dataB),
    psnr: calculatePSNR(dataA, dataB),
  }
}
