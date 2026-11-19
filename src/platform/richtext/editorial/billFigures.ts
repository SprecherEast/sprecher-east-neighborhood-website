import { computeBillShare, fillFromEarlier, type MillRates } from '@/platform/lib/billShare'
import { formatValue, formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'

import type { BillShareYear } from './billShare'
import { toCityTax } from './cityTax'
import type { FactTabPanelItem } from './factTabs'

type Stacked = Extract<ChartSpec, { kind: 'stacked' }>
type Breakdown = Extract<ChartSpec, { kind: 'breakdown' }>

/**
 * The City's extra tax a year and a month for the home and year shown (#1029): what an editor's
 * `{yearly}` and `{monthly}` stand for in a tab's figure and heading. Both come from the City tax's
 * own increase (`cityTaxFor`), so the button, the heading and the answer card always agree.
 */
export type BillFigures = { yearly: string; monthly: string }

/** The editor's help on the placeholders, for the fields they work in (a tab's figure and heading) */
export const FIGURES_HELP =
  'In a tab with a whole tax bill, write {yearly} or {monthly} for the City’s extra tax in a year or a month on the home and year the reader chose.'

export const figuresFor = (increase: number): BillFigures => ({
  yearly: formatWholeDollars(increase),
  monthly: formatValue(Math.round((increase / 12) * 100) / 100, 'usd'),
})

/** The answer card's increase line, from the same figures as the placeholders (#1118) */
export function increaseLine(increase: number): string {
  if (increase === 0) return 'No increase'
  const { yearly, monthly } = figuresFor(increase)
  return `Up ${yearly} a year, about ${monthly} a month`
}

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

/** Each year's rates, with a rate a year has not set taken from the year before's (the bill's own rule) */
export const yearRatesOf = (years: readonly BillShareYear[]): MillRates[] =>
  years.map((each, index) => fillFromEarlier(each.rates, years[index - 1]?.rates).rates)

/**
 * The home's value in a year (#1121), from its value in the latest year (the value a reader types):
 * the earlier year's value is assumed to have changed as the average home did, so it is the typed
 * value times that year's average home over the latest year's. The same home is then priced in each
 * year at its own value, and the City's tax in the later year less the earlier year's is the
 * increase shown, for any home. A year or a latest year with no average home leaves the value as
 * typed.
 */
export function homeInYear(years: readonly BillShareYear[], index: number, valueNow: number) {
  const year = years[index]
  const now = years[years.length - 1]
  return year && now && year.averageHome > 0 && now.averageHome > 0
    ? valueNow * (year.averageHome / now.averageHome)
    : valueNow
}

/** The home's value at a position, between two years while a switch of year counts (#1096) */
export function homeAtPosition(
  years: readonly BillShareYear[],
  position: number,
  valueNow: number,
) {
  const first = Math.floor(position)
  const share = position - first
  const at = homeInYear(years, first, valueNow)
  return share === 0 ? at : at + (homeInYear(years, first + 1, valueNow) - at) * share
}

/** The City's tax in a year, for a home worth `valueNow` in the latest year; null without the City's rate */
function cityTaxIn(years: readonly BillShareYear[], index: number, valueNow: number) {
  const rates = yearRatesOf(years)[index]
  if (!rates) return null
  return (
    computeBillShare(homeInYear(years, index, valueNow), rates).parts.find((p) => p.key === 'city')
      ?.amount ?? null
  )
}

/**
 * What the City's tax rises by in a year, in whole dollars, for a home worth `valueNow` in the
 * latest year (#1121): the City's tax that year less the year before's, each as the
 * answer card shows it (rounded to the dollar), for the same home at each year's value
 * (`homeInYear`). It is the one definition of the increase: the answer card's line and the
 * tab's figure both take it from here, and switching years moves the City's tax by exactly this.
 * 0 for a year the chart shows no increase in (the first, say), never below 0, and null where the
 * data cannot support one: a year or the year before with no average home or no City rate.
 */
export function increaseIn(
  cityBars: Stacked,
  years: readonly BillShareYear[],
  index: number,
  valueNow: number,
): number | null {
  const stated = cityBars.series
    .filter((series) => series.increase)
    .reduce((sum, series) => sum + (series.values[index] ?? 0), 0)
  if (!(stated > 0)) return 0
  const [later, earlier, now] = [years[index], years[index - 1], years[years.length - 1]]
  if (!later || !earlier || !now) return null
  if (!(later.averageHome > 0 && earlier.averageHome > 0 && now.averageHome > 0)) return null
  const [laterTax, earlierTax] = [
    cityTaxIn(years, index, valueNow),
    cityTaxIn(years, index - 1, valueNow),
  ]
  if (laterTax === null || earlierTax === null) return null
  return Math.max(Math.round(laterTax) - Math.round(earlierTax), 0)
}

/**
 * The City's tax and its increase for a year and a home value, or null when the chart's columns are
 * not these years (it cannot say which year it shows). `valueNow` is the home's value in the
 * latest year, what the reader typed; it is priced in the year shown (`homeInYear`). One place, so
 * the panel and the tab's figures never differ. `position` may be between two years, with `rates` blended to match,
 * while a switch of year counts (#1096); by default it is the year's own rates.
 */
export function cityTaxFor(
  cityBars: Stacked | undefined,
  years: BillShareYear[],
  position: number,
  valueNow: number,
  rates?: MillRates,
) {
  const yearIndex = Math.round(position)
  const year = years[yearIndex]
  if (!cityBars || !year || cityBars.x.length !== years.length) return null
  const home = homeAtPosition(years, position, valueNow)
  const used = rates ?? yearRatesOf(years)[yearIndex] ?? {}
  const cityAmount =
    computeBillShare(home, used)?.parts.find((p) => p.key === 'city')?.amount ?? null
  // Between two years the increase counts from one year's to the other's, as the chart's column does
  const first = Math.floor(position)
  const share = position - first
  const from = increaseIn(cityBars, years, first, valueNow)
  const to = share === 0 ? from : increaseIn(cityBars, years, first + 1, valueNow)
  const increase =
    cityAmount === null || from === null || to === null ? null : from + (to - from) * share
  return toCityTax(cityBars, {
    column: position,
    cityAmount,
    increase,
    homeRatio: year.averageHome > 0 ? home / year.averageHome : 1,
  })
}

/** The figures for the City's average home in the last year: what the server writes before any typing */
export function initialFigures(panel: FactTabPanelItem[]): BillFigures | undefined {
  const { bill, cityBars } = splitBillPanel(panel)
  const years = bill?.billShare.years ?? []
  const last = years.length - 1
  const tax = cityTaxFor(cityBars, years, last, years[last]?.averageHome ?? 0)
  return tax && tax.increase !== null ? figuresFor(tax.increase) : undefined
}
