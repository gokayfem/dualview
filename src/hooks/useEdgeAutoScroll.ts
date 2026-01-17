/**
 * Edge Auto-Scroll Hook (TL-005: OpenCut Pattern)
 *
 * Provides smooth edge scrolling when dragging near container edges:
 * - Auto-scroll when within edge threshold
 * - Scroll speed proportional to distance from edge
 * - Uses requestAnimationFrame for smooth animation
 * - Syncs scroll across multiple containers
 */
import { useRef, useCallback, useEffect } from 'react'

interface UseEdgeAutoScrollOptions {
  /** Distance from edge to trigger scrolling (default: 100px) */
  edgeThreshold?: number
  /** Maximum scroll speed in px/frame (default: 15) */
  maxScrollSpeed?: number
  /** Width of scrollable content */
  contentWidth: number
  /** Whether auto-scroll is currently active */
  isActive: boolean
}

export function useEdgeAutoScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseEdgeAutoScrollOptions
) {
  const {
    edgeThreshold = 100,
    maxScrollSpeed = 15,
    contentWidth,
    isActive,
  } = options

  const animationFrameRef = useRef<number | null>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const isScrollingRef = useRef(false)

  // Update mouse position
  const updateMousePosition = useCallback((e: MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  // Start auto-scroll loop
  const startAutoScroll = useCallback(() => {
    if (isScrollingRef.current) return
    isScrollingRef.current = true

    const scroll = () => {
      const container = containerRef.current
      if (!container || !isScrollingRef.current) {
        animationFrameRef.current = null
        return
      }

      const rect = container.getBoundingClientRect()
      const mouseX = mousePositionRef.current.x

      // Calculate distance from edges
      const distanceFromLeft = mouseX - rect.left
      const distanceFromRight = rect.right - mouseX

      // Calculate scroll amount
      let scrollAmount = 0

      if (distanceFromLeft < edgeThreshold && distanceFromLeft > 0) {
        // Near left edge - scroll left
        const intensity = 1 - (distanceFromLeft / edgeThreshold)
        scrollAmount = -maxScrollSpeed * intensity
      } else if (distanceFromRight < edgeThreshold && distanceFromRight > 0) {
        // Near right edge - scroll right
        const intensity = 1 - (distanceFromRight / edgeThreshold)
        scrollAmount = maxScrollSpeed * intensity
      }

      if (scrollAmount !== 0) {
        // Respect scroll boundaries
        const currentScroll = container.scrollLeft
        const maxScroll = contentWidth - container.clientWidth
        const newScroll = Math.max(0, Math.min(maxScroll, currentScroll + scrollAmount))

        if (newScroll !== currentScroll) {
          container.scrollLeft = newScroll
        }
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(scroll)
    }

    animationFrameRef.current = requestAnimationFrame(scroll)
  }, [containerRef, edgeThreshold, maxScrollSpeed, contentWidth])

  // Stop auto-scroll
  const stopAutoScroll = useCallback(() => {
    isScrollingRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  // Start/stop based on isActive
  useEffect(() => {
    if (isActive) {
      document.addEventListener('mousemove', updateMousePosition)
      startAutoScroll()
    } else {
      stopAutoScroll()
      document.removeEventListener('mousemove', updateMousePosition)
    }

    return () => {
      stopAutoScroll()
      document.removeEventListener('mousemove', updateMousePosition)
    }
  }, [isActive, startAutoScroll, stopAutoScroll, updateMousePosition])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoScroll()
    }
  }, [stopAutoScroll])

  return {
    startAutoScroll,
    stopAutoScroll,
  }
}

/**
 * Synchronized Scroll Hook (TL-007)
 *
 * Keeps multiple scrollable elements in sync
 */
interface UseSyncedScrollOptions {
  /** Debounce time to prevent circular updates */
  debounceMs?: number
}

export function useSyncedScroll(
  refs: React.RefObject<HTMLElement | null>[],
  options: UseSyncedScrollOptions = {}
) {
  const { debounceMs = 10 } = options

  const isUpdatingRef = useRef(false)
  const lastScrollRef = useRef({ left: 0, top: 0 })
  const timeoutRef = useRef<number | null>(null)

  const handleScroll = useCallback((sourceIndex: number) => {
    if (isUpdatingRef.current) return

    const source = refs[sourceIndex]?.current
    if (!source) return

    const scrollLeft = source.scrollLeft
    const scrollTop = source.scrollTop

    // Skip if scroll position hasn't changed
    if (scrollLeft === lastScrollRef.current.left && scrollTop === lastScrollRef.current.top) {
      return
    }

    lastScrollRef.current = { left: scrollLeft, top: scrollTop }
    isUpdatingRef.current = true

    // Update other containers
    refs.forEach((ref, index) => {
      if (index !== sourceIndex && ref.current) {
        ref.current.scrollLeft = scrollLeft
        ref.current.scrollTop = scrollTop
      }
    })

    // Reset flag after debounce
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      isUpdatingRef.current = false
    }, debounceMs)
  }, [refs, debounceMs])

  // Attach scroll listeners
  useEffect(() => {
    const listeners: { ref: HTMLElement; handler: () => void }[] = []

    refs.forEach((ref, index) => {
      if (ref.current) {
        const handler = () => handleScroll(index)
        ref.current.addEventListener('scroll', handler)
        listeners.push({ ref: ref.current, handler })
      }
    })

    return () => {
      listeners.forEach(({ ref, handler }) => {
        ref.removeEventListener('scroll', handler)
      })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [refs, handleScroll])

  // Programmatically scroll all containers
  const scrollTo = useCallback((left: number, top?: number) => {
    isUpdatingRef.current = true
    refs.forEach(ref => {
      if (ref.current) {
        ref.current.scrollLeft = left
        if (top !== undefined) {
          ref.current.scrollTop = top
        }
      }
    })
    lastScrollRef.current = { left, top: top ?? lastScrollRef.current.top }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      isUpdatingRef.current = false
    }, debounceMs)
  }, [refs, debounceMs])

  return { scrollTo }
}
