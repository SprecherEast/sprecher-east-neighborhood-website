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
 * The space between the tab buttons and the panel: one definition for both, small on a phone to leave the labels room.
 */
const TAB_GAP = 'gap-1 sm:gap-2'

/*
 * How a tab looks (#1112): a plain, separate button, the same width and height as the others, with
 * its label centred on one line (the editor's label limit keeps it short enough, so nothing wraps
 * or clips). The quiet tabs have a thin border and a muted label; the selected one has the primary
 * border, a soft primary fill and a bolder label, so it is told apart by more than colour. Every
 * tab carries the one string: the selected state is a `data-[state=active]` variant of it. On a
 * phone the gap, side padding, type size and letter spacing are as small as the theme allows, so a
 * label of the editor's limit (bold when selected) keeps visible room at the narrowest width, 320 px;
 * the sizes step up at 390 px and from `sm`. The quiet and selected looks are the `tab-quiet` and
 * `tab-selected` utilities (theme/tabs.css), so the rules that show a tab before the script runs
 * (#1309) wear exactly the same look.
 */

const TAB_LOOK = [
  'tab-quiet flex min-h-12 min-w-0 cursor-pointer items-center justify-center rounded-lg border px-0 text-center text-fine tracking-tighter whitespace-nowrap transition-colors duration-200 hover:bg-surface hover:text-foreground min-[390px]:text-xs min-[390px]:tracking-tight sm:px-2 sm:text-sm sm:tracking-normal',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  'data-[state=active]:tab-selected data-[state=active]:hover:bg-primary/10',
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
  // Set once the script has chosen the tab; until then the server's HTML and CSS show the tab the
  // link names (#1309, theme/tabs.css)
  const [ready, setReady] = useState(false)
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
  // address changes on the page (a link, or Back); a name that is not a tab changes nothing. A
  // link the browser itself followed already brought the tabs into view (their target is the
  // `:target`), so the script does not scroll again, which would pull a reader back who had
  // moved on while the page loaded (#1309)
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
      if (!root.current?.querySelector('[data-tab-target]:target')) {
        root.current?.scrollIntoView({ block: 'start' })
      }
    }
    open()
    setReady(true)
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
      data-tabs-ready={ready || undefined}
      onValueChange={choose}
      data-changed={changed || undefined}
      className={cn(HEADER_SCROLL_MARGIN, 'group/tabs relative flex flex-col', TAB_GAP, className)}
    >
      {/* The link targets (#1309): the browser follows a link that names a tab to its target on its
          own, before any script, scrolling to the top of the tabs and, with theme/tabs.css, showing
          the tab. Out of the flow, so they take no room and no gap */}
      {anchors.map((anchor, index) => (
        <span
          key={anchor}
          id={anchor}
          data-tab-target={index}
          aria-hidden="true"
          className={cn(HEADER_SCROLL_MARGIN, 'pointer-events-none absolute top-0 left-0 size-0')}
        />
      ))}
      <RadixTabs.List
        aria-label={label}
        className={cn('hidden auto-cols-[minmax(0,1fr)] grid-flow-col scripted:grid', TAB_GAP)}
      >
        {items.map(({ value, trigger }, index) => (
          <RadixTabs.Trigger key={value} value={value} data-tab-index={index} className={TAB_LOOK}>
            {trigger}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map(({ value, heading, panel }, index) => (
        <RadixTabs.Content
          key={value}
          value={value}
          data-tab-index={index}
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
