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
import { formatValue } from '@/platform/lib/chart/format'
import { Button } from '@/platform/ui/Button'
import { Field } from '@/platform/ui/Field.client'
import { Link } from '@/platform/ui/Link'
import { ShareBar, ShareBarSwatch, type ShareBarSlice } from '@/platform/ui/ShareBar'
import { Text } from '@/platform/ui/Text'

import type { BillShareProps } from './billShare'

/** A slice's tone: the City highlighted, the others gray, the schools' the strongest */
const TONE: Record<BillBody, ShareBarSlice['tone']> = {
  schools: 'strong',
  city: 'highlight',
  county: 'medium',
  matc: 'light',
}

/** A slice this wide or wider has room for its percent written inside it */
const LABEL_MIN_SHARE = 8

const dollars = (amount: number) => formatValue(Math.round(amount), 'usd')

/** "A, B and C" */
const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

/**
 * The whole property-tax bill at the top of a fact tab (#1018): a line saying what the estimate is
 * based on, a home value the reader can change (it starts at the City's average home), a switch
 * between tax years, what that home pays each body, and the bill as one bar whose slices are as
 * wide as their shares. The City's slice is joined to the panel under it, which holds the rest of
 * the tab (`children`: the City's adopted and proposed bars and where its part goes), so the
 * reader sees where the City's share sits in the whole. A year in which a body has not set its rate
 * uses that body's rate from the year before, and says so.
 */
export function BillShare({ intro, years, children }: BillShareProps & { children?: ReactNode }) {
  const [yearIndex, setYearIndex] = useState(Math.max(years.length - 1, 0))
  const year = years[yearIndex]
  // What the reader typed, or null while the box still shows the City's average for the year
  const [typed, setTyped] = useState<string | null>(null)
  if (!year) return null

  const text = typed ?? dollars(year.averageHome)
  const homeValue = parseHomeValue(text)
  const { rates, filled } = fillFromEarlier(year.rates, years[yearIndex - 1]?.rates)
  const bill = homeValue === null ? null : computeBillShare(homeValue, rates)
  const part = (key: BillBody): BillPart | undefined => bill?.parts.find((p) => p.key === key)
  const earlier = years[yearIndex - 1]

  const slices: ShareBarSlice[] =
    bill?.complete === true
      ? bill.parts.map(({ key, share, percent }) => ({
          key,
          share: share ?? 0,
          tone: TONE[key],
          ...((share ?? 0) >= LABEL_MIN_SHARE ? { label: `${percent}%` } : {}),
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
            onChange={(event) => setTyped(event.target.value)}
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
                onClick={() => setYearIndex(index)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {bill && (
        <div role="status" className="space-y-1">
          <Text variant="lead" className="text-foreground">
            {bill.complete && bill.total !== null
              ? `If your home is worth ${dollars(homeValue ?? 0)}, your whole bill is about ${dollars(bill.total)}.`
              : `The City’s part of a ${dollars(homeValue ?? 0)} home’s bill would be about ${dollars(part('city')?.amount ?? 0)}.`}
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
                <span className="block font-semibold text-foreground">{dollars(amount ?? 0)}</span>
                <span className="block text-muted-foreground">about {percent}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {picture ? (
        <ShareBar slices={slices} label={barLabel}>
          {children}
        </ShareBar>
      ) : (
        children
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
