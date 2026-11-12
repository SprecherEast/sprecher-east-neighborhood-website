import { computeBillShare, fillFromEarlier, type MillRates } from '@/platform/lib/billShare'
import { formatValue, formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'

import type { BillShareYear } from './billShare'
import { toCityBar } from './cityBar'
import type { FactTabPanelItem } from './factTabs'

type Stacked = Extract<ChartSpec, { kind: 'stacked' }>
type Breakdown = Extract<ChartSpec, { kind: 'breakdown' }>

/**
 * The City's extra tax a year and a month for the home and year shown (#1029): what an editor's
 * `{yearly}` and `{monthly}` stand for in a tab's figure and heading. Both come from the City bar's
 * own increase, so the button, the heading and the bar always agree.
 */
export type BillFigures = { yearly: string; monthly: string }

/** The editor's help on the placeholders, for the fields they work in (a tab's figure and heading) */
export const FIGURES_HELP =
  'In a tab with a whole tax bill, write {yearly} or {monthly} for the City’s extra tax in a year or a month on the home and year the reader chose.'

export const figuresFor = (increase: number): BillFigures => ({
  yearly: formatWholeDollars(increase),
  monthly: formatValue(Math.round((increase / 12) * 100) / 100, 'usd'),
})

/** The text with its placeholders written out; without figures (or placeholders) it is as written */
export function fillFigures(text: string, figures: BillFigures | undefined): string {
  if (!figures) return text
  return text.replaceAll('{yearly}', figures.yearly).replaceAll('{monthly}', figures.monthly)
}

/**
 * A tab's panel split at its whole tax bill (#1018): the bill, and, only with a bill, the City's
 * stacked chart and breakdown (drawn again for the home typed, #1020) and the pictures left over.
 */
export function splitBillPanel(panel: FactTabPanelItem[]) {
  const bill = panel.find(
    (item): item is Extract<FactTabPanelItem, { kind: 'billShare' }> => item.kind === 'billShare',
  )
  const pictures = panel.filter((item) => item.kind !== 'billShare')
  const chartOf = <K extends ChartSpec['kind']>(kind: K) =>
    pictures.find(
      (
        item,
      ): item is Extract<FactTabPanelItem, { kind: 'chart' }> & {
        spec: Extract<ChartSpec, { kind: K }>
      } => item.kind === 'chart' && item.spec.kind === kind,
    )
  const cityBars = bill ? chartOf('stacked') : undefined
  const cityBreakdown = bill ? chartOf('breakdown') : undefined
  return {
    bill,
    cityBars: cityBars?.spec as Stacked | undefined,
    cityBreakdown: cityBreakdown?.spec as Breakdown | undefined,
    rest: bill ? pictures.filter((item) => item !== cityBars && item !== cityBreakdown) : pictures,
    pictures,
  }
}

/**
 * The City's bar for a year and a home value, or null when the chart's columns are not these years
 * (it cannot say which year it shows). One place, so the panel and the tab's figures never differ.
 * `position` may be between two years, with `rates` blended to match, while a switch of year counts
 * (#1096); by default it is the year's own rates.
 */
export function cityBarFor(
  cityBars: Stacked | undefined,
  years: BillShareYear[],
  position: number,
  home: number,
  rates?: MillRates,
) {
  const yearIndex = Math.round(position)
  const year = years[yearIndex]
  if (!cityBars || !year || cityBars.x.length !== years.length) return null
  const used = rates ?? fillFromEarlier(year.rates, years[yearIndex - 1]?.rates).rates
  const cityAmount =
    computeBillShare(home, used)?.parts.find((p) => p.key === 'city')?.amount ?? null
  return toCityBar(cityBars, { column: position, cityAmount, homeRatio: home / year.averageHome })
}

/** The figures for the City's average home in the last year: what the server writes before any typing */
export function initialFigures(panel: FactTabPanelItem[]): BillFigures | undefined {
  const { bill, cityBars } = splitBillPanel(panel)
  const years = bill?.billShare.years ?? []
  const last = years.length - 1
  const bar = cityBarFor(cityBars, years, last, years[last]?.averageHome ?? 0)
  return bar ? figuresFor(bar.increase) : undefined
}
