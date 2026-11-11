import type { FactTabsBlock } from '@/payload-types'

import type { ChartSpec } from '@/platform/lib/chart/spec'

import { toBillShareProps, type BillShareProps } from './billShare'
import { isEnlargeable, toChartSpec } from './chart'
import { toKeyFactsProps, type KeyFact } from './keyFacts'
import { toTimelineProps, type TimelineProps } from './timeline'

/** The fact tabs block's fields, as stored */
export type StoredFactTabs = Pick<FactTabsBlock, 'tabs'>

/** One picture in a tab's panel, as the page draws it */
export type FactTabPanelItem =
  | { kind: 'chart'; spec: ChartSpec; enlarge: boolean }
  | { kind: 'timeline'; timeline: TimelineProps }
  | { kind: 'billShare'; billShare: BillShareProps }

/** One tab: the key fact that is the button, and what it opens */
export type FactTabProps = {
  fact: KeyFact
  heading: string
  definition: string
  panel: FactTabPanelItem[]
}

/** The fact tabs block's props: plain data (decision 0013) */
export type FactTabsProps = { tabs: FactTabProps[] }

type StoredTab = NonNullable<StoredFactTabs['tabs']>[number]
type StoredPanelItem = NonNullable<StoredTab['panel']>[number]

/**
 * One picture of the panel, or null when there is nothing to draw: a chart that fails its rules
 * was not saved through the editor (the field checks refuse it), so it is left out and logged
 * rather than breaking the post, and a timeline with no milestone, or a bill split with no year, has nothing to show.
 */
function toPanelItem(block: StoredPanelItem): FactTabPanelItem | null {
  if (block.blockType === 'chart') {
    try {
      return { kind: 'chart', spec: toChartSpec(block), enlarge: isEnlargeable(block) }
    } catch (error) {
      console.error(`Fact tabs: chart left out: ${error instanceof Error ? error.message : error}`)
      return null
    }
  }
  if (block.blockType === 'billShare') {
    const billShare = toBillShareProps(block)
    return billShare.years.length > 0 ? { kind: 'billShare', billShare } : null
  }
  const timeline = toTimelineProps(block)
  return timeline.entries.length > 0 ? { kind: 'timeline', timeline } : null
}

/**
 * The stored block as the tabs' props. The key fact is read by `toKeyFactsProps` (so a tab with no
 * value or label is dropped), a chart by `toChartSpec` and a timeline by `toTimelineProps`. A tab
 * with nothing renderable in its panel still has its heading and definition.
 */
export function toFactTabsProps(stored: Partial<StoredFactTabs>): FactTabsProps {
  const tabs = (stored.tabs ?? []).flatMap((tab): FactTabProps[] => {
    const [fact] = toKeyFactsProps({ facts: [tab] }).facts
    if (!fact) return []
    return [
      {
        fact,
        heading: tab.heading?.trim() || fact.label,
        definition: tab.definition?.trim() ?? '',
        panel: (tab.panel ?? []).flatMap((block) => toPanelItem(block) ?? []),
      },
    ]
  })
  return { tabs }
}
