import { screen } from '@testing-library/react'

import type { ChartSpec } from '@/platform/lib/chart/spec'

import type { BillShareProps } from './billShare'

export const PROPS: BillShareProps = {
  intro: 'Based on the City’s average home. Change the value to see yours.',
  years: [
    {
      year: 2026,
      label: '2026 rates',
      note: '',
      averageHome: 481300,
      rates: { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 },
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

export const box = () => screen.getByRole('textbox', { name: /home’s value/i }) as HTMLInputElement
