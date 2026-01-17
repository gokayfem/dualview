/**
 * Auto-Align Media
 *
 * Lightweight image alignment using normalized cross-correlation.
 * Detects translation, scale, and rotation differences between two images.
 */

export interface AlignmentResult {
  offsetX: number      // Horizontal shift in pixels
  offsetY: number      // Vertical shift in pixels
  scale: number        // Scale factor (1.0 = same size)
  rotation: number     // Rotation in degrees
  confidence: number   // 0-1 confidence score
}

export interface AlignmentTransform {
  offsetX: number
  offsetY: number
  scale: number
  rotation: number
}

/**
 * Convert image/video element to grayscale pixel data
 */
function getGrayscaleData(
  source: HTMLImageElement | HTMLVideoElement,
  targetWidth: number,
  targetHeight: number
): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
  const data = imageData.data

  const grayscale = new Float32Array(targetWidth * targetHeight)
  for (let i = 0; i < grayscale.length; i++) {
    const idx = i * 4
    // Luminance formula
    grayscale[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
  }

  return grayscale
}

/**
 * Normalize array to zero mean and unit variance
 */
function normalize(arr: Float32Array): Float32Array {
  let sum = 0
  for (let i = 0; i < arr.length; i++) sum += arr[i]
  const mean = sum / arr.length

  let variance = 0
  for (let i = 0; i < arr.length; i++) {
    variance += (arr[i] - mean) ** 2
  }
  const std = Math.sqrt(variance / arr.length) || 1

  const result = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i++) {
    result[i] = (arr[i] - mean) / std
  }
  return result
}

/**
 * Compute normalized cross-correlation between two images
 * Returns correlation value and best offset
 */
function crossCorrelate(
  template: Float32Array,
  search: Float32Array,
  width: number,
  height: number,
  searchRange: number
): { offsetX: number; offsetY: number; correlation: number } {
  const normTemplate = normalize(template)
  const normSearch = normalize(search)

  let bestCorr = -Infinity
  let bestX = 0
  let bestY = 0

  // Search within range
  for (let dy = -searchRange; dy <= searchRange; dy += 2) {
    for (let dx = -searchRange; dx <= searchRange; dx += 2) {
      let corr = 0
      let count = 0

      for (let y = 0; y < height; y++) {
        const srcY = y + dy
        if (srcY < 0 || srcY >= height) continue

        for (let x = 0; x < width; x++) {
          const srcX = x + dx
          if (srcX < 0 || srcX >= width) continue

          const tIdx = y * width + x
          const sIdx = srcY * width + srcX
          corr += normTemplate[tIdx] * normSearch[sIdx]
          count++
        }
      }

      if (count > 0) {
        corr /= count
        if (corr > bestCorr) {
          bestCorr = corr
          bestX = dx
          bestY = dy
        }
      }
    }
  }

  // Refine with single-pixel precision
  for (let dy = bestY - 2; dy <= bestY + 2; dy++) {
    for (let dx = bestX - 2; dx <= bestX + 2; dx++) {
      let corr = 0
      let count = 0

      for (let y = 0; y < height; y++) {
        const srcY = y + dy
        if (srcY < 0 || srcY >= height) continue

        for (let x = 0; x < width; x++) {
          const srcX = x + dx
          if (srcX < 0 || srcX >= width) continue

          const tIdx = y * width + x
          const sIdx = srcY * width + srcX
          corr += normTemplate[tIdx] * normSearch[sIdx]
          count++
        }
      }

      if (count > 0) {
        corr /= count
        if (corr > bestCorr) {
          bestCorr = corr
          bestX = dx
          bestY = dy
        }
      }
    }
  }

  return { offsetX: bestX, offsetY: bestY, correlation: bestCorr }
}

/**
 * Get rotated grayscale data
 */
function getRotatedGrayscale(
  source: HTMLImageElement | HTMLVideoElement,
  targetWidth: number,
  targetHeight: number,
  angleDegrees: number
): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!

  ctx.translate(targetWidth / 2, targetHeight / 2)
  ctx.rotate((angleDegrees * Math.PI) / 180)
  ctx.translate(-targetWidth / 2, -targetHeight / 2)
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight)

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
  const data = imageData.data

  const grayscale = new Float32Array(targetWidth * targetHeight)
  for (let i = 0; i < grayscale.length; i++) {
    const idx = i * 4
    grayscale[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
  }

  return grayscale
}

/**
 * Get scaled grayscale data
 */
function getScaledGrayscale(
  source: HTMLImageElement | HTMLVideoElement,
  targetWidth: number,
  targetHeight: number,
  scale: number
): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!

  const scaledW = targetWidth * scale
  const scaledH = targetHeight * scale
  const offsetX = (targetWidth - scaledW) / 2
  const offsetY = (targetHeight - scaledH) / 2

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  ctx.drawImage(source, offsetX, offsetY, scaledW, scaledH)

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
  const data = imageData.data

  const grayscale = new Float32Array(targetWidth * targetHeight)
  for (let i = 0; i < grayscale.length; i++) {
    const idx = i * 4
    grayscale[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
  }

  return grayscale
}

