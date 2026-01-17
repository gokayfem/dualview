/**
 * Professional Audio Analysis Library
 *
 * Implements industry-standard audio metrics:
 * - LUFS (Loudness Units Full Scale) - EBU R128 / ITU-R BS.1770
 * - True Peak detection
 * - RMS (Root Mean Square)
 * - Crest Factor (Peak to RMS ratio)
 * - Phase Correlation
 * - Stereo Width
 * - Dynamic Range
 * - Frequency spectrum analysis
 */

export interface LoudnessMetrics {
  // LUFS measurements
  momentary: number      // 400ms window
  shortTerm: number      // 3s window
  integrated: number     // Full duration
  loudnessRange: number  // LRA - dynamic range in LU

  // Peak measurements
  truePeak: number       // dBTP
  samplePeak: number     // dBFS

  // RMS
  rms: number           // dBFS

  // Crest factor (peak to RMS ratio in dB)
  crestFactor: number
}

export interface StereoMetrics {
  // Phase correlation (-1 to +1)
  correlation: number

  // Stereo width (0 to 1, where 0 is mono)
  width: number

  // Balance (-1 left, 0 center, +1 right)
  balance: number

  // Mid/Side ratio
  midLevel: number
  sideLevel: number
}

export interface SpectralData {
  frequencies: Float32Array
  magnitudes: Float32Array
  phases: Float32Array
  binCount: number
  sampleRate: number
  fftSize: number
}

export interface AudioAnalysisResult {
  loudness: LoudnessMetrics
  stereo: StereoMetrics
  spectral: SpectralData
  waveformPeaks: Float32Array
  duration: number
  sampleRate: number
  channels: number
}

// K-weighting filter coefficients for LUFS calculation
// Based on ITU-R BS.1770-4
const K_WEIGHT_HIGH_SHELF = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585
}

const K_WEIGHT_HIGH_PASS = {
  b0: 1.0,
  b1: -2.0,
  b2: 1.0,
  a1: -1.99004745483398,
  a2: 0.99007225036621
}

/**
 * Apply biquad filter to audio data
 */
function applyBiquadFilter(
  data: Float32Array,
  coeffs: { b0: number; b1: number; b2: number; a1: number; a2: number }
): Float32Array {
  const output = new Float32Array(data.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0

  for (let i = 0; i < data.length; i++) {
    const x0 = data[i]
    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2
                - coeffs.a1 * y1 - coeffs.a2 * y2

    output[i] = y0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
  }

  return output
}

/**
 * Apply K-weighting filter for LUFS measurement
 */
function applyKWeighting(data: Float32Array): Float32Array {
  // Stage 1: High shelf filter
  const stage1 = applyBiquadFilter(data, K_WEIGHT_HIGH_SHELF)
  // Stage 2: High pass filter
  return applyBiquadFilter(stage1, K_WEIGHT_HIGH_PASS)
}

/**
 * Calculate mean square of audio data
 */
function calculateMeanSquare(data: Float32Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i]
  }
  return sum / data.length
}

/**
 * Convert linear value to dB
 */
function linearToDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -Infinity
}

/**
 * Calculate LUFS from mean square (with K-weighting already applied)
 */
function meanSquareToLUFS(meanSquare: number): number {
  return meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity
}

/**
 * Find true peak using 4x oversampling
 */
function findTruePeak(data: Float32Array): number {
  let maxPeak = 0

  // Simple 4x oversampling using linear interpolation
  // (A proper implementation would use sinc interpolation)
  for (let i = 0; i < data.length - 1; i++) {
    const current = Math.abs(data[i])
    const next = Math.abs(data[i + 1])

    maxPeak = Math.max(maxPeak, current, next)

    // Check interpolated samples
    for (let j = 1; j < 4; j++) {
      const t = j / 4
      const interpolated = Math.abs(data[i] * (1 - t) + data[i + 1] * t)
      maxPeak = Math.max(maxPeak, interpolated)
    }
  }

  return maxPeak
}

/**
 * Calculate phase correlation between two channels
 */
function calculateCorrelation(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length)

  let sumLR = 0
  let sumLL = 0
  let sumRR = 0

  for (let i = 0; i < length; i++) {
    sumLR += left[i] * right[i]
    sumLL += left[i] * left[i]
    sumRR += right[i] * right[i]
  }

  const denominator = Math.sqrt(sumLL * sumRR)
  return denominator > 0 ? sumLR / denominator : 0
}

/**
 * Calculate stereo width using mid/side analysis
 */
