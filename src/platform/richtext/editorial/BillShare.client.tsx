'use client'

import React, { useState, type ReactNode } from 'react'

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
import { Button } from '@/platform/ui/Button'
import { ScaledBreakdown } from '@/platform/ui/chart/ScaledBreakdown'
import { Field } from '@/platform/ui/Field.client'
import { Link } from '@/platform/ui/Link'
import { ShareBar, ShareBarSwatch, type ShareBarSlice } from '@/platform/ui/ShareBar.client'
import { Text } from '@/platform/ui/Text'

import type { BillShareProps } from './billShare'
import { toCityBar } from './cityBar'

/** A slice's tone: the City highlighted, the others gray, the schools' the strongest */
const TONE: Record<BillBody, ShareBarSlice['tone']> = {
  schools: 'strong',
  city: 'highlight',
  county: 'medium',
  matc: 'light',
}

/** "A, B and C" */
const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

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
 * The whole property-tax bill at the top of a fact tab (#1018): a line saying what the estimate is
 * based on, a home value the reader can change (it starts at the City's average home), a switch
 * between tax years, what that home pays each body, and the bill as one bar whose slices are as
 * wide as their shares. The City's slice is joined to the panel under it, which starts with the
 * City's own tax as one bar, then a short line, then where that tax goes (#1020), then the rest of
 * the tab (`children`). The bar and the breakdown are drawn again for every home value and year, so
 * every amount in the panel is the City's slice of the bill above it. A year in which a body has
 * not set its rate uses that body's rate from the year before, and says so.
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
  if (!year) return null

  const text = typed ?? formatWholeDollars(year.averageHome)
  const homeValue = parseHomeValue(text)
  const { rates, filled } = fillFromEarlier(year.rates, years[yearIndex - 1]?.rates)
  const bill = homeValue === null ? null : computeBillShare(homeValue, rates)
  const part = (key: BillBody): BillPart | undefined => bill?.parts.find((p) => p.key === key)
  const earlier = years[yearIndex - 1]

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

  const slices: ShareBarSlice[] =
    bill?.complete === true
      ? bill.parts.map(({ key, share, percent }) => ({
          key,
          share: share ?? 0,
          tone: TONE[key],
          label: `${percent}%`,
        }))
      : []

  const picture = slices.length > 0
  const barLabel = picture
    ? `Your whole property tax bill: ${bill?.parts
        .map(({ key, percent }) => `${BILL_BODY_NAMES[key]} ${percent}%`)
        .join(', ')}`
    : ''

  return (
    <div className="space-y-4">
      <Text variant="small">{intro}</Text>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field
          label="Your home’s value"
          className="w-full sm:w-52"
          error={
            homeValue === null ? 'Enter your home’s value as a number, like $500,000.' : undefined
          }
        >
          <Field.Input
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(event) => {
              setTyped(event.target.value)
              setSettled(false)
            }}
            onBlur={() => setSettled(true)}
          />
        </Field>
        {years.length > 1 && (
          <div role="group" aria-label="Tax rates to use" className="flex flex-wrap gap-2">
            {years.map((option, index) => (
              <Button
                key={option.year}
                size="sm"
                variant={index === yearIndex ? 'primary' : 'secondary'}
                aria-pressed={index === yearIndex}
                onClick={() => {
                  setYearIndex(index)
                  setSettled(true)
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {bill && (
        <div className="space-y-1">
          <p role="status" className="sr-only">
            {settled ? summary : ''}
          </p>
          <Text variant="lead" className="text-foreground">
            {summary}
          </Text>
          {filled.length > 0 && earlier && (
            <Text variant="small">
              {joinNames(filled.map((key) => BILL_BODY_NAMES[key]))}{' '}
              {filled.length === 1 ? 'has' : 'have'} not set {year.year} rates yet, so this uses{' '}
              {earlier.year}’s for {filled.length === 1 ? 'it' : 'them'}.
            </Text>
          )}
          {!bill.complete && (
            <Text variant="small">
              {joinNames(bill.missing.map((key) => BILL_BODY_NAMES[key]))} have no rates to use, so
              the whole bill can’t be shown.
            </Text>
          )}
        </div>
      )}
      {picture && bill && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          {bill.parts.map(({ key, amount, percent }) => (
            <li key={key} className="flex items-start gap-2">
              <span className="mt-1.5">
                <ShareBarSwatch tone={TONE[key]} />
              </span>
              <span className="min-w-0">
                <span className="block text-foreground">{BILL_BODY_NAMES[key]}</span>
                <span className="block font-semibold text-foreground">
                  {formatWholeDollars(amount ?? 0)}
                </span>
                <span className="block text-muted-foreground">about {percent}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {picture ? (
        <ShareBar slices={slices} label={barLabel}>
          {panel}
        </ShareBar>
      ) : (
        panel
      )}
      <Text variant="small">
        An estimate, not your bill: it uses {year.year} rates and the value above, and your real
        bill depends on your home’s assessed value and any credits.
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
