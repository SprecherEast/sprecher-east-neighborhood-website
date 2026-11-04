import type { ChartUnit } from './spec'

const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const WHOLE_MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const SHORT_MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** The column heading for a unit in the data table */
export const UNIT_HEADERS: Record<ChartUnit, string> = {
  usd: 'Amount (US dollars)',
  percent: 'Share (percent)',
  mills: 'Rate (mills)',
  count: 'Count',
}

/**
 * A value as the reader sees it, per unit. Dollars print whole when they are whole ($194,768,276)
 * and with cents otherwise ($7.50); `compact` writes big dollars short ($194.8M) for a legend.
 */
export function formatValue(value: number, unit: ChartUnit, options?: { compact?: boolean }) {
  switch (unit) {
    case 'usd':
      if (options?.compact && value >= 1_000_000) return SHORT_MONEY.format(value)
      return (Number.isInteger(value) ? WHOLE_MONEY : MONEY).format(value)
    case 'percent':
      return `${NUMBER.format(value)}%`
    case 'mills':
      return `${NUMBER.format(value)} ${value === 1 ? 'mill' : 'mills'}`
    case 'count':
      return NUMBER.format(value)
  }
}
