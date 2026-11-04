import type { Block } from 'payload'

import { ChartBlockConfig } from './chartBlockConfig'
import { FACT_TABS_LIMITS } from './editorialLimits'
import { filledText, filledTextarea } from './filledText'
import { factTabsToJsx, importFactTabsTag } from './factTabsMarkdown'
import { keyFactFields } from './keyFactsBlockConfig'
import { TimelineBlockConfig } from './timelineBlockConfig'
import type { StoredFactTabs } from './factTabs'

/**
 * How many rows a list must have, judged on the real save only. Admin asks twice: while the form
 * is built (event `onChange`, where a list is its row count or a half-built row) and on the real
 * save (`submit`). Payload's own `minRows` check would run on every keystroke and leave "at least
 * 2 Tabs" on screen after the second tab was added, so the lists keep `minRows` and `maxRows` for
 * the Add button and judge the count here. A count is not rows: it is read as none.
 */
const rowsBetween =
  (min: number, max: number, noun: string) =>
  (value: unknown, { event }: { event?: unknown }): true | string => {
    if (event === 'onChange') return true
    const rows = Array.isArray(value) ? value.length : 0
    if (rows >= min && rows <= max) return true
    return `Add ${min} to ${max} ${noun}: there ${rows === 1 ? 'is' : 'are'} ${rows}.`
  }

/**
 * Key facts that open pictures (#664): two to four tabs, each a key fact (value, label, icon,
 * how sure, source: the same fields as the key facts block) with a short heading and definition,
 * and a panel of one or two charts or timelines. The panel is a Payload `blocks` field that
 * offers the chart and timeline blocks themselves, so their fields and rules are not repeated:
 * an invalid chart shows its field error inside the tab. Counts come from `FACT_TABS_LIMITS`.
 * The `jsx` converter writes it as one `<FactTabs … />` tag in Markdown, for agents.
 */
export const FactTabsBlockConfig: Block = {
  slug: 'factTabs',
  interfaceName: 'FactTabsBlock',
  labels: { singular: 'Fact tabs', plural: 'Fact tabs' },
  fields: [
    {
      name: 'tabs',
      type: 'array',
      labels: { singular: 'Tab', plural: 'Tabs' },
      admin: {
        description: `${FACT_TABS_LIMITS.minTabs} to ${FACT_TABS_LIMITS.maxTabs} tabs. Readers see each tab's key fact as a button; it opens the heading, definition and pictures you add here.`,
      },
      minRows: FACT_TABS_LIMITS.minTabs,
      maxRows: FACT_TABS_LIMITS.maxTabs,
      required: true,
      validate: rowsBetween(FACT_TABS_LIMITS.minTabs, FACT_TABS_LIMITS.maxTabs, 'tabs'),
      fields: [
        ...keyFactFields(),
        {
          name: 'heading',
          type: 'text',
          required: true,
          maxLength: FACT_TABS_LIMITS.heading,
          validate: filledText('Add the heading for this tab.'),
          admin: { description: 'The name of what this tab opens: "Big-project money".' },
        },
        {
          name: 'definition',
          type: 'textarea',
          required: true,
          maxLength: FACT_TABS_LIMITS.definition,
          validate: filledTextarea('Add a definition: what the key fact means.'),
          admin: {
            description: 'In plain words, what the key fact means and where it comes from.',
          },
        },
        {
          name: 'panel',
          type: 'blocks',
          labels: { singular: 'Picture', plural: 'Pictures' },
          admin: {
            description: `${FACT_TABS_LIMITS.minPanelBlocks} to ${FACT_TABS_LIMITS.maxPanelBlocks} charts or timelines shown when the tab is open.`,
          },
          minRows: FACT_TABS_LIMITS.minPanelBlocks,
          maxRows: FACT_TABS_LIMITS.maxPanelBlocks,
          required: true,
          validate: rowsBetween(
            FACT_TABS_LIMITS.minPanelBlocks,
            FACT_TABS_LIMITS.maxPanelBlocks,
            'pictures',
          ),
          blocks: [ChartBlockConfig, TimelineBlockConfig],
        },
      ],
    },
  ],
  jsx: {
    // Payload types a block's fields loosely; these are the fields declared above
    export: ({ fields }) => factTabsToJsx(fields as StoredFactTabs),
    import: ({ props }) => importFactTabsTag(props),
  },
}
