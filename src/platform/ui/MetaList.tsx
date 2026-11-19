import React from 'react'

import { cn } from '@/platform/lib/cn'

/** A fact with a name: "Date", "Time". A list of them is a description list */
export type LabelledMetaItem = { label: string; icon?: never; value: React.ReactNode }

/** A fact a decorative icon explains (a pin before a place). A list of them is a plain list */
export type IconMetaItem = { icon?: React.ReactNode; label?: never; value: React.ReactNode }

/*
 * Small facts about a page or an item (#432): a date, a time, a place, one item per line. Items
 * with labels are a description list, each label above its value; items without a plain list.
 */
export type MetaListProps = {
  /** All labelled or none: a list mixes no kinds, so its markup stays valid */
  items: LabelledMetaItem[] | IconMetaItem[]
  className?: string
}

export function MetaList({ items, className }: MetaListProps) {
  const labelled = items.some((item) => item.label !== undefined)
  const List = labelled ? 'dl' : 'ul'
  const Item = labelled ? 'div' : 'li'

  return (
    <List className={cn('flex flex-col gap-3', className)}>
      {items.map((item, index) => (
        <Item
          key={item.label ?? index}
          className={cn('flex gap-1.5', item.label ? 'flex-col gap-1' : 'items-center')}
        >
          {item.icon && (
            <span aria-hidden="true" className="flex shrink-0 [&_svg]:size-4">
              {item.icon}
            </span>
          )}
          {item.label && (
            <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
          )}
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