/**
 * Auto-align two images/videos
 */
export async function autoAlign(
  sourceA: HTMLImageElement | HTMLVideoElement,
  sourceB: HTMLImageElement | HTMLVideoElement,
  options: {
    detectScale?: boolean
    detectRotation?: boolean
    maxOffset?: number
    scaleRange?: [number, number]
    rotationRange?: number
  } = {}
): Promise<AlignmentResult> {
  const {
    detectScale = true,
    detectRotation = true,
    maxOffset = 50,
    scaleRange = [0.9, 1.1],
    rotationRange = 10
  } = options

  // Work at reduced resolution for speed
  const sampleWidth = 200
  const sampleHeight = 200

  const grayscaleA = getGrayscaleData(sourceA, sampleWidth, sampleHeight)

  let bestResult: AlignmentResult = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
    confidence: 0
  }

  // Scale factors to try
  const scales = detectScale
    ? [1, 0.95, 1.05, 0.9, 1.1, scaleRange[0], scaleRange[1]]
    : [1]

  // Rotation angles to try
  const rotations = detectRotation
    ? [0, -2, 2, -5, 5, -rotationRange, rotationRange]
    : [0]

  // Search range based on sample size
  const searchRange = Math.round((maxOffset / Math.max(
    sourceA instanceof HTMLVideoElement ? sourceA.videoWidth : sourceA.naturalWidth,
    sourceA instanceof HTMLVideoElement ? sourceA.videoHeight : sourceA.naturalHeight,
    1
  )) * sampleWidth)

  for (const scale of scales) {
    for (const rotation of rotations) {
      let grayscaleB: Float32Array

      if (scale !== 1 && rotation !== 0) {
        // Apply both transformations
        const canvas = document.createElement('canvas')
        canvas.width = sampleWidth
        canvas.height = sampleHeight
        const ctx = canvas.getContext('2d')!

        ctx.translate(sampleWidth / 2, sampleHeight / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.scale(scale, scale)
        ctx.translate(-sampleWidth / 2, -sampleHeight / 2)
        ctx.drawImage(sourceB, 0, 0, sampleWidth, sampleHeight)

        const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
        grayscaleB = new Float32Array(sampleWidth * sampleHeight)
        for (let i = 0; i < grayscaleB.length; i++) {
          const idx = i * 4
          grayscaleB[i] = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2]
        }
      } else if (scale !== 1) {
        grayscaleB = getScaledGrayscale(sourceB, sampleWidth, sampleHeight, scale)
      } else if (rotation !== 0) {
        grayscaleB = getRotatedGrayscale(sourceB, sampleWidth, sampleHeight, rotation)
      } else {
        grayscaleB = getGrayscaleData(sourceB, sampleWidth, sampleHeight)
      }

      const result = crossCorrelate(
        grayscaleA,
        grayscaleB,
        sampleWidth,
        sampleHeight,
        Math.max(searchRange, 20)
      )

      if (result.correlation > bestResult.confidence) {
        // Scale offset back to original image size
        const scaleFactorX = (sourceA instanceof HTMLVideoElement ? sourceA.videoWidth : sourceA.naturalWidth) / sampleWidth
        const scaleFactorY = (sourceA instanceof HTMLVideoElement ? sourceA.videoHeight : sourceA.naturalHeight) / sampleHeight

        bestResult = {
          offsetX: Math.round(result.offsetX * scaleFactorX),
          offsetY: Math.round(result.offsetY * scaleFactorY),
          scale,
          rotation,
          confidence: result.correlation
        }
      }
    }
  }

  return bestResult
}

/**
 * Align video start points by comparing frames
 */
export async function alignVideoStartPoints(
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  searchSeconds: number = 5
): Promise<{ offsetSeconds: number; confidence: number }> {
  const fps = 10 // Sample at 10 fps
  const maxFrames = searchSeconds * fps

  // Get first frame of video A
  videoA.currentTime = 0
  await new Promise(resolve => videoA.addEventListener('seeked', resolve, { once: true }))

  const sampleWidth = 100
  const sampleHeight = 100
  const referenceFrame = getGrayscaleData(videoA, sampleWidth, sampleHeight)
  const normReference = normalize(referenceFrame)

  let bestOffset = 0
  let bestCorr = -Infinity

  // Search through video B
  for (let frame = 0; frame < maxFrames; frame++) {
    const time = frame / fps
    if (time >= videoB.duration) break

    videoB.currentTime = time
    await new Promise(resolve => videoB.addEventListener('seeked', resolve, { once: true }))

    const testFrame = getGrayscaleData(videoB, sampleWidth, sampleHeight)
    const normTest = normalize(testFrame)

    // Simple correlation
    let corr = 0
    for (let i = 0; i < normReference.length; i++) {
      corr += normReference[i] * normTest[i]
    }
    corr /= normReference.length

    if (corr > bestCorr) {
      bestCorr = corr
      bestOffset = time
    }
  }

  // Reset videos
  videoA.currentTime = 0
  videoB.currentTime = 0

  return {
    offsetSeconds: bestOffset,
    confidence: Math.max(0, bestCorr)
  }
}
