import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Section } from '@/platform/ui/Section'

import type {
  SectionAlign,
  SectionPhoneOrder,
  SectionVerticalAlign,
  LayoutWidth,
} from '../domain/blocks'
import { COLUMN_SPAN } from './columnSpan'

/*
 * The section block (#884): a row of items laid out by the editor's choices, with no arrangement
 * fixed in code. On a phone the items stack, in the order listed unless an item asks to be above
 * or below the rest (`order` only on the phone, so from `lg` up the page order and the visual
 * order agree). From `lg` up each item takes its share of a 12-column grid and wraps onto the
 * next row when the widths add up to more than a row.
 */

const TEXT_ALIGN: Record<SectionAlign, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
}

const SELF: Record<SectionVerticalAlign, string> = {
  top: 'self-start',
  center: 'self-center',
  bottom: 'self-end',
}

const PHONE_ORDER: Record<SectionPhoneOrder, string> = {
  inOrder: '',
  first: 'order-first lg:order-none',
  last: 'order-last lg:order-none',
}

export type SectionBlockItem = {
  width: LayoutWidth
  align: SectionAlign
  verticalAlign: SectionVerticalAlign
  phoneOrder: SectionPhoneOrder
  /** The item's blocks, already drawn by the page's block components */
  children: React.ReactNode
}

export function SectionBlock({ items }: { items: SectionBlockItem[] }) {
  if (items.length === 0) return null

  return (
    <Section spacing="sm">
      <div className="grid grid-cols-4 gap-x-8 gap-y-8 lg:grid-cols-12 lg:gap-x-12">
        {items.map(({ width, align, verticalAlign, phoneOrder, children }, index) => (
          <div
            key={index}
            className={cn(
              'flex flex-col gap-8',
              COLUMN_SPAN[width],
              TEXT_ALIGN[align],
              SELF[verticalAlign],
              PHONE_ORDER[phoneOrder],
            )}
          >
            {children}
          </div>
        ))}
      </div>
    </Section>
  )
}
