import React from 'react'

import type { RichTextValue } from '@/platform/lib'
import type { SectionTabsBlock as StoredSectionTabs } from '@/payload-types'

import { SectionTabs } from './editorial/SectionTabs'
import { toSectionTabsProps } from './editorial/sectionTabs'
import { RichText, type RichTextBlocks } from './RichText'

/*
 * How a tab's content sits in its panel. The panel's own padding is the only space around it, so the
 * first and last block lose their outer margin, which a flow-root box does not collapse. A
 * picture floats right from `md` (the shared `Figure`): text wraps beside it, and every other
 * block (a key, a timeline, a row of cards) is a box of its own that takes the room left beside the
 * picture, instead of running under it, as `ArticlePage` does for the article's picture.
 */
const PANEL_CONTENT =
  '[&>:first-child]:mt-0 [&>:last-child]:mb-0 md:[&>:not(p,h3,h4,ul,ol,figure)]:flow-root'

/**
 * The editor's "Section tabs" block (#1333): each tab's content is rich text of its own, drawn by
 * `RichText` with the same block renderers as the article (passed in, so this imports no block,
 * #135) and the article's heading ids (`anchorSource`), so the page menu's links reach a heading in
 * any tab.
 */
export function SectionTabsBlock({
  className,
  blocks,
  anchorSource,
  ...stored
}: Partial<StoredSectionTabs> & {
  className?: string
  blocks: RichTextBlocks
  anchorSource?: RichTextValue
}) {
  const { tabs } = toSectionTabsProps(stored)
  return (
    <SectionTabs
      className={className}
      tabs={tabs.map(({ label, panel }) => ({
        label,
        content: (
          <RichText
            data={panel}
            blocks={blocks}
            anchorSource={anchorSource ?? panel}
            enableGutter={false}
            className={PANEL_CONTENT}
          />
        ),
      }))}
    />
  )
}
