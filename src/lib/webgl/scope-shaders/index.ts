/**
 * Scope Shaders Index
 * SCOPE-001: Waveform Monitor
 * SCOPE-002: Vectorscope Display
 * SCOPE-003: RGB Parade
 */

import { SCOPE_VERTEX_SHADER, SCOPE_COMMON } from './common'
import { WAVEFORM_SHADER, WAVEFORM_PARADE_SHADER } from './waveform'
import { VECTORSCOPE_SHADER } from './vectorscope'
import { RGB_PARADE_SHADER } from './parade'

// Re-export all shaders
export { SCOPE_VERTEX_SHADER, SCOPE_COMMON }
export { WAVEFORM_SHADER, WAVEFORM_PARADE_SHADER }
export { VECTORSCOPE_SHADER }
export { RGB_PARADE_SHADER }

export type ScopeShaderType = 'waveform' | 'waveform-parade' | 'vectorscope' | 'parade'

export function getScopeShader(type: ScopeShaderType): string {
  switch (type) {
    case 'waveform':
      return WAVEFORM_SHADER
    case 'waveform-parade':
      return WAVEFORM_PARADE_SHADER
    case 'vectorscope':
      return VECTORSCOPE_SHADER
    case 'parade':
      return RGB_PARADE_SHADER
    default:
      return WAVEFORM_SHADER
  }
}
