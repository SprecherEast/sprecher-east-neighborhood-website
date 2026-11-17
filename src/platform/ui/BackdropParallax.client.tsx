'use client'

import React, { useEffect, useRef } from 'react'

/**
 * How far the photo drifts, up and down from its middle, as a share of its own height. The photo
 * is 18% taller than the screen and starts 9% above it, so the drift (7% of 118%) never shows an edge.
 */
const DRIFT_PERCENT = 7
const AT_TOP = `translate3d(0, ${DRIFT_PERCENT}%, 0)`

/*
 * The slow drift of a page's backdrop photo as the page scrolls (#1268): the photo is a little
 * taller than the screen and moves from `DRIFT_PERCENT` down at the top of the page to as much up
 * at its foot. It sets one `transform` on its own box and nothing else, in a frame at most once
 * per scroll step, so it never touches the layout (a transform moves no other box) and costs the
 * page no reflow. A visitor who asks for reduced motion gets a still photo: no listener at all.
 * Server-rendered, the photo is already where it is at the top of the page, so nothing jumps when
 * this script starts, and a visitor who asks for reduced motion sees it there, still.
 */
export function BackdropParallax({ children }: { children: React.ReactNode }) {
  const mover = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = mover.current
    if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const move = () => {
      frame = 0
      const room = document.documentElement.scrollHeight - window.innerHeight
      const progress = room > 0 ? Math.min(Math.max(window.scrollY / room, 0), 1) : 0.5
      box.style.transform = `translate3d(0, ${(0.5 - progress) * 2 * DRIFT_PERCENT}%, 0)`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(move)
    }

    move()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={mover}
      data-backdrop-parallax
      className="absolute inset-x-0 -top-[9%] h-[118%] will-change-transform"
      style={{ transform: AT_TOP }}
    >
      {children}
    </div>
  )
}
