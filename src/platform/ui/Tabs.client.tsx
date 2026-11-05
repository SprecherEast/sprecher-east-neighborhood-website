'use client'

import * as RadixTabs from '@radix-ui/react-tabs'
import React, { useState } from 'react'

import { cn } from '@/platform/lib/cn'

import { SHARED_ROWS_SPACE_2, SUBGRID_FOUR_ROWS, SUBGRID_FOUR_ROWS_EXPLICIT } from './layoutSizes'
import { Text, type TextProps } from './Text'

export type TabsItem = {
  /** Ties the tab to its panel; unique in the list */
  value: string
  /** What the tab shows: a word, or a small card (an icon, a label and a figure) */
  trigger: React.ReactNode
  /** The panel's name. Read under the panel when scripting is off, where the tabs are hidden */
  heading: string
  /** Server-rendered content; a chart passed here stays on the server */
  panel: React.ReactNode
}

export type TabsProps = {
  /** Names the tab list for screen readers ("Budget views") */
  label: string
  /** Two to four items fit the phone's 2 by 2 layout */
  items: TabsItem[]
  /** The tab that is selected on the first render, on the server too, so nothing moves on load */
  defaultValue: string
  /** The heading level of each panel's heading: below the heading of the section that holds the tabs */
  headingAs?: Extract<NonNullable<TextProps['as']>, 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>
  className?: string
  /**
   * `shared`: the tab buttons share four rows (`SUBGRID_FOUR_ROWS`), so when each holds the same
   * parts, such as a fact's label, value, explanation and foot, the same part of every button sits
   * on one line (#678). `own` (default): each button lays out by itself.
   */
  rows?: 'own' | 'shared'
}

/*
 * Tabs that read without JavaScript (#661, docs/ui/component-set.md). Radix Tabs gives the pattern:
 * roving focus, arrow keys, Home and End, and the ARIA roles. Every panel is rendered by the server
 * (`forceMount`, which also leaves Radix's `hidden` off), so what a panel holds, such as a chart,
 * never reaches the browser as code. The `scripted` variant (`@media (scripting: enabled)`) is
 * what turns it into tabs: only then are the tab list shown and the inactive panels and their
 * headings hidden. With scripting off every panel shows, stacked, each under its heading.
 * With three tabs the last one spans both columns of the phone's grid, so none sits alone, half wide.
 */
export function Tabs({
  label,
  items,
  defaultValue,
  headingAs = 'h3',
  className,
  rows = 'own',
}: TabsProps) {
  const shared = rows === 'shared'

  // The fade runs after the reader changes tab, not on the page's first paint
  const [changed, setChanged] = useState(false)

  return (
    <RadixTabs.Root
      defaultValue={defaultValue}
      onValueChange={() => setChanged(true)}
      data-changed={changed || undefined}
      className={cn('group/tabs flex flex-col gap-6', className)}
    >
      <RadixTabs.List
        aria-label={label}
        className={cn(
          'hidden grid-cols-2 gap-2 sm:auto-cols-fr sm:grid-flow-col scripted:grid',
          shared && [SUBGRID_FOUR_ROWS_EXPLICIT, SHARED_ROWS_SPACE_2.list],
        )}
      >
        {items.map(({ value, trigger }) => (
          <RadixTabs.Trigger
            key={value}
            value={value}
            className={cn(
              'min-h-11 rounded-xl border border-border bg-card px-3 py-2 text-left text-foreground transition-colors duration-200 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=active]:border-primary data-[state=active]:bg-primary/10 max-sm:odd:last:col-span-2 sm:px-4',
              shared && [SUBGRID_FOUR_ROWS, SHARED_ROWS_SPACE_2.item],
            )}
          >
            {trigger}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map(({ value, heading, panel }) => (
        <RadixTabs.Content
          key={value}
          value={value}
          forceMount
          className="space-y-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:group-data-[changed]/tabs:data-[state=active]:animate-in motion-safe:group-data-[changed]/tabs:data-[state=active]:duration-150 motion-safe:group-data-[changed]/tabs:data-[state=active]:fade-in-0 scripted:data-[state=inactive]:hidden"
        >
          <Text variant="subsection" as={headingAs} className="scripted:hidden">
            {heading}
          </Text>
          {panel}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
