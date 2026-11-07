import type { ImageRef, ResolvedLink, RichTextValue } from '@/platform/lib'

/*
 * The plain props of site's page-builder blocks (decision 0013). The mappers in `data/mappers.ts`
 * build them from the stored blocks; the components in `ui/` draw them.
 */

/** How wide a content column runs on a large screen, as the editor chose it */
export type ContentColumnSize = 'full' | 'half' | 'oneThird' | 'twoThirds'

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