function calculateStereoWidth(left: Float32Array, right: Float32Array): {
  width: number
  balance: number
  midLevel: number
  sideLevel: number
} {
  const length = Math.min(left.length, right.length)

  let midSum = 0
  let sideSum = 0
  let leftSum = 0
  let rightSum = 0

  for (let i = 0; i < length; i++) {
    const mid = (left[i] + right[i]) / 2
    const side = (left[i] - right[i]) / 2

    midSum += mid * mid
    sideSum += side * side
    leftSum += left[i] * left[i]
    rightSum += right[i] * right[i]
  }

  const midRms = Math.sqrt(midSum / length)
  const sideRms = Math.sqrt(sideSum / length)
  const leftRms = Math.sqrt(leftSum / length)
  const rightRms = Math.sqrt(rightSum / length)

  // Width: ratio of side to total energy
  const totalEnergy = midRms + sideRms
  const width = totalEnergy > 0 ? sideRms / totalEnergy : 0

  // Balance: difference between left and right levels
  const maxLR = Math.max(leftRms, rightRms)
  const balance = maxLR > 0 ? (rightRms - leftRms) / maxLR : 0

  return {
    width,
    balance,
    midLevel: linearToDb(midRms),
    sideLevel: linearToDb(sideRms)
  }
}

/**
 * Generate waveform peaks for visualization
 */
function generateWaveformPeaks(data: Float32Array, numPeaks: number): Float32Array {
  const peaks = new Float32Array(numPeaks)
  const samplesPerPeak = Math.floor(data.length / numPeaks)

  for (let i = 0; i < numPeaks; i++) {
    let maxVal = 0
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, data.length)

    for (let j = start; j < end; j++) {
      maxVal = Math.max(maxVal, Math.abs(data[j]))
    }

    peaks[i] = maxVal
  }

  return peaks
}

/**
 * Calculate LUFS with different time windows
 */
function calculateLUFS(
  audioBuffer: AudioBuffer
): { momentary: number; shortTerm: number; integrated: number; loudnessRange: number } {
  const sampleRate = audioBuffer.sampleRate
  const momentaryWindow = Math.floor(0.4 * sampleRate)   // 400ms
  const shortTermWindow = Math.floor(3 * sampleRate)      // 3s

  // Get all channels and apply K-weighting
  const channels: Float32Array[] = []
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channels.push(applyKWeighting(audioBuffer.getChannelData(c)))
  }

  // Sum the squared values across all channels (for stereo, each channel has weight 1.0)
  const length = channels[0].length
  const summedSquares = new Float32Array(length)

  for (let i = 0; i < length; i++) {
    let sum = 0
    for (const channel of channels) {
      sum += channel[i] * channel[i]
    }
    summedSquares[i] = sum
  }

  // Calculate gated loudness values for LRA
  const blockSize = Math.floor(0.4 * sampleRate) // 400ms blocks with 75% overlap
  const hopSize = Math.floor(blockSize * 0.25)
  const blockLoudness: number[] = []

  for (let start = 0; start + blockSize <= length; start += hopSize) {
    let blockSum = 0
    for (let i = start; i < start + blockSize; i++) {
      blockSum += summedSquares[i]
    }
    const blockMean = blockSum / blockSize
    const lufs = meanSquareToLUFS(blockMean)
    if (lufs > -70) { // Absolute gate
      blockLoudness.push(lufs)
    }
  }

  // Integrated loudness (with relative gating)
  let integrated = -Infinity
  if (blockLoudness.length > 0) {
    const ungatedMean = blockLoudness.reduce((a, b) => a + Math.pow(10, b / 10), 0) / blockLoudness.length
    const ungatedLUFS = 10 * Math.log10(ungatedMean)
    const relativeThreshold = ungatedLUFS - 10

    const gatedBlocks = blockLoudness.filter(l => l > relativeThreshold)
    if (gatedBlocks.length > 0) {
      const gatedMean = gatedBlocks.reduce((a, b) => a + Math.pow(10, b / 10), 0) / gatedBlocks.length
      integrated = 10 * Math.log10(gatedMean)
    }
  }

  // Momentary (last 400ms or average if short)
  const momentarySamples = Math.min(momentaryWindow, length)
  let momentarySum = 0
  for (let i = length - momentarySamples; i < length; i++) {
    momentarySum += summedSquares[i]
  }
  const momentary = meanSquareToLUFS(momentarySum / momentarySamples)

  // Short-term (last 3s or average if short)
  const shortTermSamples = Math.min(shortTermWindow, length)
  let shortTermSum = 0
  for (let i = length - shortTermSamples; i < length; i++) {
    shortTermSum += summedSquares[i]
  }
  const shortTerm = meanSquareToLUFS(shortTermSum / shortTermSamples)

  // Loudness Range (LRA)
  let loudnessRange = 0
  if (blockLoudness.length > 10) {
    const sorted = [...blockLoudness].sort((a, b) => a - b)
    const low = sorted[Math.floor(sorted.length * 0.1)]  // 10th percentile
    const high = sorted[Math.floor(sorted.length * 0.95)] // 95th percentile
    loudnessRange = high - low
  }

  return { momentary, shortTerm, integrated, loudnessRange }
}

