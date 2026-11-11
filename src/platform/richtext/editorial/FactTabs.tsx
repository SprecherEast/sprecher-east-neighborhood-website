import React from 'react'

import { cn } from '@/platform/lib/cn'
import { joinLastWords } from '@/platform/lib/joinLastWords'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Chart } from '@/platform/ui/chart/Chart'
import { Link } from '@/platform/ui/Link'
import { Tabs, type TabsItem } from '@/platform/ui/Tabs.client'
import { Text } from '@/platform/ui/Text'

import { splitDefinitionAtSource } from './definitionWithSource'
import { BillShare } from './BillShare.client'
import { FactCard } from './FactCard'
import type { FactTabProps, FactTabsProps } from './factTabs'
import { Timeline } from './Timeline'

/**
 * What one tab opens (#980): its heading (with scripting on) with how sure we are beside it, then
 * its first picture, then the short definition, whose City term is the link to the source (a
 * "Source:" line only when the definition never says it), then the other pictures. A whole tax
 * bill (#1018) goes first and holds all of that in the panel under the City's slice, the other
 * pictures in a softer box of their own.
 */
function FactTabPanel({ heading, definition, fact, panel: allPictures }: FactTabProps) {
  const bill = allPictures.find(
    (item): item is Extract<FactTabProps['panel'][number], { kind: 'billShare' }> =>
      item.kind === 'billShare',
  )
  const panel = allPictures.filter((item) => item.kind !== 'billShare')
  const parts = splitDefinitionAtSource(definition, fact.source)
  const picture = (item: FactTabProps['panel'][number], index: number) =>
    item.kind === 'chart' ? (
      <Chart
        key={index}
        spec={item.spec}
        zoom={item.enlarge}
        numbers="screen-reader"
        heading={index === 0 ? 'screen-reader' : 'visible'}
      />
    ) : item.kind === 'timeline' ? (
      <Timeline key={index} {...item.timeline} className="my-0" />
    ) : null
  const body = (
    <>
      {panel.slice(0, 1).map(picture)}
      {definition && (
        <Text variant="lead">
          {parts
            ? parts.map((part, index) =>
                part.kind === 'link' ? (
                  <Link
                    key={index}
                    href={part.link.href}
                    external={part.link.external}
                    className="font-semibold"
                  >
                    {part.link.label}
                  </Link>
                ) : (
                  <React.Fragment key={index}>{part.text}</React.Fragment>
                ),
              )
            : definition}
        </Text>
      )}
      {!parts && fact.source && (
        <Text variant="small">
          Source:{' '}
          <Link href={fact.source.href} external={fact.source.external}>
            {fact.source.label}
          </Link>
        </Text>
      )}
      {bill ? (
        <div className="space-y-6 rounded-xl bg-surface p-4">
          {panel.slice(1).map((item, index) => picture(item, index + 1))}
        </div>
      ) : (
        panel.slice(1).map((item, index) => picture(item, index + 1))
      )}
    </>
  )
  return (
    <div className="space-y-6">
      {/* Tabs shows its heading only with scripting off; with it on the tab is the title, so this one
          shows then, and the reader always sees the heading the editor wrote, once */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Text variant="subsection" as="h3" className="hidden scripted:block">
          {heading}
        </Text>
        {/* How sure we are, once, beside the heading: the tab button leaves it to screen readers
            (#980) */}
        <div data-panel-certainty aria-hidden="true">
          <CertaintyBadge certainty={fact.certainty} />
        </div>
      </div>
      {/* The explanation a tab leaves out so all the tabs hold the same parts (#707) */}
      {fact.detail && (
        <div data-panel-detail>
          <Text variant="small">{joinLastWords(fact.detail)}</Text>
        </div>
      )}
      {bill ? (
        <BillShare {...bill.billShare}>
          <div className="space-y-6">{body}</div>
        </BillShare>
      ) : (
        body
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
