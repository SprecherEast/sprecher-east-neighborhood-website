import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { toChartPoints } from '@/platform/lib/chart/table'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { ChartAdapter } from './chartAdapter'
import { Chart } from './Chart'
import { CHART_PALETTE } from './chartPalette'

type ContractOptions = {
  /** How many `[data-chart-mark]` elements the adapter draws for a spec (a datum, or a cell) */
  markCount: (spec: ChartSpec) => number
}

const PALETTE_CLASSES = new Set(CHART_PALETTE.flatMap(({ bg, fill, stroke }) => [bg, fill, stroke]))
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|oklab)\(/i
const RAW_PALETTE_CLASS =
  /^(bg|text|fill|stroke|border|ring)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black)(-\d+)?$/

/** Marks that have a chart colour and also hold text. Reads the class attribute, since an svg mark's `className` is not a string. */
export function coloursWithText(root: ParentNode) {
  return [...root.querySelectorAll('[data-chart-mark]')].filter(
    (mark) =>
      /-chart-\d+\b/.test(mark.getAttribute('class') ?? '') &&
      (mark.textContent?.trim() ?? '') !== '',
  )
}

/**
 * The suite every chart adapter must pass before the registry may use it (#639): it proves a
 * library can be swapped without a page noticing. For one fixture of each kind the adapter
 * supports, it checks, through `react-dom/server`, that the markup:
 *  - draws one mark per datum or cell, in the server's HTML (not only in a browser);
 *  - has no `style` attribute and no colour literal, and uses only palette classes for colour;
 *  - gives every label and value as real text;
 *  - names any `img` it draws by ids that exist, and passes axe;
 *  - for `svg` output, scales with its container (a `viewBox`, no fixed size) and puts no text
 *    inside a mark.
 */
export function describeChartAdapter(adapter: ChartAdapter, { markCount }: ContractOptions) {
  const fixtures = Object.entries(FIXTURES).filter(([, spec]) => adapter.kinds.has(spec.kind))

  describe(`chart adapter contract: ${adapter.name}`, () => {
    it('supports at least one kind, and the fixtures cover each kind it supports', () => {
      for (const kind of adapter.kinds) {
        expect(fixtures.some(([, spec]) => spec.kind === kind)).toBe(true)
      }
    })

    describe.each(fixtures)('%s', (_name, fixture) => {
      const spec = parseChartSpec(fixture)
      const markup = renderToStaticMarkup(<Chart spec={spec} adapter={adapter} />)
      const document = new DOMParser().parseFromString(markup, 'text/html')
      const drawing = (root: ParentNode) => [...root.querySelectorAll('[data-chart-mark]')]

      it('draws one mark per datum or cell in the server markup', () => {
        expect(drawing(document)).toHaveLength(markCount(spec))
      })

      it('has no style attribute and no colour literal', () => {
        expect(document.querySelectorAll('[style]')).toHaveLength(0)
        expect(markup).not.toMatch(COLOUR_LITERAL)
      })

      it('colours only with palette classes', () => {
        const classes = [...document.querySelectorAll('[class]')].flatMap((el) => [...el.classList])
        expect(classes.filter((name) => RAW_PALETTE_CLASS.test(name))).toEqual([])
        const chartColours = classes.filter((name) => /-chart-\d+$/.test(name))
        expect(chartColours.filter((name) => !PALETTE_CLASSES.has(name))).toEqual([])
      })

      it('gives every label and value as text, and puts no text on a coloured mark', () => {
        const text = document.body.textContent ?? ''
        for (const point of toChartPoints(spec)) {
          expect(text).toContain(point.label)
          expect(text).toContain(point.text)
        }
        expect(coloursWithText(document)).toEqual([])
      })

      it('names any img it draws by ids that exist, and draws an svg as an img', () => {
        const images = [...document.querySelectorAll('[role="img"]')]
        for (const image of images) {
          const ids = image.getAttribute('aria-labelledby')?.split(' ') ?? []
          expect(ids).toHaveLength(2)
          for (const id of ids)
            expect(document.getElementById(id)?.textContent?.trim()).toBeTruthy()
        }
        if (adapter.output === 'svg') {
          const svg = document.querySelector('svg[role="img"]')
          expect(svg?.getAttribute('aria-labelledby')).toBeTruthy()
        }
      })

      if (adapter.output === 'svg') {
        it('scales with its container and keeps every text element off the marks', () => {
          const svg = document.querySelector('svg[role="img"]')
          expect(svg?.getAttribute('viewBox')).toBeTruthy()
          expect(svg?.hasAttribute('width') || svg?.hasAttribute('height')).toBe(false)
          expect(document.querySelectorAll('svg text').length).toBeGreaterThan(0)
          for (const mark of drawing(document)) {
            expect(mark.closest('text'), 'a mark inside a text element').toBeNull()
            expect(mark.querySelector('text, tspan'), 'text inside a mark').toBeNull()
          }
        })
      }

      it('passes axe', async () => {
        const container = window.document.createElement('div')
        container.innerHTML = markup
        window.document.body.append(container)
        await expectAccessible(container)
        container.remove()
      })
    })
  })
}
