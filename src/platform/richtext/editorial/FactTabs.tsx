import React from 'react'

import { cn } from '@/platform/lib/cn'
import { joinLastWords } from '@/platform/lib/joinLastWords'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Chart } from '@/platform/ui/chart/Chart'
import { Link } from '@/platform/ui/Link'
import { Tabs, type TabsItem } from '@/platform/ui/Tabs.client'
import { Text } from '@/platform/ui/Text'

import { BillFiguresProvider, FilledText } from './BillFigures.client'
import { BillShare } from './BillShare.client'
import { fillFigures, initialFigures, splitBillPanel } from './billFigures'
import { splitDefinitionAtSource } from './definitionWithSource'
import { FactCard } from './FactCard'
import type { FactTabProps, FactTabsProps } from './factTabs'
import { tabAnchors } from './tabAnchors'
import { Timeline } from './Timeline'

/**
 * What one tab opens (#980): its heading (with scripting on) with how sure we are beside it, then
 * its first picture, then the short definition, whose City term is the link to the source (a
 * "Source:" line only when the definition never says it), then the other pictures. A whole tax
 * bill (#1018, #1111) goes first, in its own order (`BillShare`): the answer, the whole bill, then
 * three closed rows that hold the City's charts (they follow the home value typed, #1020), the text
 * with its detail and the sources, and the other pictures in a softer box of their own.
 */
function FactTabPanel({
  tabId,
  heading,
  definition,
  fact,
  panel: allPictures,
}: FactTabProps & { tabId: string }) {
  const { bill, cityBars, cityBreakdown, rest } = splitBillPanel(allPictures)
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
  const text = (
    <>
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
    </>
  )
  // With a whole tax bill the bill block takes both charts: the breakdown is drawn again for the
  // home typed, and the chart by year gives the answer card its tax and increase (#1020, #1144)
  const body = (
    <>
      {!bill && rest.slice(0, 1).map(picture)}
      {text}
      {rest.slice(bill ? 0 : 1).map((item, index) => picture(item, index + (bill ? 0 : 1)))}
    </>
  )
  return (
    <div className={cn('space-y-6', bill && 'space-y-3')}>
      {/* Tabs shows its heading only with scripting off; with it on the tab is the title, so this one
          shows then, and the reader always sees the heading the editor wrote, once */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Text variant="subsection" as="h3" className="hidden scripted:block">
          <FilledText tab={tabId} text={heading} />
        </Text>
        {/* The tab's figure and how sure we are, once, with the heading (below it on a narrow phone): the button shows only its
            label and leaves both to screen readers (#980, #1112). A whole tax bill shows them in its
            answer card instead (#1111) */}
        {!bill && (
          <>
            <Text variant="subsection" as="p">
              <span data-panel-figure>
                <FilledText tab={tabId} text={fact.value} keepLastWords />
              </span>
            </Text>
            <div data-panel-certainty aria-hidden="true">
              <CertaintyBadge certainty={fact.certainty} />
            </div>
          </>
        )}
      </div>
      {/* The explanation a tab leaves out so all the tabs hold the same parts (#707); a whole tax
          bill keeps it in its row on how the estimate works */}
      {fact.detail && !bill && (
        <div data-panel-detail>
          <Text variant="small">{joinLastWords(fact.detail)}</Text>
        </div>
      )}
      {bill ? (
        <BillShare
          {...bill.billShare}
          tabId={tabId}
          cityBars={cityBars}
          cityBreakdown={cityBreakdown}
          definition={definition && <Text variant="small">{definition}</Text>}
          detail={
            fact.detail && (
              <div data-panel-detail>
                <Text variant="small">{joinLastWords(fact.detail)}</Text>
              </div>
            )
          }
          certainty={fact.certainty}
          source={fact.source}
        >
          {rest.length > 0 && (
            <div className="space-y-6 rounded-xl bg-surface p-4">
              {rest.map((item, index) => picture(item, index + 1))}
            </div>
          )}
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
  // The City's figures for the average home, per tab, written by the server so nothing flashes wrong
  const initial = Object.fromEntries(
    tabs.map((tab, index) => [`tab-${index}`, initialFigures(tab.panel)]),
  )
  // Each tab has a link of its own, named from its label (#1097)
  const anchors = tabAnchors(tabs.map((tab) => tab.fact.label))
  const items: TabsItem[] = tabs.map((tab, index) => {
    const tabId = `tab-${index}`
    return {
      value: tabId,
      anchor: anchors[index],
      trigger: <FactCard fact={tab.fact} variant="tab" tabId={tabId} />,
      // Read with scripting off, where nothing can follow a typed value: the average home's
      heading: fillFigures(tab.heading, initial[tabId]),
      panel: <FactTabPanel {...tab} tabId={tabId} />,
    }
  })
  return (
    <BillFiguresProvider initial={initial}>
      <Tabs
        label="Key facts"
        items={items}
        defaultValue="tab-0"
        className={cn('not-prose my-8 w-full', className)}
      />
    </BillFiguresProvider>
  )
}
