// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ChartSpec } from '@/platform/lib/chart/spec'

import { expectAccessible } from '../testing/expectAccessible'

import { ScaledBreakdown } from './ScaledBreakdown'

afterEach(cleanup)

type Breakdown = Extract<ChartSpec, { kind: 'breakdown' }>

const SPEC: Breakdown = {
  kind: 'breakdown',
  title: 'Where that City tax goes, estimated',
  summary: 'Our estimate: split like the operating budget.',
  unit: 'usd',
  hideSquares: true,
  asOf: 'Mayor’s proposal, 2026',
  sources: [{ label: 'City budget', href: 'https://example.org/budget' }],
  areas: [
    {
      key: 'safety',
      label: 'Public safety',
      value: 1400,
      pieces: [{ key: 'police', label: 'Police', value: 740, shown: true }],
    },
    { key: 'debt', label: 'Debt service', value: 600 },
  ],
}

const amounts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-amount]')).map((n) => n.textContent)

describe('ScaledBreakdown', () => {
  it('draws the breakdown with every amount multiplied by the factor', () => {
    const { container } = render(<ScaledBreakdown spec={SPEC} factor={0.5} />)
    expect(amounts(container)).toEqual(['$700', '$370', '$300'])
  })

  it('draws a different bill again when the factor changes, with the shares the same', () => {
    const { container, rerender } = render(<ScaledBreakdown spec={SPEC} factor={1} />)
    expect(amounts(container)).toEqual(['$1,400', '$740', '$600'])
    rerender(<ScaledBreakdown spec={SPEC} factor={2} />)
    expect(amounts(container)).toEqual(['$2,800', '$1,480', '$1,200'])
    expect(screen.getByText('70.0%')).toBeTruthy()
  })

  it('fills its bars and counts its amounts each time `fillKey` changes, from the opening row (#1163)', () => {
    const { container, rerender } = render(<ScaledBreakdown spec={SPEC} factor={0.5} />)
    // No fill asked for: the bars keep the scroll reveal
    expect(container.querySelector('.chart-reveal-x')).not.toBeNull()
    expect(container.querySelector('.chart-fill-x')).toBeNull()
    rerender(<ScaledBreakdown spec={SPEC} factor={0.5} fillKey={1} />)
    expect(container.querySelector('.chart-fill-x')).not.toBeNull()
    expect(container.querySelector('.chart-reveal-x')).toBeNull()
    // Less motion (jsdom says so): the final amounts at once
    expect(amounts(container)).toEqual(['$700', '$370', '$300'])
  })

  it('draws thinner bars when compact, for a breakdown that sits inside a bill (#1163)', () => {
    const marks = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('[data-chart-mark]'), (mark) =>
        mark.closest('svg')?.getAttribute('class'),
      )
    const { container, rerender } = render(<ScaledBreakdown spec={SPEC} factor={0.5} />)
    expect(marks(container)).toEqual(expect.arrayContaining([expect.stringContaining('h-3.5')]))
    rerender(<ScaledBreakdown spec={SPEC} factor={0.5} compact />)
    const compact = marks(container)
    expect(compact.some((c) => c?.includes('h-3.5'))).toBe(false)
    expect(compact).toEqual(expect.arrayContaining([expect.stringContaining('h-2.5')]))
    expect(compact).toEqual(expect.arrayContaining([expect.stringContaining('h-1.5')]))
  })

  it('keeps the title, the takeaway and the caption of the chart', () => {
    render(<ScaledBreakdown spec={SPEC} factor={1} />)
    expect(screen.getByText('Where that City tax goes, estimated')).toBeTruthy()
    expect(screen.getByText(/split like the operating budget/)).toBeTruthy()
    expect(screen.getByText('Mayor’s proposal, 2026')).toBeTruthy()
    expect(screen.getByRole('link', { name: /City budget/ })).toBeTruthy()
  })

  it('keeps the title for screen readers only when asked, with the takeaway still shown (#1144)', async () => {
    const squares = { ...SPEC, hideSquares: false, squareValue: 20 }
    const { container } = render(
      <ScaledBreakdown spec={squares} factor={1} title="screen-reader" />,
    )
    const title = screen.getByText('Where that City tax goes, estimated')
    expect(title.className).toContain('sr-only')
    expect(screen.getByText(/split like the operating budget/).closest('.sr-only')).toBeNull()
    // The drawing of squares is still named by the title
    expect(container.querySelector(`[aria-labelledby~="${title.id}"]`)).toBeTruthy()
    await expectAccessible(container)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<ScaledBreakdown spec={SPEC} factor={1} />)
    await expectAccessible(container)
  })

  it('sends the browser no chart library and no spec rules (zod)', () => {
    const SRC = join(__dirname, '..', '..', '..')
    const IMPORT = /(?:import|export)[^'"`;]*?from\s+['"]([^'"]+)['"]/g
    const files = new Set<string>()
    const packages = new Set<string>()
    const visit = (file: string) => {
      if (files.has(file)) return
      files.add(file)
      for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
        const specifier = match[1]
        if (!specifier || /^import type/.test(match[0])) continue
        const local = specifier.startsWith('.') || specifier.startsWith('@/')
        const base = specifier.startsWith('@/')
          ? join(SRC, specifier.slice(2))
          : resolve(dirname(file), specifier)
        const next = local
          ? [`${base}.tsx`, `${base}.ts`, join(base, 'index.ts')].find((c) => existsSync(c))
          : undefined
        if (next) visit(next)
        else if (!local) packages.add(specifier)
      }
    }
    visit(join(__dirname, 'ScaledBreakdown.tsx'))
    expect(
      [...packages].filter((name) => /^(@visx|d3|recharts|echarts|@nivo|zod)/.test(name)),
    ).toEqual([])
    expect(
      [...files].filter((file) => /lib\/chart\/spec\.ts$|chart\/adapters\/visx/.test(file)),
    ).toEqual([])
  })
})
