import type { SectionTabsBlock } from '@/payload-types'

import type { RichTextValue } from '@/platform/lib'

import { lexicalRoot } from '../lexicalTree'

/** The section tabs block's fields, as stored */
export type StoredSectionTabs = Partial<Pick<SectionTabsBlock, 'tabs'>>

/** One tab: the label on its button and the article content it opens, as stored rich text */
export type SectionTabProps = { label: string; panel: RichTextValue }

/** The section tabs block's props: plain data (decision 0013) */
export type SectionTabsProps = { tabs: SectionTabProps[] }

/**
 * Whether a tab's content has a picture directly followed by another block (a key, a timeline, a
 * card row): the two then sit side by side as one row of equal height, instead of the block
 * running beside a floated picture and leaving blank room under whichever is shorter (#1333).
 */
export function pairsFigureWithBlock(panel: RichTextValue | null | undefined): boolean {
  const children = lexicalRoot(panel)?.children ?? []
  const blockType = (node: (typeof children)[number] | undefined) =>
    node?.type === 'block' ? node.fields?.blockType : undefined
  return children.some(
    (node, index) =>
      blockType(node) === 'figure' &&
      blockType(children[index + 1]) !== undefined &&
      blockType(children[index + 1]) !== 'figure',
  )
}

/**
 * The stored block as the tabs' props. A tab with no label would be a blank button and a tab with
 * no content an empty box, so both are left out (a draft may hold them: Payload skips validation
 * for drafts).
 */
export function toSectionTabsProps(stored: StoredSectionTabs): SectionTabsProps {
  const tabs = (stored.tabs ?? []).flatMap((tab): SectionTabProps[] => {
    const label = tab.label?.trim()
    const panel = tab.panel as RichTextValue | null | undefined
    const hasContent = (lexicalRoot(panel)?.children?.length ?? 0) > 0
    return label && panel && hasContent ? [{ label, panel }] : []
  })
  return { tabs }
}
