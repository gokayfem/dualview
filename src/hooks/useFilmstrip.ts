/**
 * useFilmstrip Hook (FILMSTRIP-001, FILMSTRIP-002)
 * 
 * Manages filmstrip extraction and caching for video clips.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  extractFilmstrip,
  getCachedFilmstrip,
  type FilmstripData,
  type FilmstripConfig,
} from '../lib/filmstripExtractor'
import { useMediaStore } from '../stores/mediaStore'

interface UseFilmstripOptions extends FilmstripConfig {
  enabled?: boolean
}

interface UseFilmstripResult {
  filmstrip: FilmstripData | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

/**
 * Hook to get filmstrip data for a video media item
 */
export function useFilmstrip(
  mediaId: string | undefined,
  options: UseFilmstripOptions = {}
): UseFilmstripResult {
  const { enabled = true, ...config } = options
  const [filmstrip, setFilmstrip] = useState<FilmstripData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const getFile = useMediaStore(state => state.getFile)

  const reload = useCallback(() => {
    setReloadTrigger(prev => prev + 1)
  }, [])

  useEffect(() => {
    if (!mediaId || !enabled) {
      setFilmstrip(null)
      return
    }

    const media = getFile(mediaId)
    if (!media || media.type !== 'video') {
      setFilmstrip(null)
      return
    }

    // Check cache first
    const cached = getCachedFilmstrip(mediaId)
    if (cached) {
      setFilmstrip(cached)
      return
    }

    // Start extraction
    setIsLoading(true)
    setError(null)

    extractFilmstrip(mediaId, media.url, media.duration || 10, config)
      .then(result => {
        setFilmstrip(result)
        if (!result) {
          setError('Failed to extract frames')
        }
      })
      .catch(err => {
        console.error('Filmstrip extraction error:', err)
        setError(err.message || 'Extraction failed')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [mediaId, enabled, getFile, reloadTrigger, config])

  return { filmstrip, isLoading, error, reload }
}

/**
 * Hook to get filmstrips for multiple media items
 */
export function useFilmstrips(
  mediaIds: string[],
  options: UseFilmstripOptions = {}
): Map<string, FilmstripData | null> {
  const { enabled = true, ...config } = options
  const [filmstrips, setFilmstrips] = useState<Map<string, FilmstripData | null>>(new Map())

  const getFile = useMediaStore(state => state.getFile)

  useEffect(() => {
    if (!enabled || mediaIds.length === 0) {
      setFilmstrips(new Map())
      return
    }

    const extractAll = async () => {
      const results = new Map<string, FilmstripData | null>()

      for (const mediaId of mediaIds) {
        // Check cache first
        const cached = getCachedFilmstrip(mediaId)
        if (cached) {
          results.set(mediaId, cached)
          continue
        }

        const media = getFile(mediaId)
        if (!media || media.type !== 'video') {
          results.set(mediaId, null)
          continue
        }

        try {
          const filmstrip = await extractFilmstrip(
            mediaId,
            media.url,
            media.duration || 10,
            config
          )
          results.set(mediaId, filmstrip)
        } catch {
          results.set(mediaId, null)
        }
      }

      setFilmstrips(results)
    }

    extractAll()
  }, [mediaIds.join(','), enabled, getFile])

  return filmstrips
}
