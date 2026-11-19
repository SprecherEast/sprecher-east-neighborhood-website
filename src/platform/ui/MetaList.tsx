import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/** A fact with a name: "Date", "Time". A list of them is a description list */
export type LabelledMetaItem = { label: string; icon?: never; value: React.ReactNode }

/** A fact a decorative icon explains (a pin before a place). A list of them is a plain list */
export type IconMetaItem = { icon?: React.ReactNode; label?: never; value: React.ReactNode }

/*
 * Small facts about a page or an item (#432): a date, a time, a place. `inline` is a wrapping row
 * of "Label: value"; `stacked` puts one item per line; `on-image` is a row on a photo, each label
 * above its value. Items with labels are a description list, items without a plain list.
 */
const metaListVariants = cva('', {
  variants: {
    variant: {
      inline: 'flex flex-wrap gap-6 text-muted-foreground',
      stacked: 'flex flex-col gap-3',
      'on-image': 'flex flex-wrap gap-x-10 gap-y-4 text-sm text-on-image',
    },
  },
  defaultVariants: { variant: 'stacked' },
})

const labelClass = {
  inline: 'font-medium text-foreground after:content-[":"]',
  stacked: 'text-sm font-medium text-muted-foreground',
  'on-image': 'text-on-image/70',
} as const

export type MetaListProps = VariantProps<typeof metaListVariants> & {
  /** All labelled or none: a list mixes no kinds, so its markup stays valid */
  items: LabelledMetaItem[] | IconMetaItem[]
  className?: string
}

export function MetaList({ items, variant, className }: MetaListProps) {
  const look = variant ?? 'stacked'
  const labelled = items.some((item) => item.label !== undefined)
  const List = labelled ? 'dl' : 'ul'
  const Item = labelled ? 'div' : 'li'

  return (
    <List className={cn(metaListVariants({ variant }), className)}>
      {items.map((item, index) => (
        <Item
          key={item.label ?? index}
          className={cn(
            look === 'inline' ? 'flex items-center gap-1.5' : 'flex gap-1.5',
            item.label && look !== 'inline' ? 'flex-col gap-1' : 'items-center',
          )}
        >
          {item.icon && (
            <span aria-hidden="true" className="flex shrink-0 [&_svg]:size-4">
              {item.icon}
            </span>
          )}
          {item.label && <dt className={labelClass[look]}>{item.label}</dt>}
          {labelled ? (
            <dd className="min-w-0">{item.value}</dd>
          ) : (
            <span className="min-w-0">{item.value}</span>
          )}
        </Item>
      ))}
    </List>
  )
}
