import type { Block } from 'payload'

import { articleEditor } from '@/platform/payload/headingsEditor'

import { SECTION_TABS_BLOCK_TYPE } from './blockTypes'
import { DiagramKeyBlockConfig } from './diagramKeyBlockConfig'
import { SECTION_TABS_LIMITS } from './editorialLimits'
import { filledText } from './filledText'
import { FigureBlockConfig } from './figureBlockConfig'
import { KeyFactsBlockConfig } from './keyFactsBlockConfig'
import { OutcomeForkBlockConfig } from './outcomeForkBlockConfig'
import { rowsBetween } from './rowCount'
import { importSectionTabsTag, sectionTabsToJsx } from './sectionTabsMarkdown'
import type { StoredSectionTabs } from './sectionTabs'
import { StepsBlockConfig } from './stepsBlockConfig'
import { TimelineBlockConfig } from './timelineBlockConfig'

/**
 * The blocks a tab's content may hold, besides text: the article's own, as the blocks themselves,
 * so their fields and rules are not repeated. Not another section tabs block (tabs in tabs), and
 * not fact tabs or a chart, which are made to stand in the article.
 */
export const SECTION_PANEL_BLOCKS: Block[] = [
  TimelineBlockConfig,
  StepsBlockConfig,
  KeyFactsBlockConfig,
  OutcomeForkBlockConfig,
  DiagramKeyBlockConfig,
  FigureBlockConfig,
]

/** Headings in a tab sit under the tab's own name (an h2), so they start at h3 */
const PANEL_HEADINGS = ['h3', 'h4'] as const

/**
 * An article split into tabs of ordinary content (#1333): two to four tabs, each a short label and
 * a panel that is a rich-text field of its own, offering the article's text and the blocks in
 * `SECTION_PANEL_BLOCKS`. Counts come from `SECTION_TABS_LIMITS`. The `jsx` converter writes it as
 * `<SectionTabs>` holding one `<Tab label="…">` per tab, each with its content as Markdown, for
 * agents.
 */
export const SectionTabsBlockConfig: Block = {
  slug: SECTION_TABS_BLOCK_TYPE,
  interfaceName: 'SectionTabsBlock',
  labels: { singular: 'Section tabs', plural: 'Section tabs' },
  fields: [
    {
      name: 'tabs',
      type: 'array',
      labels: { singular: 'Tab', plural: 'Tabs' },
      admin: {
        description: `${SECTION_TABS_LIMITS.minTabs} to ${SECTION_TABS_LIMITS.maxTabs} tabs. Readers see each label as a button; it opens the content you write here, directly under the buttons. Put the introduction and the top picture above the block, not in a tab.`,
      },
      minRows: SECTION_TABS_LIMITS.minTabs,
      maxRows: SECTION_TABS_LIMITS.maxTabs,
      required: true,
      validate: rowsBetween(SECTION_TABS_LIMITS.minTabs, SECTION_TABS_LIMITS.maxTabs, 'tabs'),
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          maxLength: SECTION_TABS_LIMITS.label,
          validate: filledText('Add a short name for this tab.'),
          admin: { description: 'One short word or two on the button: "The plan".' },
        },
        {
          name: 'panel',
          type: 'richText',
          required: true,
          editor: articleEditor(SECTION_PANEL_BLOCKS, [...PANEL_HEADINGS]),
          admin: {
            description:
              'What the tab opens: text, pictures and the blocks an article uses. Without scripts every tab shows one after another.',
          },
        },
      ],
    },
  ],
  jsx: {
    // Payload types a block's fields loosely; these are the fields declared above
    export: ({ fields, lexicalToMarkdown }) =>
      sectionTabsToJsx(fields as StoredSectionTabs, lexicalToMarkdown),
    import: ({ children, props, markdownToLexical }) =>
      importSectionTabsTag({ children, props, markdownToLexical }) as unknown as ReturnType<
        NonNullable<Block['jsx']>['import']
      >,
  },
}
