'use client'

import * as RadixTabs from '@radix-ui/react-tabs'
import React, { useEffect, useRef, useState } from 'react'

import { cn } from '@/platform/lib/cn'

import { SUBGRID_FOUR_ROWS, SUBGRID_FOUR_ROWS_EXPLICIT } from './layoutSizes'
import { cardVariants } from './Card'
import { HEADER_SCROLL_MARGIN } from './scrollMargin'
import { Text, type TextProps } from './Text'

export type TabsItem = {
  /** Ties the tab to its panel; unique in the list */
  value: string
  /** What the tab shows: a word, or a small card (an icon, a label and a figure) */
  trigger: React.ReactNode
  /** The tab's name in its link (the part after the `#`); the `value` when left out (#1097) */
  anchor?: string
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
 * on into the panel's own edge. The numbers the geometry depends on are variables on the root:
 * `--tabs-gap` (between the tabs and the panel) and `--tabs-radius` (the corner of the tab, of the
 * box and of each flare, #738: the curve is one radius all the way round, so no corner looks
 * pointier than another). `--tabs-flare` is that radius, kept as its own name for the flare's
 * sizes. A flare taller than the gap is fine: the ring hugs the tab's side where the neighbouring
 * tab ends, so it never reaches it. The tabs sit the same distance from each other as from the
 * panel (the list's column gap and the space under it are both `--tabs-gap`, #707): two gaps of
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
  'relative min-h-11 min-w-0 cursor-pointer rounded-(--tabs-radius) border border-border bg-card px-1.5 py-2 text-left text-foreground [overflow-wrap:anywhere] shadow-sm transition-all max-sm:text-sm duration-200 hover:bg-surface hover:shadow-md min-[400px]:px-3 sm:px-4',
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
  const [current, setCurrent] = useState(defaultValue)
  const root = useRef<HTMLDivElement>(null)
  // Every tab has a link of its own (#1097): the page's address plus the tab's name
  const anchors = items.map((item) => item.anchor ?? item.value)
  const names = anchors.join('\n')
  const values = items.map((item) => item.value).join('\n')

  // The link of a tab: its name, numbered `-2`, `-3` when an earlier tabbed block on the page has the
  // same name, so every tab on a page has a link of its own
  const linkOf = (anchor: string) => {
    const roots = [...document.querySelectorAll<HTMLElement>('[data-tab-names]')]
    const earlier = roots
      .slice(0, root.current ? roots.indexOf(root.current) : 0)
      .filter((other) => other.dataset.tabNames?.split('\n').includes(anchor)).length
    return earlier > 0 ? `${anchor}-${earlier + 1}` : anchor
  }

  // A link that names a tab opens it and brings the tabs into view, on load and whenever the
  // address changes on the page (a link, or Back); a name that is not a tab changes nothing
  useEffect(() => {
    const open = () => {
      let wanted = ''
      try {
        wanted = decodeURIComponent(window.location.hash.slice(1))
      } catch {
        return
      }
      const list = names.split('\n')
      const index = wanted ? list.findIndex((anchor) => linkOf(anchor) === wanted) : -1
      const value = values.split('\n')[index]
      if (value === undefined) return
      setCurrent(value)
      root.current?.scrollIntoView({ block: 'start' })
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
    // `names` and `values` stand for the items': the items themselves are new on every render
  }, [names, values])

  // Choosing a tab puts its link in the address bar to copy, replacing the entry so Back leaves the page
  const choose = (value: string) => {
    setChanged(true)
    setCurrent(value)
    const index = items.findIndex((item) => item.value === value)
    window.history.replaceState(window.history.state, '', `#${linkOf(anchors[index] ?? value)}`)
  }

  return (
    <RadixTabs.Root
      ref={root}
      value={current}
      data-tab-names={names}
      onValueChange={choose}
      data-changed={changed || undefined}
      className={cn(
        HEADER_SCROLL_MARGIN,
        'group/tabs flex flex-col gap-(--tabs-gap) [--tabs-flare:var(--tabs-radius)] [--tabs-gap:0.5rem] [--tabs-radius:1rem]',
        FLARES,
        className,
      )}
    >
      <RadixTabs.List
        aria-label={label}
        className={cn(
          'hidden auto-cols-[minmax(0,1fr)] grid-flow-col gap-x-(--tabs-gap) scripted:grid',
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
            // The box's corners are the tab's and the joins' radius (#738), not the card's own
            'rounded-(--tabs-radius)',
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
