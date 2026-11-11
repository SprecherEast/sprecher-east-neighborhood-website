'use client'

import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import {
  BILL_BODY_NAMES,
  computeBillShare,
  fillFromEarlier,
  parseHomeValue,
} from '@/platform/lib/billShare'
import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import { AmountBar } from '@/platform/ui/AmountBar'
import { Card, CardTitle } from '@/platform/ui/Card'
import { ScaledBreakdown } from '@/platform/ui/chart/ScaledBreakdown'
import { Link } from '@/platform/ui/Link'
import { ShareBar } from '@/platform/ui/ShareBar.client'
import { SharePie } from '@/platform/ui/SharePie.client'
import { Text } from '@/platform/ui/Text'
import { COUNT_MS, YEAR_COUNT_MS, useCountedNumber } from '@/platform/ui/useCountedNumber.client'

import type { BillShareProps } from './billShare'
import { joinNames, reservedNote, ROUGH_NOTE, unconfirmedNote } from './billShareNotes'
import { receiptFor } from './billShareView'
import { shareBarFor } from './shareBarView'
import { cityBarFor, figuresFor } from './billFigures'
import { useReportFigures } from './BillFigures.client'
import { ratesAtPosition } from './rateBlend'
import { RoughEstimator } from './RoughEstimator'

/** The year's position is counted in whole numbers, so each year step is this many of them */
const YEAR_STEPS = 1000

/** What the City's panel holds besides the pictures a tab only draws once (#1020) */
export type CityPanelProps = {
  /** The tab this bill is in, so the tab's button and heading can follow it (#1029) */
  tabId?: string
  /** A chart of the City's tax by year: the panel starts with its column for the year shown, as one bar */
  cityBars?: Extract<ChartSpec, { kind: 'stacked' }>
  /** Where the City's tax goes, drawn again for whatever the City's tax is on the home typed */
  cityBreakdown?: Extract<ChartSpec, { kind: 'breakdown' }>
  /** The short line between the two */
  definition?: ReactNode
}

