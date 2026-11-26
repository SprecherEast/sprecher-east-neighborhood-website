import { describe, expect, it } from 'vitest'

import {
  ZOOM_MAX,
  centerOn,
  fitPoints,
  panBy,
  pinch,
  toScreen,
  toWorld,
  zoomAt,
} from './camera.mjs'

const cam = { k: 1, tx: 0, ty: 0 }
const close = (a, b) => expect(a).toBeCloseTo(b, 6)

describe('camera (#1463)', () => {
  it('converts between screen and world', () => {
    const c = { k: 2, tx: 10, ty: 20 }
    expect(toScreen(c, 5, 5)).toEqual({ x: 20, y: 30 })
    expect(toWorld(c, 20, 30)).toEqual({ x: 5, y: 5 })
  })

  it('zooms toward the cursor: the point under it stays put', () => {
    const next = zoomAt({ k: 1, tx: 30, ty: -10 }, 200, 100, 2)
    const before = toWorld({ k: 1, tx: 30, ty: -10 }, 200, 100)
    const after = toWorld(next, 200, 100)
    close(after.x, before.x)
    close(after.y, before.y)
    expect(next.k).toBe(2)
  })

  it('limits the zoom', () => {
    expect(zoomAt(cam, 0, 0, 1000).k).toBe(ZOOM_MAX)
  })

  it('pans', () => {
    expect(panBy(cam, 3, -4)).toEqual({ k: 1, tx: 3, ty: -4 })
  })

  it('centres a point', () => {
    const c = centerOn(cam, 100, 50, 400, 200)
    expect(toScreen(c, 100, 50)).toEqual({ x: 200, y: 100 })
  })

  it('fits points inside the screen with a margin', () => {
    const c = fitPoints(
      [
        { x: -500, y: -100 },
        { x: 500, y: 100 },
      ],
      400,
      300,
    )
    const a = toScreen(c, -500, -100)
    const b = toScreen(c, 500, 100)
    expect(a.x).toBeGreaterThanOrEqual(60 - 1e-6)
    expect(b.x).toBeLessThanOrEqual(340 + 1e-6)
    expect(fitPoints([], 400, 300).k).toBe(1)
  })

  it('pinches: two fingers moving apart zoom, and moving together pan', () => {
    const before = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]
    const zoomed = pinch(cam, before, [
      { x: 50, y: 100 },
      { x: 250, y: 100 },
    ])
    close(zoomed.k, 2)
    // The world point that was under each finger is still under it.
    close(toScreen(zoomed, 100, 100).x, 50)
    close(toScreen(zoomed, 200, 100).x, 250)
    const panned = pinch(cam, before, [
      { x: 130, y: 120 },
      { x: 230, y: 120 },
    ])
    expect(panned).toEqual({ k: 1, tx: 30, ty: 20 })
  })

  it('ignores a pinch of two fingers on the same spot', () => {
    expect(
      pinch(
        cam,
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        [
          { x: 0, y: 0 },
          { x: 9, y: 9 },
        ],
      ),
    ).toBe(cam)
  })
})
