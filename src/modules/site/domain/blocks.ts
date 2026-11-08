import type { ImageRef, ResolvedLink, RichTextValue } from '@/platform/lib'

/*
 * The plain props of site's page-builder blocks (decision 0013). The mappers in `data/mappers.ts`
 * build them from the stored blocks; the components in `ui/` draw them.
 */

/** How wide a column or section item runs on a large screen, as the editor chose it */
export type LayoutWidth = 'full' | 'threeQuarters' | 'twoThirds' | 'half' | 'oneThird' | 'quarter'

/** The widths a content column offers: the section's, less the quarters */
export type ContentColumnSize = Exclude<LayoutWidth, 'threeQuarters' | 'quarter'>

/** One column of a content block: its text and an optional link button */
export type ContentColumn = {
  size: ContentColumnSize
  body?: RichTextValue
  link?: ResolvedLink
}

/** Cards under an optional section title: a column holding only a heading starts a group */
export type ContentCardGroup = {
  title?: RichTextValue
  cards: ContentColumn[]
}

/**
 * A content block, in one of four layouts the mapper picks from its columns:
 * - `single`: text at a readable width with an accent border (one column, or only full ones)
 * - `columns`: text beside a side card (two columns, not both halves)
 * - `cards`: a surface band of cards, in groups under section titles
 * - `stats`: a surface band of four compact cards
 */
export type ContentBlockProps =
  | { layout: 'single' | 'columns' | 'stats'; columns: ContentColumn[] }
  | { layout: 'cards'; groups: ContentCardGroup[] }

export type ContentLayout = ContentBlockProps['layout']

/** The call-to-action band: its text and its buttons */
export type CallToActionBlockProps = {
  body?: RichTextValue
  links: ResolvedLink[]
}

/** The archive block's own part: an anchor and the editor's intro. The posts come from news. */
export type ArchiveBlockProps = {
  id?: string
  intro?: RichTextValue
}

/**
 * The map block (#764): its text, a small picture and, once an editor has pasted one, the Google
 * map embed address the picture opens. The mapper drops an address that isn't a Google embed.
 */
export type MapBlockProps = {
  title: string
  description: string
  embedUrl?: string
  preview?: ImageRef
}

/** How an item's text lines up inside its column */
export type SectionAlign = 'start' | 'center' | 'end'

/** Where an item sits against the tallest item beside it */
export type SectionVerticalAlign = 'top' | 'center' | 'bottom'

/** Where an item shows on a phone, where the items stack: as listed, above the rest, or below */
export type SectionPhoneOrder = 'inOrder' | 'first' | 'last'

/** One item of a section: its layout, as the editor chose it, and the blocks it holds (`B`) */
export type SectionItem<B> = {
  width: LayoutWidth
  align: SectionAlign
  verticalAlign: SectionVerticalAlign
  phoneOrder: SectionPhoneOrder
  blocks: B[]
}

/**
 * The section block: a row of items that each hold blocks, laid out by the editor's choices
 * instead of by code. The items wrap onto new rows when their widths add up to more than a row.
 */
export type SectionBlockProps<B> = { items: SectionItem<B>[] }
