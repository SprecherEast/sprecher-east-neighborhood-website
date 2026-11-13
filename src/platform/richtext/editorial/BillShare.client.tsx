'use client'

import React, { useEffect, useRef, useState, type ReactNode } from 'react'

import { BILL_BODY_NAMES, computeBillShare, parseHomeValue } from '@/platform/lib/billShare'
import type { ResolvedLink } from '@/platform/lib'
import type { Certainty } from '@/platform/lib/certainty'
import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import { AmountBar } from '@/platform/ui/AmountBar'
import { Card } from '@/platform/ui/Card'
import { ScaledBreakdown } from '@/platform/ui/chart/ScaledBreakdown'
import { ShareBill } from '@/platform/ui/ShareBill'
import { Text } from '@/platform/ui/Text'
import { COUNT_MS, YEAR_COUNT_MS, useCountedNumber } from '@/platform/ui/useCountedNumber.client'

import type { BillShareProps } from './billShare'
import { BillAnswer } from './BillAnswer'
import { BillDetails } from './BillDetails'
import {
  assumedNote,
  joinNames,
  reservedNote,
  ROUGH_NOTE,
  uniqueSources,
  unconfirmedNote,
} from './billShareNotes'
import { receiptFor } from './billShareView'
import {
  cityBarFor,
  figuresFor,
  homeAtPosition,
  homeInYear,
  increaseIn,
  yearRatesOf,
} from './billFigures'
import { useReportFigures } from './BillFigures.client'
import { ratesAtPosition } from './rateBlend'
import { RoughEstimator } from './RoughEstimator'

/** The year's position is counted in whole numbers, so each year step is this many of them */
const YEAR_STEPS = 1000

/** What the tab adds around the whole bill (#1020, #1111): the City's charts and the tab's own parts */
export type CityPanelProps = {
  /** The tab this bill is in, so the tab's button and heading can follow it (#1029) */
  tabId?: string
  /** A chart of the City's tax by year: its column for the year shown, as one bar, in the first row */
  cityBars?: Extract<ChartSpec, { kind: 'stacked' }>
  /** Where the City's tax goes, drawn again for whatever the City's tax is on the home typed */
  cityBreakdown?: Extract<ChartSpec, { kind: 'breakdown' }>
  /** The tab's short text, in the row on how the estimate works */
  definition?: ReactNode
  /** The tab's explanation, after the short text */
  detail?: ReactNode
  /** How sure we are about the tab's fact: the answer card's one badge */
  certainty?: Certainty
  /** The tab's own source; the sources row lists it once beside the year's */
  source?: ResolvedLink | null
}

/**
 * The whole property-tax bill at the top of a fact tab (#1018, #1111), one column on every width,
 * in the order a neighbor needs it: the bill block's one intro line, the Rough Estimator (the home
 * value the reader can change, which starts at the City's average home, and the switch between tax
 * years), the answer card (the City's tax on the home and year, its increase, the year's status), the
 * whole bill (its own card: the total, one bar whose slices are as wide as their shares, and the receipt
 * naming each), then one card of three closed rows: where the City's share goes, how the estimate works and the
 * sources. The tab's other pictures (`children`) follow. Everything is drawn again for every home
 * value and year, so every amount is the City's slice of the bill. A year in which a body has not
 * set its rate uses that body's rate from the year before, and says so in a note whose room is
 * always kept, so the page never changes height.
 */
