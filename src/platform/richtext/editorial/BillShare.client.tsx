'use client'

import React, { useId, useState, type ReactNode } from 'react'

import { BILL_BODY_NAMES, computeBillShare, parseHomeValue } from '@/platform/lib/billShare'
import type { ResolvedLink } from '@/platform/lib'
import type { Certainty } from '@/platform/lib/certainty'
import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import { Card } from '@/platform/ui/Card'
import { ShareBill } from '@/platform/ui/ShareBill'
import { Text } from '@/platform/ui/Text'
import { COUNT_MS, YEAR_COUNT_MS } from '@/platform/ui/useCountedNumber.client'

import type { BillShareProps } from './billShare'
import { BillAnswer } from './BillAnswer'
import { BillDetails } from './BillDetails'
import { BreakdownRow } from './BreakdownRow'
import { notesFor, uniqueSources } from './billShareNotes'
import { receiptFor } from './billShareView'
import { NoteText } from './NoteText'
import {
  cityTaxFor,
  figuresFor,
  homeAtPosition,
  homeInYear,
  increaseIn,
  yearRatesOf,
} from './billFigures'
import { useReportFigures } from './BillFigures.client'
import { ratesAtPosition } from './rateBlend'
import { RoughEstimator } from './RoughEstimator'
import { useBillCount } from './useBillCount.client'
import { useBreakdownAutoOpen } from './useBreakdownAutoOpen.client'

/** What the tab adds around the whole bill (#1020, #1111): the City's charts and the tab's own parts */
export type CityPanelProps = {
  /** The tab this bill is in, so the tab's button and heading can follow it (#1029) */
  tabId?: string
  /** A chart of the City's tax by year: the answer card takes the year's tax and its increase from it */
  cityBars?: Extract<ChartSpec, { kind: 'stacked' }>
  /** Where the City's tax goes, drawn again for whatever the City's tax is on the home typed */
  cityBreakdown?: Extract<ChartSpec, { kind: 'breakdown' }>
  /** The tab's short text, in the row on why the bill may differ */
  definition?: ReactNode
  /** The tab's explanation, after the short text */
  detail?: ReactNode
  /** How sure we are about the tab's fact: the answer card's one badge */
  certainty?: Certainty
  /** The tab's own source; the sources row lists it once beside the year's */
  source?: ResolvedLink | null
}

/**
 * The one space between the tab's cards: under the intro, between the estimator and the answer, and on
 * (#1142). It is the space between paragraphs of rich text: the typography plugin's 1.25em of 1rem
 * text, which is spacing step 5 (`BillShareOrder.client.test.tsx` reads the plugin's value).
 */
export const BILL_GAP = 'space-y-5'

/**
 * The whole property-tax bill at the top of a fact tab (#1018, #1111), one column on every width,
 * in the order a neighbor needs it: the bill block's one intro line, the Rough Estimator (the home
 * value the reader can change, which starts at the City's average home, and the switch between tax
 * years), the answer card (the City's tax on the home and year, its increase, the year's status), the
 * whole bill (its own card: the total, one bar whose slices are as wide as their shares, and the receipt
 * naming each, with where the City's share goes (the split alone) as a closed row under the City's
 * own row, #1163), then one card of two rows: why the bill may differ and the sources. The tab's
 * other pictures (`children`) follow. Everything is drawn again for every home value and year, so
 * every amount is the City's slice of the bill. A year in which a body has not
 * set its rate uses that body's rate from the year before, and says so in a note whose room is
 * always kept, so the page never changes height.
 */