/**
 * Analyze audio buffer and return comprehensive metrics
 */
export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AudioAnalysisResult> {
  const sampleRate = audioBuffer.sampleRate
  const channels = audioBuffer.numberOfChannels
  const duration = audioBuffer.duration

  // Get channel data
  const leftChannel = audioBuffer.getChannelData(0)
  const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : leftChannel

  // Mix to mono for some calculations
  const mono = new Float32Array(leftChannel.length)
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (leftChannel[i] + rightChannel[i]) / 2
  }

  // Calculate LUFS
  const lufs = calculateLUFS(audioBuffer)

  // Calculate peaks - use loop instead of spread operator to avoid stack overflow
  let samplePeak = 0
  for (let i = 0; i < leftChannel.length; i++) {
    const absLeft = Math.abs(leftChannel[i])
    if (absLeft > samplePeak) samplePeak = absLeft
  }
  for (let i = 0; i < rightChannel.length; i++) {
    const absRight = Math.abs(rightChannel[i])
    if (absRight > samplePeak) samplePeak = absRight
  }
  const truePeak = Math.max(findTruePeak(leftChannel), findTruePeak(rightChannel))

  // Calculate RMS
  const leftRms = Math.sqrt(calculateMeanSquare(leftChannel))
  const rightRms = Math.sqrt(calculateMeanSquare(rightChannel))
  const rms = Math.sqrt((leftRms * leftRms + rightRms * rightRms) / 2)

  // Calculate stereo metrics
  const correlation = calculateCorrelation(leftChannel, rightChannel)
  const stereoWidth = calculateStereoWidth(leftChannel, rightChannel)

  // Calculate crest factor
  const crestFactor = linearToDb(samplePeak) - linearToDb(rms)

  // Generate waveform peaks
  const waveformPeaks = generateWaveformPeaks(mono, 500)

  // Spectral analysis (placeholder - will be done in real-time by WebGL)
  const spectral: SpectralData = {
    frequencies: new Float32Array(0),
    magnitudes: new Float32Array(0),
    phases: new Float32Array(0),
    binCount: 0,
    sampleRate,
    fftSize: 2048
  }

  return {
    loudness: {
      momentary: lufs.momentary,
      shortTerm: lufs.shortTerm,
      integrated: lufs.integrated,
      loudnessRange: lufs.loudnessRange,
      truePeak: linearToDb(truePeak),
      samplePeak: linearToDb(samplePeak),
      rms: linearToDb(rms),
      crestFactor
    },
    stereo: {
      correlation,
      width: stereoWidth.width,
      balance: stereoWidth.balance,
      midLevel: stereoWidth.midLevel,
      sideLevel: stereoWidth.sideLevel
    },
    spectral,
    waveformPeaks,
    duration,
    sampleRate,
    channels
  }
}

/**
 * Calculate difference between two audio analyses
 */
export function calculateAudioDifference(
  a: AudioAnalysisResult,
  b: AudioAnalysisResult
): {
  loudnessDiff: number
  correlationDiff: number
  spectralDiff: number
  phaseDiff: number
} {
  return {
    loudnessDiff: Math.abs(a.loudness.integrated - b.loudness.integrated),
    correlationDiff: Math.abs(a.stereo.correlation - b.stereo.correlation),
    spectralDiff: 0, // Will be calculated in real-time
    phaseDiff: Math.abs(a.stereo.width - b.stereo.width)
  }
}

/**
 * Format LUFS value for display
 */
export function formatLUFS(value: number): string {
  if (!isFinite(value)) return '-∞'
  return value.toFixed(1) + ' LUFS'
}

/**
 * Format dB value for display
 */
export function formatDb(value: number): string {
  if (!isFinite(value)) return '-∞ dB'
  return value.toFixed(1) + ' dB'
}

/**
 * Get loudness target for different platforms
 */
export const LOUDNESS_TARGETS = {
  spotify: -14,
  youtube: -14,
  appleMusic: -16,
  amazonMusic: -14,
  tidal: -14,
  broadcast: -24, // EBU R128
  cinema: -27,    // SMPTE
  podcast: -16
} as const

/**
 * Check if audio meets platform loudness requirements
 */
export function checkLoudnessCompliance(
  integrated: number,
  platform: keyof typeof LOUDNESS_TARGETS
): { compliant: boolean; difference: number; target: number } {
  const target = LOUDNESS_TARGETS[platform]
  const difference = integrated - target
  return {
    compliant: Math.abs(difference) <= 1, // 1 LU tolerance
    difference,
    target
  }
}
