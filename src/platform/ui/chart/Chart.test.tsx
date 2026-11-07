// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import { CHART_LARGE_WIDTH, CHART_SMALL_WIDTH } from '@/platform/ui/layoutSizes'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { textAdapter } from './adapters/text/textAdapter'
import { Chart } from './Chart'

afterEach(cleanup)

describe('Chart', () => {
  it('shows the title, the takeaway, the drawing, the key and the caption, in that order', () => {
    const { container } = render(<Chart spec={FIXTURES.paysFor} />)
    const figure = screen.getByRole('figure')
    const kids = [...figure.children].map((el) => el.tagName + (el.getAttribute('role') ?? ''))
    // title block, hidden description, the img, the key, the figcaption (last, as HTML requires)
    expect(kids).toEqual(['DIV', 'P', 'DIV', 'DIV', 'FIGCAPTION'])
    expect(within(figure).getByRole('img')).toBeTruthy()
    expect(within(figure).getByText(FIXTURES.paysFor.title)).toBeTruthy()
    expect(within(figure).getByText(FIXTURES.paysFor.summary)).toBeTruthy()
    expect(container.querySelectorAll('[data-legend-swatch]')).toHaveLength(6)
  })

  it('marks the chart that asks for the warm colours, and no other (#856)', () => {
    const warm = render(<Chart spec={{ ...FIXTURES.paysFor, palette: 'warm' }} />)
    expect(warm.container.querySelector('[data-chart-palette="warm"]')).not.toBeNull()
    cleanup()
    const usual = render(<Chart spec={FIXTURES.paysFor} />)
    expect(usual.container.querySelector('[data-chart-palette]')).toBeNull()
  })

  it('names the figure’s drawing by its title and its description', () => {
    render(<Chart spec={FIXTURES.paysFor} />)
    const image = screen.getByRole('img', { name: /What the money pays for, proposed/ })
    expect(image.getAttribute('aria-labelledby')?.split(' ')).toHaveLength(2)
    expect(image.getAttribute('aria-labelledby')).toContain('description')
  })

  it('says what a square means, when, from where and how sure, as real text', () => {
    render(<Chart spec={FIXTURES.paysFor} />)
    const caption = screen.getByRole('figure').querySelector('figcaption') as HTMLElement
    expect(caption.textContent).toContain('Each square is $1 of every $100')
    expect(caption.textContent).toContain("Mayor's proposal, October 2026")
    expect(caption.textContent).toContain('Confirmed')
    expect(caption.textContent).toContain('not the budget the Council adopts')
    const link = within(caption).getByRole('link')
    expect(link.getAttribute('href')).toContain('cleardocs')
  })

  it('keeps the numbers in a closed "Show the numbers" box with a real table', () => {
    const { container } = render(<Chart spec={FIXTURES.paysFor} />)
    const details = container.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')?.textContent).toBe('Show the numbers')
    expect(within(details).getByRole('table', { hidden: true })).toBeTruthy()
  })

  it('shares one key between two grids of the same parts, with each grid’s squares', () => {
    render(<Chart spec={FIXTURES.paysFor} />)
    const key = screen.getByRole('list', { name: 'Chart key' })
    expect(within(key).getAllByRole('listitem')[0].textContent).toContain(
      'Of every $100: 41 in 2026 adopted, 41 in 2027 proposed',
    )
  })

  it('draws with the text adapter when it is chosen, with no colour key', () => {
    const { container } = render(<Chart spec={FIXTURES.borrowed} adapter={textAdapter} />)
    expect(container.querySelector('[role="img"]')).toBeNull()
    expect(container.querySelectorAll('[data-legend-swatch]')).toHaveLength(0)
    expect(screen.getAllByText('$171,688,393', { exact: false }).length).toBeGreaterThan(0)
  })

  it('refuses a chart that does not add up, with the reason', () => {
    const bad = structuredClone(FIXTURES.comesIn) as ChartSpec & { groups: { total: number }[] }
    bad.groups[0].total = 1
    expect(() => render(<Chart spec={bad} />)).toThrow(/total/)
  })

  it.each(Object.entries(FIXTURES))('passes axe: %s', async (_name, spec) => {
    const { container } = render(<Chart spec={spec} />)
    await expectAccessible(container)
  })

  describe('enlarging (#681)', () => {
    const enlarge = (title: string) =>
      screen.queryByRole('button', { name: `Enlarge chart: ${title}` })
    const spec = FIXTURES.bars

    it.each([
      ['bars (svg)', FIXTURES.bars],
      ['squares (html)', FIXTURES.paysFor],
    ])('puts an Enlarge button on %s by default', (_name, chart) => {
      render(<Chart spec={chart} />)
      expect(enlarge(chart.title)).toBeTruthy()
    })

    it('has no Enlarge button for the text adapter or with zoom off', () => {
      const { unmount } = render(<Chart spec={spec} adapter={textAdapter} />)
      expect(enlarge(spec.title)).toBeNull()
      unmount()
      render(<Chart spec={spec} zoom={false} />)
      expect(enlarge(spec.title)).toBeNull()
    })

    it('gives the drawing the small width and marks it as the click target', () => {
      const { container } = render(<Chart spec={spec} />)
      const drawing = container.querySelector('[data-chart-drawing]') as HTMLElement
      expect(drawing.className).toContain('max-w-[var(--chart-small-width)]')
      expect(drawing.querySelector('svg[role="img"]')).toBeTruthy()
    })

    it('draws the dialog’s chart at the large width and stacked, the page’s at the small one', async () => {
      const { container } = render(<Chart spec={spec} />)
      const classesOf = (root: ParentNode) =>
        [...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '')
      const has = (root: ParentNode, token: string) =>
        classesOf(root).some((classes) => classes.split(' ').includes(token))
      const [largeToken] = CHART_LARGE_WIDTH.split(' ')
      expect(has(container, CHART_SMALL_WIDTH)).toBe(true)
      expect(has(container, largeToken)).toBe(false)

      await userEvent.click(enlarge(spec.title) as HTMLElement)
      const dialog = screen.getByRole('dialog', { name: spec.title })
      expect(has(dialog, largeToken)).toBe(true)
      // It stacks because the dialog's box (the large width) is narrower than the 42rem (`@2xl`)
      // container query that puts the text beside the drawing
      expect(classesOf(dialog).join(' ')).toContain('@2xl/chart:grid-cols-')
      const css = readFileSync(join(__dirname, '../../../app/(frontend)/globals.css'), 'utf8')
      const large = /--chart-large-width:\s*([\d.]+)rem/.exec(css)
      expect(Number(large?.[1])).toBeLessThan(42)
    })

    it('keeps a box of the chart’s height in the page while it is open, and clears it after', async () => {
      const { container } = render(<Chart spec={spec} />)
      const holder = container.querySelector('[data-zoom-holder]') as HTMLElement
      await userEvent.click(enlarge(spec.title) as HTMLElement)
      expect(holder.style.height).toMatch(/px$/)
      await userEvent.keyboard('{Escape}')
      expect(holder.style.height).toBe('')
    })

    it('sets no small width on the text adapter’s words', () => {
      const { container } = render(<Chart spec={spec} adapter={textAdapter} />)
      expect(container.querySelector(`[class~="${CHART_SMALL_WIDTH}"]`)).toBeNull()
    })

    it('keeps one drawing, one table and unique ids when enlarged, all real text', async () => {
      render(<Chart spec={spec} />)
      await userEvent.click(enlarge(spec.title) as HTMLElement)

      const dialog = screen.getByRole('dialog', { name: spec.title })
      expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(1)
      expect(document.querySelectorAll('table')).toHaveLength(1)
      expect(within(dialog).getByText('Show the numbers')).toBeTruthy()
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
      // No picture of any kind: shapes and text only
      expect(dialog.querySelectorAll('img, canvas, picture, [style]')).toHaveLength(0)
      expect(dialog.querySelectorAll('svg text').length).toBeGreaterThan(0)
      expect(dialog.innerHTML).not.toMatch(/background-image|url\(data:/)
      await expectAccessible(document.body)
    })

    it('draws two charts on one page with their own ids', () => {
      render(
        <>
          <Chart spec={FIXTURES.bars} />
          <Chart spec={FIXTURES.operating} />
        </>,
      )
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
