'use client'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * The width of an element in CSS pixels, kept current as it resizes: 0 until it is measured (on the
 * server, before the first paint, or where the browser has no `ResizeObserver`), so a caller draws
 * a percent-based fallback until then. Used where a drawing must land on whole pixels to stay crisp.
 */
export function useElementWidth<T extends Element>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(element.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}
