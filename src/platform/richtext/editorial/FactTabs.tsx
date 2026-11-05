import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Chart } from '@/platform/ui/chart/Chart'
import { Link } from '@/platform/ui/Link'
import { Tabs, type TabsItem } from '@/platform/ui/Tabs.client'
import { Text } from '@/platform/ui/Text'

import { FactCard } from './FactCard'
import type { FactTabProps, FactTabsProps } from './factTabs'
import { Timeline } from './Timeline'

/** What one tab opens: its heading (with scripting on), its definition, where the number comes from, then its charts and timelines */
function FactTabPanel({ heading, definition, fact, panel }: FactTabProps) {
  return (
    <div className="space-y-4">
      {/* Tabs shows its heading only with scripting off; with it on the tab is the title, so this one
          shows then, and the reader always sees the heading the editor wrote, once */}
      <Text variant="subsection" as="h3" className="hidden scripted:block">
        {heading}
      </Text>
      {definition && <Text variant="lead">{definition}</Text>}
      {fact.source && (
        <Text variant="small">
          Source:{' '}
          <Link href={fact.source.href} external={fact.source.external}>
            {fact.source.label}
          </Link>
        </Text>
      )}
      {panel.map((item, index) =>
        item.kind === 'chart' ? (
          <Chart key={index} spec={item.spec} />
        ) : (
          <Timeline key={index} {...item.timeline} className="my-0" />
        ),
      )}
    </div>
  )
}

/**
 * Key facts that open pictures (#664): each fact is a tab button (`FactCard` as a tab) that shows
 * its heading, definition and charts or timelines. `Tabs` renders every panel on the server and
 * shows one at a time only when scripting is on, so with it off the panels read stacked, each under
 * its heading. A tab with no renderable picture still shows its definition.
 */
export function FactTabs({ tabs, className }: FactTabsProps & { className?: string }) {
  if (tabs.length === 0) return null
  const items: TabsItem[] = tabs.map((tab, index) => ({
    value: `tab-${index}`,
    trigger: <FactCard fact={tab.fact} variant="tab" />,
    heading: tab.heading,
    panel: <FactTabPanel {...tab} />,
  }))
  return (
    <Tabs
      label="Key facts"
      items={items}
      defaultValue="tab-0"
      // The tab buttons share four rows, so the same part of each fact lines up (#678)
      rows="shared"
      className={cn('not-prose my-8 w-full', className)}
    />
  )
}
