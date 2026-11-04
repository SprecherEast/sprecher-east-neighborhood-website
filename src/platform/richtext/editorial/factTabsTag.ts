import { z } from 'zod'

import { describeChartIssues, type ChartIssue } from '@/platform/lib/chart/issues'
import { CERTAINTIES } from '@/platform/lib/certainty'
import { LINK_ADDRESS_HINT } from '@/platform/lib/linkAddress'

import { chartFromProps, chartSpecTagProps, chartTagIssues } from './chartMarkdown'
import { EDITORIAL_LINK_MAX_LENGTH, isEditorialLinkUrl } from './editorialLink'
import {
  FACT_TABS_LIMITS,
  KEY_FACT_LIMITS,
  LINK_LABEL_MAX,
  TIMELINE_LIMITS,
} from './editorialLimits'
import { refusalPrefix } from './editorialTag'
import { FACT_ICONS } from './factIcons'
import type { FactTabProps, StoredFactTabs } from './factTabs'
import { hasTooManyNextUp, NEXT_UP_MESSAGE, TIMELINE_STATUSES } from './timelineStatus'

/**
 * What a `<FactTabs tabs={[…]} />` tag holds (#664): one list of tabs as plain JSON, each a key
 * fact (`value`, `label`, `icon`, `certainty`, an optional `link`), a `heading`, a `definition` and
 * a `panel` of `{"block":"chart", …the <Chart> props}` and `{"block":"timeline","entries":[…]}`.
 * The checks are the editor's: the limits are `editorialLimits`, a chart is judged by the chart
 * rules, and a link address by the one rule in `linkAddress.ts`. Every reason is listed.
 */

const text = (max: number) => z.string().trim().min(1).max(max)
const link = z.strictObject({
  label: text(LINK_LABEL_MAX),
  href: text(EDITORIAL_LINK_MAX_LENGTH).refine(isEditorialLinkUrl, { message: LINK_ADDRESS_HINT }),
})
const entry = z.strictObject({
  date: text(TIMELINE_LIMITS.date),
  status: z.enum(TIMELINE_STATUSES),
  title: text(TIMELINE_LIMITS.title),
  description: text(TIMELINE_LIMITS.description).optional(),
  link: link.optional(),
})
const timelinePicture = z.strictObject({
  block: z.literal('timeline'),
  entries: z.array(entry).min(TIMELINE_LIMITS.minEntries).max(TIMELINE_LIMITS.maxEntries),
})
// The chart's own rules judge the rest of the object (`chartTagIssues`)
const chartPicture = z.looseObject({ block: z.literal('chart') })

const tab = z.strictObject({
  value: text(KEY_FACT_LIMITS.value),
  label: text(KEY_FACT_LIMITS.label),
  icon: z.enum(Object.keys(FACT_ICONS) as [keyof typeof FACT_ICONS]),
  certainty: z.enum(CERTAINTIES),
  link: link.optional(),
  heading: text(FACT_TABS_LIMITS.heading),
  definition: text(FACT_TABS_LIMITS.definition),
  panel: z
    .array(z.discriminatedUnion('block', [chartPicture, timelinePicture]))
    .min(FACT_TABS_LIMITS.minPanelBlocks)
    .max(FACT_TABS_LIMITS.maxPanelBlocks),
})
const tabs = z.array(tab).min(FACT_TABS_LIMITS.minTabs).max(FACT_TABS_LIMITS.maxTabs)

type Tab = z.infer<typeof tab>
type Picture = Tab['panel'][number]

const nextUpIssues = (picture: Picture, path: (string | number)[]): ChartIssue[] =>
  picture.block === 'timeline' && hasTooManyNextUp(picture.entries.map((e) => e.status))
    ? [{ path: [...path, 'entries'], message: NEXT_UP_MESSAGE }]
    : []

/** The chart rules for the charts of a panel, with each reason placed at its tab and picture */
function chartIssuesOf(parsed: Tab[]): ChartIssue[] {
  return parsed.flatMap((t, i) =>
    t.panel.flatMap((picture, j) => {
      const path = ['tabs', i, 'panel', j]
      if (picture.block !== 'chart') return nextUpIssues(picture, path)
      const { block: _block, ...props } = picture
      return chartTagIssues(props).map((issue) => ({ ...issue, path: [...path, ...issue.path] }))
    }),
  )
}

const fromEntry = (e: z.infer<typeof entry>) => ({
  date: e.date,
  status: e.status,
  title: e.title,
  description: e.description,
  linkLabel: e.link?.label,
  linkUrl: e.link?.href,
})

/** The block's fields for a tag's `tabs`. Throws `Invalid <FactTabs>: …` with every reason. */
export function factTabsFromTag(input: unknown): StoredFactTabs {
  const result = tabs.safeParse(input)
  const issues: ChartIssue[] = result.success
    ? chartIssuesOf(result.data)
    : result.error.issues.map(({ path, message }) => ({
        path: ['tabs', ...path.filter((part): part is string | number => typeof part !== 'symbol')],
        message,
      }))
  if (!result.success || issues.length > 0) {
    throw new Error(`${refusalPrefix('FactTabs')} ${describeChartIssues(issues)}`)
  }
  // A chart is stored as `StoredChart` (every field optional, checked by the rules above)
  return {
    tabs: result.data.map((t) => ({
      value: t.value,
      label: t.label,
      icon: t.icon,
      certainty: t.certainty,
      linkLabel: t.link?.label,
      linkUrl: t.link?.href,
      heading: t.heading,
      definition: t.definition,
      panel: t.panel.map((picture) => {
        if (picture.block === 'timeline') {
          return { blockType: 'timeline' as const, entries: picture.entries.map(fromEntry) }
        }
        const { block: _block, ...props } = picture
        return { blockType: 'chart' as const, ...chartFromProps(props) }
      }),
    })),
  } as StoredFactTabs
}

/** The tag's `tabs` for tabs as the page draws them, in the order the tag writes them */
export const factTabsToTag = (props: readonly FactTabProps[]) =>
  props.map(({ fact, heading, definition, panel }) => ({
    value: fact.value,
    label: fact.label,
    icon: fact.icon,
    certainty: fact.certainty,
    ...(fact.source ? { link: { label: fact.source.label, href: fact.source.href } } : {}),
    heading,
    definition,
    panel: panel.map((item) =>
      item.kind === 'chart'
        ? { block: 'chart', ...chartSpecTagProps(item.spec) }
        : {
            block: 'timeline',
            entries: item.timeline.entries.map(({ date, status, title, description, link }) => ({
              date,
              status,
              title,
              ...(description ? { description } : {}),
              ...(link ? { link: { label: link.label, href: link.href } } : {}),
            })),
          },
    ),
  }))