export function BillShare({
  intro,
  years,
  rows,
  notes: noteTemplates,
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
  // The bill counts to each new value or year, and the total flashes once it settles (`pulse`)
  const { shownValue, position, pulse, countWith } = useBillCount(value, yearIndex)
  // The City's breakdown: closed on load, opened by itself after each estimate that changes the bill, while it is closed (#1163, #1165, #1176)
  const breakdown = useBreakdownAutoOpen(pulse)
  // The whole bill's heading stays in view, under the sticky header, when the breakdown opens (#1178)
  const billTitleId = useId()
  const yearRates = yearRatesOf(years)
  const rates = ratesAtPosition(yearRates, position)
  // The home as priced now: its value in the year shown, moving between the two while the year counts
  const shown = homeAtPosition(years, position, shownValue)
  // The City's tax counts with the bill: the year between two years, the home value as it counts (#1096)
  const cityTax = cityTaxFor(cityBars, years, position, shownValue, rates)
  // The tab's button and heading count with it
  useReportFigures(
    tabId,
    cityTax && cityTax.increase !== null ? figuresFor(cityTax.increase) : undefined,
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
    breakdown.arm(homeValue !== value)
    countWith(COUNT_MS)
    setEstimated(homeValue)
  }
  // Choosing a year moves the amounts to its rates in half a second
  const selectYear = (index: number) => {
    countWith(YEAR_COUNT_MS)
    setYearIndex(index)
  }

  // The City's part follows the home typed (the average home while the box holds no number)
  const cityPart = bill?.parts.find((p) => p.key === 'city')
  const cityAmount = cityPart?.amount ?? null
  // The earliest of several years is the base year, unless the next year's increase cannot be
  // computed: then the line keeps today's behavior, so the card's room never depends on it
  const laterIncrease =
    yearIndex === 0 && years.length > 1 && cityBars ? increaseIn(cityBars, years, 1, value) : null
  const baseYear = laterIncrease !== null
  const homeRatio = shown / year.averageHome
  const breakdownTotal = cityBreakdown?.areas.reduce((sum, area) => sum + area.value, 0) ?? 0
  const breakdownFactor =
    cityAmount !== null && breakdownTotal > 0 ? cityAmount / breakdownTotal : homeRatio
  const where = cityBreakdown && (
    <BreakdownRow
      title={rows.breakdown}
      spec={cityBreakdown}
      factor={breakdownFactor}
      row={breakdown}
      revealAnchor={billTitleId}
    />
  )

  // The notes are the editor's; the page only decides which apply in the year shown. One that is
  // not showing still takes its room, so a year with none to show never makes the row shorter
  const notes = notesFor(noteTemplates, {
    years,
    yearIndex,
    missing: bill && !bill.complete ? bill.missing.map((key) => BILL_BODY_NAMES[key]) : [],
  }).map(({ key, text, link, shown }) => ({
    key,
    text: <NoteText text={text} link={link} />,
    shown,
  }))

  return (
    <div className={BILL_GAP}>
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
        tax={cityTax?.total ?? formatWholeDollars(cityAmount ?? 0)}
        increase={cityTax?.increase ?? null}
        certainty={certainty}
        note={year.note}
        yours={estimated !== null}
        home={formatWholeDollars(shown)}
        assumedYear={yearIndex < years.length - 1 ? year.year : undefined}
        baseYear={baseYear}
        laterIncrease={laterIncrease}
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
            titleId={billTitleId}
            total={receipt.total ?? undefined}
            pulseKey={pulse}
            nested={where ? { after: 'city', children: where } : undefined}
          />
        ) : (
          <>
            <Text variant="small" className="py-8 text-center">
              The whole bill can’t be shown yet.
            </Text>
            {/* With no receipt there is no City row to sit under, so the breakdown follows the line */}
            {where}
          </>
        )}
      </Card>
      <BillDetails
        titles={rows}
        notes={notes}
        about={
          (definition || detail) && (
            <div className="space-y-3">
              {definition}
              {detail}
            </div>
          )
        }
        sources={uniqueSources([
          source,
          year.source,
          ...(cityBreakdown?.sources ?? []).map(({ label, href }) => ({
            label,
            href,
            external: href.startsWith('http'),
            appearance: 'default' as const,
          })),
        ])}
        asOf={cityBreakdown?.asOf}
      />
      {children}
    </div>
  )
}