export function BillShare({
  intro,
  years,
  tabId,
  cityBars,
  cityBreakdown,
  definition,
  detail,
  certainty,
  source,
  children,
}: BillShareProps & CityPanelProps & { children?: ReactNode }) {
  const [yearIndex, setYearIndex] = useState(Math.max(years.length - 1, 0))
  const year = years[yearIndex]
  // The box holds the home's value in the latest year, the one a reader knows (#1121); an earlier
  // year prices the same home at its earlier value (`homeInYear`)
  const latest = years[years.length - 1]
  // What the reader typed, or null while the box still shows the City's average home
  const [typed, setTyped] = useState<string | null>(null)
  // The value last estimated, or null while the numbers are for the City's average home
  const [estimated, setEstimated] = useState<number | null>(null)
  const value = estimated ?? latest?.averageHome ?? 0
  // Counts up each time a new bill has finished counting, so the total can flash once
  const [pulse, setPulse] = useState(0)
  const lastBill = useRef<string | null>(null)
  // Every number below counts to a new value, so a change is seen, not just found
  // (a new home value takes the long count, a switch of year the short one, #1087)
  const [countMs, setCountMs] = useState(COUNT_MS)
  const shownValue = useCountedNumber(value, { durationMs: countMs })
  // The year counts too: the rates move from the old year's to the new one's, so the amounts follow
  const yearPosition = useCountedNumber(yearIndex * YEAR_STEPS, { durationMs: YEAR_COUNT_MS })
  // Once the count has ended on a bill that differs from the last one, the total flashes once
  const billKey = `${yearIndex}:${value}`
  const settled = shownValue === value && yearPosition === yearIndex * YEAR_STEPS
  useEffect(() => {
    if (!settled) return
    if (lastBill.current !== null && lastBill.current !== billKey) setPulse((count) => count + 1)
    lastBill.current = billKey
  }, [settled, billKey])
  const yearRates = yearRatesOf(years)
  const position = yearPosition / YEAR_STEPS
  const rates = ratesAtPosition(yearRates, position)
  // The home as priced now: its value in the year shown, moving between the two while the year counts
  const shown = homeAtPosition(years, position, shownValue)
  // The City's bar counts with the bill: the year between two years, the home value as it counts (#1096)
  const cityBar = cityBarFor(cityBars, years, position, shownValue, rates)
  // The tab's button and heading count with it
  useReportFigures(
    tabId,
    cityBar && cityBar.increase !== null ? figuresFor(cityBar.increase) : undefined,
  )
  if (!year || !latest) return null

  const text = typed ?? formatWholeDollars(latest.averageHome)
  const homeValue = parseHomeValue(text)
  const bill = computeBillShare(shown, rates)
  const receipt = receiptFor(bill, shown)
  // What a screen reader hears: the bill for the value estimated, not each step of the count
  const target = homeInYear(years, yearIndex, value)
  const summary = receiptFor(computeBillShare(target, yearRates[yearIndex] ?? {}), target).summary

  // Estimating changes the numbers below the box, which counts them to the new bill
  // (a reader who asked for less motion gets them at once); the page never scrolls (#1068, #1111)
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

  // The City's part follows the home typed (the average home while the box holds no number)
  const cityPart = bill?.parts.find((p) => p.key === 'city')
  const cityAmount = cityPart?.amount ?? null
  const baseYear = yearIndex === 0 && years.length > 1
  const homeRatio = shown / year.averageHome
  const breakdownTotal = cityBreakdown?.areas.reduce((sum, area) => sum + area.value, 0) ?? 0
  const breakdownFactor =
    cityAmount !== null && breakdownTotal > 0 ? cityAmount / breakdownTotal : homeRatio
  const where = (cityBar || cityBreakdown) && (
    <>
      {cityBar && <AmountBar title={cityBar.title} total={cityBar.total} parts={cityBar.parts} />}
      {cityBreakdown && <ScaledBreakdown spec={cityBreakdown} factor={breakdownFactor} />}
    </>
  )

  // The notes always take their room, so a year with none to show never makes the row shorter
  const assumed = assumedNote(years)
  const kept = reservedNote(years)
  const shownNote = unconfirmedNote(years, yearIndex)
  const notes = [
    { key: 'rough', text: ROUGH_NOTE, shown: true },
    { key: 'rates', text: `Uses ${year.year} rates.`, shown: true },
    ...(assumed ? [{ key: 'assumed', text: assumed, shown: true }] : []),
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
    <div className="space-y-2">
      {intro && <Text variant="small">{intro}</Text>}
      <RoughEstimator
        value={text}
        onValueChange={setTyped}
        canEstimate={homeValue !== null && homeValue !== value}
        onEstimate={estimate}
        error={
          homeValue === null ? 'Enter your home’s value as a number, like $500,000.' : undefined
        }
        options={years.map((option) => ({ key: String(option.year), label: String(option.year) }))}
        selected={yearIndex}
        onSelect={selectYear}
      />
      <p role="status" className="sr-only">
        {summary}
      </p>
      <BillAnswer
        tax={cityBar?.total ?? formatWholeDollars(cityAmount ?? 0)}
        increase={cityBar?.increase ?? null}
        certainty={certainty}
        note={year.note}
        yours={estimated !== null}
        home={formatWholeDollars(shown)}
        assumedYear={yearIndex < years.length - 1 ? year.year : undefined}
        baseYear={baseYear}
        laterIncrease={baseYear && cityBars ? increaseIn(cityBars, years, 1, value) : null}
        cityPercent={receipt.slices.length > 0 ? (cityPart?.percent ?? null) : null}
      />
      <Card
        as="section"
        variant="elevated"
        padding="xs"
        className="max-[24rem]:p-2"
        aria-label="Your whole property tax bill"
      >
        {receipt.slices.length > 0 ? (
          <ShareBill
            slices={receipt.slices}
            label={receipt.label}
            title="Your whole bill"
            total={receipt.total ?? undefined}
            pulseKey={pulse}
          />
        ) : (
          <Text variant="small" className="py-8 text-center">
            The whole bill can’t be shown yet.
          </Text>
        )}
      </Card>
      <BillDetails
        where={where || undefined}
        notes={notes}
        about={
          (definition || detail) && (
            <div className="space-y-3">
              {definition}
              {detail}
            </div>
          )
        }
        sources={uniqueSources([source, year.source])}
      />
      {children}
    </div>
  )
}
