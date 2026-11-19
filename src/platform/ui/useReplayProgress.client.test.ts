// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EXPAND_MS } from './motion.client'
import { FILL_MS, useReplayProgress } from './useReplayProgress.client'

describe('useReplayProgress (#1163)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts full, so the first paint and a page without scripting show the final figures', () => {
    const { result } = renderHook(() => useReplayProgress(0))
    expect(result.current).toBe(1)
  })

  it('replays from nothing to full each time the run changes, over the shared length', () => {
    let frames: ((time: number) => void)[] = []
    let now = 0
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const step = (ms: number) =>
      act(() => {
        now += ms
        const pending = frames
        frames = []
        pending.forEach((frame) => frame(now))
      })
    const { result, rerender } = renderHook(({ run }) => useReplayProgress(run), {
      initialProps: { run: 0 },
    })
    rerender({ run: 1 })
    expect(result.current).toBe(0)
    step(0)
    step(FILL_MS / 2)
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThan(1)
    step(FILL_MS / 2)
    expect(result.current).toBe(1)
    // A second opening replays it
    rerender({ run: 2 })
    expect(result.current).toBe(0)
    step(0)
    step(FILL_MS)
    expect(result.current).toBe(1)
  })

  it('stays full for a reader who asked for less motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { result, rerender } = renderHook(({ run }) => useReplayProgress(run), {
      initialProps: { run: 0 },
    })
    rerender({ run: 1 })
    expect(result.current).toBe(1)
  })

  it('lasts as long as the bars’ fill in the theme (`chart-fill-x`), which a test holds to it', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')
    const length = /@utility chart-fill-x[\s\S]*?animation:\s*chart-reveal-x\s+([\d.]+)s/.exec(
      css,
    )?.[1]
    expect(Number(length) * 1000).toBe(FILL_MS)
  })

  it('holds at nothing for the delay it is given, then fills over the shared length (#1170)', () => {
    let frames: ((time: number) => void)[] = []
    let now = 0
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const step = (ms: number) =>
      act(() => {
        now += ms
        const pending = frames
        frames = []
        pending.forEach((frame) => frame(now))
      })
    const { result, rerender } = renderHook(
      ({ run }) => useReplayProgress(run, FILL_MS, EXPAND_MS),
      { initialProps: { run: 0 } },
    )
    rerender({ run: 1 })
    step(0)
    step(EXPAND_MS - 1)
    expect(result.current).toBe(0)
    step(1)
    step(FILL_MS / 2)
    expect(result.current).toBeGreaterThan(0.5)
    expect(result.current).toBeLessThan(1)
    step(FILL_MS)
    expect(result.current).toBe(1)
  })

  it('waits for the row to expand in the theme too (`chart-fill-x`), which a test holds to the delay', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')
    const block = /@utility chart-fill-x[\s\S]*?\n\}/.exec(css)?.[0] ?? ''
    const delay = /animation-delay:\s*([\d.]+)ms/.exec(block)?.[1]
    expect(Number(delay)).toBe(EXPAND_MS)
  })
})
