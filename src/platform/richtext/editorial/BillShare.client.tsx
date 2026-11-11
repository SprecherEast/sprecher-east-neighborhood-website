'use client'

import React, { useId, useState, type ReactNode } from 'react'

import {
  BILL_BODY_NAMES,
  computeBillShare,
  fillFromEarlier,
  parseHomeValue,
  type BillBody,
  type BillPart,
} from '@/platform/lib/billShare'
import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import { AmountBar } from '@/platform/ui/AmountBar'
import { Card, CardTitle } from '@/platform/ui/Card'
import { ScaledBreakdown } from '@/platform/ui/chart/ScaledBreakdown'
import { Link } from '@/platform/ui/Link'
import { SharePie, type SharePieSlice } from '@/platform/ui/SharePie.client'
import { Text } from '@/platform/ui/Text'

import type { BillShareProps } from './billShare'
import { joinNames, reservedNote, ROUGH_NOTE, unconfirmedNote } from './billShareNotes'
import { toCityBar } from './cityBar'
import { RoughEstimator } from './RoughEstimator'

/** A wedge's tone: the City highlighted, the others three grays, the schools' the lightest */
const TONE: Record<BillBody, SharePieSlice['tone']> = {
  schools: 'light',
  city: 'highlight',
  county: 'medium',
  matc: 'dark',
}

/** What the City's panel holds besides the pictures a tab only draws once (#1020) */
export type CityPanelProps = {
  /** A chart of the City's tax by year: the panel starts with its column for the year shown, as one bar */
  cityBars?: Extract<ChartSpec, { kind: 'stacked' }>
  /** Where the City's tax goes, drawn again for whatever the City's tax is on the home typed */
  cityBreakdown?: Extract<ChartSpec, { kind: 'breakdown' }>
  /** The short line between the two */
  definition?: ReactNode
}

/**
 * The whole property-tax bill at the top of a fact tab (#1018, #1022): two cards of one height, side
 * by side from `lg` and stacked below it. The Rough Estimator holds the home value the reader can
 * change (it starts at the City's average home), the switch between tax years and the notes on how
 * rough the answer is; the other is the bill as a pie whose wedges are as big as their shares. The
 * City's panel sits under both: the City's own tax as one bar, a short line, then where that tax
 * goes (#1020), then the rest of the tab (`children`). The pie, the bar and the breakdown are drawn
 * again for every home value and year, so every amount in the panel is the City's slice of the
 * bill. A year in which a body has not set its rate uses that body's rate from the year before,
 * and says so in a note whose room is always kept, so the page never changes height.
 */
