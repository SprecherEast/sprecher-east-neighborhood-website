'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Runs `onView` once, the first time the element behind the returned ref is in view, then stops
 * watching (#1413). A little of the element is enough (a quarter), so a reader who has scrolled
 * just far enough to see it gets what it is for. The latest `onView` runs, not the one from the first
 * render. A browser that cannot tell what is in view runs it at once on mount, so what a reader must
 * see is never held back.
 */
export function useOnFirstView<T extends Element>(onView: () => void): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const latest = useRef(onView)
  useEffect(() => {
    latest.current = onView
  })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      latest.current()
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        latest.current()
      },
      { threshold: 0.25 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return ref
}
