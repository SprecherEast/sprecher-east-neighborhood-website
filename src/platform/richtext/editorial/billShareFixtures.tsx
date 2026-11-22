import { act, fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'

import type { ChartSpec } from '@/platform/lib/chart/spec'

import { toBillShareProps, type BillShareProps } from './billShare'

/** The title and notes a block that holds none of its own gets */
const { rows, notes, rates, toasts } = toBillShareProps({})

export const PROPS: BillShareProps = {
  rows,
  notes,
  rates,
  toasts,
  intro: 'Based on the City’s average home. Change the value to see yours.',
  years: [
    {
      year: 2026,
      label: '2026 rates',
      note: '',
      averageHome: 481300,
      rates: { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0141 },
      source: {
        label: 'City tax detail',
        href: 'https://example.org/tax',
        external: true,
        appearance: 'default',
      },
    },
    {
      year: 2027,
      label: '2027 rates',
      note: 'proposed',
      averageHome: 500300,
      rates: { city: 6.93 },
      source: null,
    },
  ],
}

export const BARS: Extract<ChartSpec, { kind: 'stacked' }> = {
  kind: 'stacked',
  title: 'City tax on an average home',
  summary: 'Up $90.',
  unit: 'usd',
  orientation: 'horizontal',
  x: ['2026 adopted', '2027 proposed'],
  series: [
    { key: 'same', label: 'Same as 2026', values: [3375.89, 3375.89] },
    {
      key: 'more',
      label: 'Proposed increase',
      pattern: 'hatch',
      increase: true,
      values: [0, 90.04],
    },
  ],
}

export const BREAKDOWN: Extract<ChartSpec, { kind: 'breakdown' }> = {
  kind: 'breakdown',
  title: 'Where that City tax goes, estimated',
  summary: 'Our estimate.',
  unit: 'usd',
  hideSquares: true,
  areas: [
    { key: 'safety', label: 'Public safety', value: 1500 },
    { key: 'other', label: 'Everything else', value: 1500 },
  ],
}

export const city = { cityBars: BARS, cityBreakdown: BREAKDOWN, definition: <p>Short line</p> }

/** The rates panel's name, which follows the year shown: "2027 city rate" or "2026 rates" (#1417) */
export const RATES_PANEL = /^\d{4} (city rate|rates)$/

export const box = () =>
  screen.getByRole('textbox', { name: 'Enter your assessed value' }) as HTMLInputElement

/** Types a home value and presses Estimate, then lets the scroll and the count settle */
export async function estimate(value: string) {
  fireEvent.change(box(), { target: { value } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
  })
}

/** The sentence a screen reader hears for the bill: the block's own status line, not a toast's announcement */
export const billSummary = () =>
  screen.getAllByRole('status').find((element) => element.tagName === 'P') as HTMLElement

/** A stand-in for the browser's view detection: tests decide when the panel comes into view */
export function stubView() {
  const watching: ((entries: IntersectionObserverEntry[]) => void)[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private callback: IntersectionObserverCallback
      private watch = (entries: IntersectionObserverEntry[]) =>
        this.callback(entries, this as unknown as IntersectionObserver)
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }
      observe() {
        watching.push(this.watch)
      }
      disconnect() {
        const at = watching.indexOf(this.watch)
        if (at >= 0) watching.splice(at, 1)
      }
    },
  )
  return {
    watching: () => watching.length,
    enter: () =>
      act(async () => {
        for (const watch of [...watching])
          watch([{ isIntersecting: true } as IntersectionObserverEntry])
      }),
  }
}
