'use client'

import * as RadixTabs from '@radix-ui/react-tabs'
import React, { useEffect, useRef, useState } from 'react'

import { cn } from '@/platform/lib/cn'

import { cardVariants } from './Card'
import { HEADER_SCROLL_MARGIN } from './scrollMargin'
import { Text, type TextProps } from './Text'

export type TabsItem = {
  /** Ties the tab to its panel; unique in the list */
  value: string
  /** What the tab shows: a short label on one line, plus visually hidden text if screen readers need more */
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
}

/*
 * How a tab looks (#1112): a plain, separate button, the same width and height as the others, with
 * its label centred on one line (the editor's label limit keeps it short enough, so nothing wraps
 * or clips). The quiet tabs have a thin border and a muted label; the selected one has the primary
 * border, a soft primary fill and a bolder label, so it is told apart by more than colour. Every
 * tab carries the one string: the selected state is a `data-[state=active]` variant of it.
 */
const TAB_LOOK = [
  'flex min-h-12 min-w-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-0.5 text-center text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors duration-200 hover:bg-surface hover:text-foreground sm:px-2 sm:text-sm',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  'data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:hover:bg-primary/10',
].join(' ')

/*
 * Tabs that read without JavaScript (#661, docs/ui/component-set.md). Radix Tabs gives the pattern:
 * roving focus, arrow keys, Home and End, and the ARIA roles. Every panel is rendered by the server
 * (`forceMount`, which also leaves Radix's `hidden` off), so what a panel holds, such as a chart,
 * never reaches the browser as code. The `scripted` variant (`@media (scripting: enabled)`) is
 * what turns it into tabs: only then are the tab list shown and the inactive panels and their
 * headings hidden. With scripting off every panel shows, stacked, each under its heading.
 * The tabs sit in one row at every width, as separate equal buttons above the panel (#1112).
 */
export function Tabs({ label, items, defaultValue, headingAs = 'h3', className }: TabsProps) {
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
      className={cn(HEADER_SCROLL_MARGIN, 'group/tabs flex flex-col gap-2', className)}
    >
      <RadixTabs.List
        aria-label={label}
        className="hidden auto-cols-[minmax(0,1fr)] grid-flow-col gap-2 scripted:grid"
      >
        {items.map(({ value, trigger }) => (
          <RadixTabs.Trigger key={value} value={value} className={TAB_LOOK}>
            {trigger}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map(({ value, heading, panel }) => (
        <RadixTabs.Content
          key={value}
          value={value}
          forceMount
          className={cn(
            cardVariants({ variant: 'elevated', padding: 'sm' }),
            'space-y-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:group-data-[changed]/tabs:data-[state=active]:animate-in motion-safe:group-data-[changed]/tabs:data-[state=active]:duration-150 motion-safe:group-data-[changed]/tabs:data-[state=active]:fade-in-0 sm:p-6 scripted:data-[state=inactive]:hidden',
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