export function BillShare({
  intro,
  years,
  cityBars,
  cityBreakdown,
  definition,
  children,
}: BillShareProps & CityPanelProps & { children?: ReactNode }) {
  const [yearIndex, setYearIndex] = useState(Math.max(years.length - 1, 0))
  const year = years[yearIndex]
  // What the reader typed, or null while the box still shows the City's average for the year
  const [typed, setTyped] = useState<string | null>(null)
  // A screen reader hears the bill when the reader leaves the box or switches year, not on every key
  const [settled, setSettled] = useState(true)
  const pieTitleId = useId()
  if (!year) return null

  const text = typed ?? formatWholeDollars(year.averageHome)
  const homeValue = parseHomeValue(text)
  const { rates } = fillFromEarlier(year.rates, years[yearIndex - 1]?.rates)
  const bill = homeValue === null ? null : computeBillShare(homeValue, rates)
  const part = (key: BillBody): BillPart | undefined => bill?.parts.find((p) => p.key === key)
  const summary = !bill
    ? ''
    : bill.complete && bill.total !== null
      ? `If your home is worth ${formatWholeDollars(homeValue ?? 0)}, your whole bill is about ${formatWholeDollars(bill.total)}.`
      : `The City’s part of a ${formatWholeDollars(homeValue ?? 0)} home’s bill would be about ${formatWholeDollars(part('city')?.amount ?? 0)}.`

  // The City's panel follows the home typed (the average home while the box holds no number)
  const home = homeValue ?? year.averageHome
  const cityAmount =
    (bill ?? computeBillShare(home, rates)).parts.find((p) => p.key === 'city')?.amount ?? null
  const homeRatio = home / year.averageHome
  const breakdownTotal = cityBreakdown?.areas.reduce((sum, area) => sum + area.value, 0) ?? 0
  const breakdownFactor =
    cityAmount !== null && breakdownTotal > 0 ? cityAmount / breakdownTotal : homeRatio
  // A chart whose columns are not these years cannot say which year it shows, so it draws no bar
  const cityBar =
    cityBars && cityBars.x.length === years.length
      ? toCityBar(cityBars, { column: yearIndex, cityAmount, homeRatio })
      : null
  const panel = (
    <div className="space-y-6">
      {cityBar && <AmountBar title={cityBar.title} total={cityBar.total} parts={cityBar.parts} />}
      {definition}
      {cityBreakdown && (
        <div className="rounded-xl bg-surface p-4">
          <ScaledBreakdown spec={cityBreakdown} factor={breakdownFactor} />
        </div>
      )}
      {children}
    </div>
  )

  const slices: SharePieSlice[] =
    bill?.complete === true
      ? bill.parts.map(({ key, amount, share, percent }) => ({
          key,
          name: BILL_BODY_NAMES[key],
          amount: formatWholeDollars(amount ?? 0),
          percent: percent ?? 0,
          share: share ?? 0,
          tone: TONE[key],
        }))
      : []
  const pieLabel =
    slices.length > 0
      ? `Your rough property tax: ${slices.map((slice) => `${slice.name} ${slice.amount}, ${slice.percent}%`).join('; ')}`
      : ''

  // The notes always take their room, so a year with none to show never makes the card shorter
  const kept = reservedNote(years)
  const shownNote = unconfirmedNote(years, yearIndex)
  const notes = [
    { key: 'rough', text: ROUGH_NOTE, shown: true },
    ...(kept ? [{ key: 'unconfirmed', text: shownNote ?? kept, shown: shownNote !== null }] : []),
    ...(bill && !bill.complete
      ? [
          {
            key: 'missing',
            text: `${joinNames(bill.missing.map((key) => BILL_BODY_NAMES[key]))} have no rates to use, so the whole bill can’t be shown.`,
            shown: true,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <RoughEstimator
          intro={intro}
          value={text}
          onValueChange={(value) => {
            setTyped(value)
            setSettled(false)
          }}
          onValueBlur={() => setSettled(true)}
          error={
            homeValue === null ? 'Enter your home’s value as a number, like $500,000.' : undefined
          }
          options={years.map((option) => ({ key: String(option.year), label: option.label }))}
          selected={yearIndex}
          onSelect={(index) => {
            setYearIndex(index)
            setSettled(true)
          }}
          notes={notes}
        />
        <Card as="section" variant="elevated" aria-labelledby={pieTitleId} className="h-full">
          <div className="space-y-3">
            <CardTitle as="h3" className="text-xl">
              <span id={pieTitleId}>Your rough property tax</span>
            </CardTitle>
            <p role="status" className="sr-only">
              {bill && settled ? summary : ''}
            </p>
            {bill && (
              <Text
                variant="lead"
                aria-hidden="true"
                className="min-h-21 text-foreground sm:min-h-14"
              >
                {summary}
              </Text>
            )}
            {slices.length > 0 ? (
              <SharePie slices={slices} label={pieLabel} />
            ) : (
              <Text variant="small" className="py-16 text-center">
                Enter your home’s value to see how the bill splits.
              </Text>
            )}
          </div>
        </Card>
      </div>
      <Card variant="elevated" padding="sm" className="sm:p-6">
        {panel}
      </Card>
      <Text variant="small">
        Uses {year.year} rates.
        {year.source && (
          <>
            {' '}
            Source:{' '}
            <Link href={year.source.href} external={year.source.external}>
              {year.source.label}
            </Link>
          </>
        )}
      </Text>
    </div>
  )
}
