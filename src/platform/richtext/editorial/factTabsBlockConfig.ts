import type { Block } from 'payload'

import { FIGURES_HELP } from './billFigures'
import { BILL_SHARE_ONCE_MESSAGE, hasTooManyBills } from './billShare'
import { BillShareBlockConfig } from './billShareBlockConfig'
import { ChartBlockConfig } from './chartBlockConfig'
import { FACT_TABS_LIMITS } from './editorialLimits'
import { filledText, filledTextarea } from './filledText'
import { rowsBetween } from './rowCount'
import { factTabsToJsx, importFactTabsTag } from './factTabsMarkdown'
import { keyFactFields } from './keyFactsBlockConfig'
import { TimelineBlockConfig } from './timelineBlockConfig'
import type { StoredFactTabs } from './factTabs'
import { FACT_TABS_BLOCK_TYPE } from './blockTypes'

const countPanel = rowsBetween(
  FACT_TABS_LIMITS.minPanelBlocks,
  FACT_TABS_LIMITS.maxPanelBlocks,
  'pictures',
)
// One to three pictures, and at most one whole tax bill
const validatePanel = (value: unknown, args: { event?: unknown }): true | string => {
  const rows = countPanel(value, args)
  if (rows !== true) return rows
  const types = Array.isArray(value)
    ? value.map((row) => (row as { blockType?: unknown }).blockType)
    : []
  return hasTooManyBills(types) ? BILL_SHARE_ONCE_MESSAGE : true
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
  slug: FACT_TABS_BLOCK_TYPE,
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
        ...keyFactFields({ figures: true }),
        {
          name: 'heading',
          type: 'text',
          required: true,
          maxLength: FACT_TABS_LIMITS.heading,
          validate: filledText('Add the heading for this tab.'),
          admin: {
            description: `The name of what this tab opens: "Big-project money". ${FIGURES_HELP}`,
          },
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
            description: `${FACT_TABS_LIMITS.minPanelBlocks} to ${FACT_TABS_LIMITS.maxPanelBlocks} charts, timelines or a whole tax bill shown when the tab is open.`,
          },
          minRows: FACT_TABS_LIMITS.minPanelBlocks,
          maxRows: FACT_TABS_LIMITS.maxPanelBlocks,
          required: true,
          validate: validatePanel,
          blocks: [ChartBlockConfig, TimelineBlockConfig, BillShareBlockConfig],
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
