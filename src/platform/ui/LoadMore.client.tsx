'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './Button'

import type { FeedMore, FeedPage } from '@/platform/lib'
import { cn } from '@/platform/lib/cn'

/**
 * Pages loaded automatically while scrolling, counting the first page. After that the
 * reader clicks "Load more", so the footer stays reachable on long lists (the usual
 * failure of pure infinite scroll).
 */
const AUTO_LOAD_PAGES = 4

type Status = 'idle' | 'loading' | 'error'

/**
 * A listing that starts from one numbered page and loads what follows it. Each load sends the
 * cursor the previous one returned (the last item's sort key and id, #125), so an item removed
 * between two loads skips nothing.
 */
export function useLoadMore<T extends { id: number | string }>(
  initial: FeedPage<T>,
  load: (cursor: string) => Promise<FeedMore<T>>,
) {
  const [items, setItems] = useState<T[]>(initial.docs)
  const [nextCursor, setNextCursor] = useState(initial.nextCursor)
  const [totalDocs, setTotalDocs] = useState(initial.totalDocs)
  const [status, setStatus] = useState<Status>('idle')
  const [pagesLoaded, setPagesLoaded] = useState(1)
  const inFlight = useRef(false)
  // The latest cursor in a ref, so a stale callback (e.g. the scroll observer firing before
  // re-render) can never request the same items twice
  const cursorRef = useRef(initial.nextCursor)

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current
    if (inFlight.current || cursor === null) return
    inFlight.current = true
    setStatus('loading')
    try {
      const next = await load(cursor)
      cursorRef.current = next.nextCursor
      setItems((prev) => {
        // An item can come back between requests (an event moved to a later date); skip repeats.
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...next.docs.filter((item) => !seen.has(item.id))]
      })
      setNextCursor(next.nextCursor)
      setTotalDocs(next.totalDocs)
      setPagesLoaded((n) => n + 1)
      setStatus('idle')
    } catch {
      setStatus('error')
    } finally {
      inFlight.current = false
    }
  }, [load])

  return {
    items,
    hasMore: nextCursor !== null,
    status,
    loadMore,
    totalDocs,
    firstItemNumber: (initial.page - 1) * initial.limit + 1,
    /** The numbered page after what's loaded (for the no-JavaScript "next page" link). */
    nextPage: initial.page + pagesLoaded,
    autoLoad: pagesLoaded < AUTO_LOAD_PAGES,
  }
}

type LoadMoreFooterProps = {
  /** Plural noun for status text, e.g. "posts" or "upcoming events". */
  noun: string
  shownCount: number
  firstItemNumber: number
  totalDocs: number
  hasMore: boolean
  status: Status
  autoLoad: boolean
  onLoadMore: () => void
  /** Real URL of the next page, so "Load more" also works without JavaScript. */
  fallbackHref: string
  className?: string
}

export const LoadMoreFooter: React.FC<LoadMoreFooterProps> = ({
  noun,
  shownCount,
  firstItemNumber,
  totalDocs,
  hasMore,
  status,
  autoLoad,
  onLoadMore,
  fallbackHref,
  className,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const controlRef = useRef<HTMLAnchorElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  // Whether keyboard focus was on "Load more" when the current load started
  const hadFocusRef = useRef(false)

  const startLoad = useCallback(() => {
    hadFocusRef.current =
      controlRef.current !== null && document.activeElement === controlRef.current
    onLoadMore()
  }, [onLoadMore])

  // The last load removes "Load more". If it had focus, the browser drops focus to <body>
  // and the next Tab jumps to the top of the page; keep it at the end of the list instead.
  useEffect(() => {
    if (status !== 'idle' || hasMore || !hadFocusRef.current) return
    hadFocusRef.current = false
    if (!document.activeElement || document.activeElement === document.body) {
      statusRef.current?.focus()
    }
  }, [hasMore, status])

  // Infinite scroll: load the next page shortly before the reader reaches the end.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || !autoLoad || status !== 'idle') return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) startLoad()
      },
      { rootMargin: '0px 0px 600px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [autoLoad, hasMore, startLoad, status])

  if (totalDocs === 0) return null

  const lastItemNumber = firstItemNumber + shownCount - 1
  const range = firstItemNumber > 1 ? `${firstItemNumber}–${lastItemNumber}` : `${lastItemNumber}`
  const statusText = hasMore
    ? `Showing ${range} of ${totalDocs} ${noun}`
    : firstItemNumber > 1
      ? `Showing ${range} of ${totalDocs} ${noun} — that's the end of the list`
      : `That's all ${totalDocs} ${noun}`

  return (
    <div className={cn('mt-10 flex flex-col items-center gap-4 text-center', className)}>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        // Focus target when the last load removes "Load more" (see above); not in the tab order
        tabIndex={-1}
        className="rounded-sm text-sm text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {status === 'loading' ? `Loading more ${noun}…` : statusText}
      </p>

      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load more {noun}. Check your connection and try again.
        </p>
      )}

      {hasMore && (
        // A real link, so "Load more" also works without JavaScript and can open in a new tab.
        // Button's loading state keeps keyboard focus on it.
        <Button
          ref={controlRef}
          href={fallbackHref}
          variant="secondary"
          size="sm"
          loading={status === 'loading'}
          onClick={(event) => {
            // Let Ctrl/Cmd/Shift/middle clicks open the fallback page in a new tab or window
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return
            event.preventDefault()
            startLoad()
          }}
        >
          {status === 'error' ? 'Try again' : `Load more ${noun}`}
        </Button>
      )}
    </div>
  )
}