/**
 * The whole property-tax bill at the top of a fact tab (#1018, #1022): two cards of one height, side
 * by side from `lg` and stacked below it, with the same bill under them as a bar whose City slice
 * joins the City's panel (#1030). The Rough Estimator holds the home value the reader can
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
  tabId,
  cityBars,
  cityBreakdown,
  definition,
  children,
}: BillShareProps & CityPanelProps & { children?: ReactNode }) {
  const [yearIndex, setYearIndex] = useState(Math.max(years.length - 1, 0))
  const year = years[yearIndex]
  // What the reader typed, or null while the box still shows the City's average for the year
  const [typed, setTyped] = useState<string | null>(null)
  // The value last estimated, or null while the numbers are for the City's average home
  const [estimated, setEstimated] = useState<number | null>(null)
  const pieTitleId = useId()
  const target = estimated ?? year?.averageHome ?? 0
  // Counts up each time a new bill has finished counting, so the total can flash once
  const [pulse, setPulse] = useState(0)
  const lastBill = useRef<string | null>(null)
  // Every number below counts to a new value, so a change is seen, not just found
  // (a new home value takes the long count, a switch of year the short one, #1087)
  const [countMs, setCountMs] = useState(COUNT_MS)
  const shown = useCountedNumber(target, { durationMs: countMs })
  // The year counts too: the rates move from the old year's to the new one's, so the amounts follow
  const yearPosition = useCountedNumber(yearIndex * YEAR_STEPS, { durationMs: YEAR_COUNT_MS })
  // Once the count has ended on a bill that differs from the last one, the total flashes once
  const billKey = `${yearIndex}:${target}`
  const settled = shown === target && yearPosition === yearIndex * YEAR_STEPS
  useEffect(() => {
    if (!settled) return
    if (lastBill.current !== null && lastBill.current !== billKey) setPulse((count) => count + 1)
    lastBill.current = billKey
  }, [settled, billKey])
  const yearRates = years.map(
    (each, index) => fillFromEarlier(each.rates, years[index - 1]?.rates).rates,
  )
  const rates = ratesAtPosition(yearRates, yearPosition / YEAR_STEPS)
  // The City's bar counts with the pie: the year between two years, the home value as it counts (#1096)
  const cityBar = cityBarFor(cityBars, years, yearPosition / YEAR_STEPS, shown, rates)
  // The tab's button and heading count with it
  useReportFigures(tabId, cityBar ? figuresFor(cityBar.increase) : undefined)
  if (!year) return null

  const text = typed ?? formatWholeDollars(year.averageHome)
  const homeValue = parseHomeValue(text)
  const bill = computeBillShare(shown, rates)
  const receipt = receiptFor(bill, shown)
  const shareBar = shareBarFor(receipt.slices)
  // What a screen reader hears: the bill for the value estimated, not each step of the count
  const summary = receiptFor(computeBillShare(target, yearRates[yearIndex] ?? {}), target).summary

  // Estimating changes the numbers in the card above the box, which counts them to the new bill
  // (a reader who asked for less motion gets them at once); the page never scrolls (#1068)
  const estimate = () => {
    if (homeValue === null) return
    setCountMs(COUNT_MS)
    setEstimated(homeValue)
  }
  // Choosing a year moves the amounts to its rates in half a second
  const selectYear = (index: number) => {
    setCountMs(YEAR_COUNT_MS)
    setYearIndex(index)
  }

  // The City's panel follows the home typed (the average home while the box holds no number)
  const home = shown
  const cityAmount =
    (bill ?? computeBillShare(home, rates)).parts.find((p) => p.key === 'city')?.amount ?? null
  const homeRatio = home / year.averageHome
  const breakdownTotal = cityBreakdown?.areas.reduce((sum, area) => sum + area.value, 0) ?? 0
  const breakdownFactor =
    cityAmount !== null && breakdownTotal > 0 ? cityAmount / breakdownTotal : homeRatio
  const panel = (
    <div className="space-y-6">
      {cityBar && <AmountBar title={cityBar.title} total={cityBar.total} parts={cityBar.parts} />}
      {cityBreakdown && (
        <div className="rounded-xl bg-surface p-4">
          <ScaledBreakdown spec={cityBreakdown} factor={breakdownFactor} />
        </div>
      )}
      {definition}
      {children}
    </div>
  )

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
        <Card as="section" variant="elevated" aria-labelledby={pieTitleId} className="h-full">
          <div className="space-y-3">
            <CardTitle as="h3" className="text-xl">
              <span id={pieTitleId}>Your rough property tax</span>
            </CardTitle>
            <p role="status" className="sr-only">
              {summary}
            </p>
            {receipt.slices.length > 0 ? (
              <SharePie
                slices={receipt.slices}
                label={receipt.label}
                heading={receipt.heading}
                total={receipt.total ?? undefined}
                pulseKey={pulse}
              />
            ) : (
              <Text variant="small" className="py-16 text-center">
                The whole bill can’t be shown yet.
              </Text>
            )}
          </div>
        </Card>
        <RoughEstimator
          intro={intro}
          value={text}
          onValueChange={setTyped}
          canEstimate={homeValue !== null && homeValue !== target}
          onEstimate={estimate}
          error={
            homeValue === null ? 'Enter your home’s value as a number, like $500,000.' : undefined
          }
          options={years.map((option) => ({
            key: String(option.year),
            label: option.label,
            note: option.note,
          }))}
          selected={yearIndex}
          onSelect={selectYear}
          notes={notes}
        />
      </div>
      {shareBar.slices.length > 0 ? (
        <ShareBar slices={shareBar.slices} label={shareBar.label}>
          {panel}
        </ShareBar>
      ) : (
        <Card variant="elevated" padding="sm" className="sm:p-6">
          {panel}
        </Card>
      )}
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
