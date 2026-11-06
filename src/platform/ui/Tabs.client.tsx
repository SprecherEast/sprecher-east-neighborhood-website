'use client'

import * as RadixTabs from '@radix-ui/react-tabs'
import React, { useState } from 'react'

import { cn } from '@/platform/lib/cn'

import { SUBGRID_FOUR_ROWS, SUBGRID_FOUR_ROWS_EXPLICIT } from './layoutSizes'
import { cardVariants } from './Card'
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
  /** Two to four items fit one row on a phone, each tab as wide as the others */
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
 * The folder-tab outline (#704): the selected tab and its panel are one shape, like the tabs of a
 * folder. The tab opens at the bottom (square corners, no bottom border) and its `after` carries it
 * down across the gap and over the panel's top edge, with the side borders, so the panel's edge
 * stops under the tab. Its `before` is the two flares: a quarter-circle ring on each side of the
 * tab's base, so the outline curves from the panel's top edge up into the tab instead of meeting it
 * at a corner. The first tab has no left flare and the last no right one, where the outline runs
 * on into the panel's own edge. Both numbers the geometry depends on are variables on the root:
 * `--tabs-gap` (between the tabs and the panel) and `--tabs-flare` (the flare's radius, never more
 * than the gap, so it stays below the neighbouring tabs). The tabs sit the same distance from each
 * other as from the panel (`gap-x-2` on the list, `--tabs-gap` under it, #707): two gaps of
 * different sizes on one edge look accidental.
 */
// Tailwind reads class names as written in the source, so none of these are built from pieces. The
// two gradients are variables on the root (each written once, a ring of the outline colour on a
// quarter circle, its far side filled with the panel's colour) and the tab's classes use them.
const FLARES =
  '[--tabs-flare-left:radial-gradient(circle_at_0_0,transparent_calc(var(--tabs-flare)_-_1px),var(--color-primary)_calc(var(--tabs-flare)_-_0.5px),var(--color-primary)_var(--tabs-flare),var(--color-card)_calc(var(--tabs-flare)_+_0.5px))] [--tabs-flare-right:radial-gradient(circle_at_100%_0,transparent_calc(var(--tabs-flare)_-_1px),var(--color-primary)_calc(var(--tabs-flare)_-_0.5px),var(--color-primary)_var(--tabs-flare),var(--color-card)_calc(var(--tabs-flare)_+_0.5px))]'

/*
 * How a tab looks (#688, #704): raised and lifting on hover, so it reads as a button; the selected
 * one is a glassy green that fades into its panel's colour, with the primary border its panel wears
 * too, drawn above its neighbours and opening into the panel (see above).
 */
const TAB_LOOK = [
  'relative min-h-11 min-w-0 cursor-pointer rounded-xl border border-border bg-card px-1.5 py-2 text-left text-foreground [overflow-wrap:anywhere] shadow-sm transition-all max-sm:text-sm duration-200 hover:bg-surface hover:shadow-md min-[400px]:px-3 sm:px-4',
  'motion-safe:data-[state=inactive]:hover:-translate-y-0.5',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  // The selected tab: no shadow and no inset ring, either would draw a line along its open bottom
  'data-[state=active]:z-10 data-[state=active]:rounded-b-none data-[state=active]:border-primary data-[state=active]:border-b-0 data-[state=active]:bg-gradient-to-b data-[state=active]:from-primary/30 data-[state=active]:to-transparent data-[state=active]:shadow-none data-[state=active]:backdrop-blur-md data-[state=active]:hover:bg-card data-[state=active]:hover:shadow-none',
  // The extension over the gap and the panel's top edge
  "after:absolute after:top-full after:-left-px after:-right-px after:hidden after:h-[calc(var(--tabs-gap)+1px)] after:border-x after:border-primary after:bg-card after:content-[''] data-[state=active]:after:block",
  // The flares, level with the panel's top edge: left, right, or on one side only
  "before:absolute before:top-[calc(100%_+_var(--tabs-gap)_+_1px_-_var(--tabs-flare))] before:right-[calc(var(--tabs-flare)_*_-1)] before:left-[calc(var(--tabs-flare)_*_-1)] before:z-10 before:hidden before:h-(--tabs-flare) before:bg-no-repeat before:content-[''] before:[background-image:var(--tabs-flare-left),var(--tabs-flare-right)] before:[background-position:left_top,right_top] before:[background-size:var(--tabs-flare)_var(--tabs-flare)] first:before:[background-image:var(--tabs-flare-right)] first:before:[background-position:right_top] last:before:[background-image:var(--tabs-flare-left)] last:before:[background-position:left_top] only:before:[background-image:none] data-[state=active]:before:block",
].join(' ')

/*
 * Tabs that read without JavaScript (#661, docs/ui/component-set.md). Radix Tabs gives the pattern:
 * roving focus, arrow keys, Home and End, and the ARIA roles. Every panel is rendered by the server
 * (`forceMount`, which also leaves Radix's `hidden` off), so what a panel holds, such as a chart,
 * never reaches the browser as code. The `scripted` variant (`@media (scripting: enabled)`) is
 * what turns it into tabs: only then are the tab list shown and the inactive panels and their
 * headings hidden. With scripting off every panel shows, stacked, each under its heading.
 * The tabs sit in one row at every width, so the selected one can join its panel (#704).
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
      className={cn(
        'group/tabs flex flex-col gap-(--tabs-gap) [--tabs-flare:0.5rem] [--tabs-gap:0.5rem]',
        FLARES,
        className,
      )}
    >
      <RadixTabs.List
        aria-label={label}
        className={cn(
          'hidden auto-cols-[minmax(0,1fr)] grid-flow-col gap-x-2 scripted:grid',
          shared && [SUBGRID_FOUR_ROWS_EXPLICIT, 'gap-y-0'],
        )}
      >
        {items.map(({ value, trigger }) => (
          <RadixTabs.Trigger
            key={value}
            value={value}
            className={cn(TAB_LOOK, shared && SUBGRID_FOUR_ROWS)}
          >
            {trigger}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map(({ value, heading, panel }, index) => (
        <RadixTabs.Content
          key={value}
          value={value}
          forceMount
          className={cn(
            cardVariants({ variant: 'elevated', padding: 'sm' }),
            // The selected tab's border, so the panel reads as the tab's own area; under the first or
            // last tab the outline runs straight up into the tab, so that top corner is square
            index === 0 && 'scripted:rounded-tl-none',
            index === items.length - 1 && 'scripted:rounded-tr-none',
            'space-y-4 border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:group-data-[changed]/tabs:data-[state=active]:animate-in motion-safe:group-data-[changed]/tabs:data-[state=active]:duration-150 motion-safe:group-data-[changed]/tabs:data-[state=active]:fade-in-0 sm:p-6 scripted:data-[state=inactive]:hidden',
          )}
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
