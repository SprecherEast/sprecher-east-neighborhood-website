import 'server-only'

import type {
  ArchiveBlock,
  CallToActionBlock,
  ContentBlock,
  EventsThisWeekBlock,
  FormBlock,
  Header,
  MapBlock,
  MediaBlock,
  Page,
  SectionBlock,
  TopIssuesBlock,
} from '@/payload-types'
import { toGoogleMapsEmbedUrl } from '@/platform/lib/googleMapsEmbed'
import { toImageRef } from '@/platform/payload/imageRef'
import { resolveLink } from '@/platform/payload/resolveLink'

import type {
  ArchiveBlockProps,
  CallToActionBlockProps,
  ContentBlockProps,
  ContentCardGroup,
  ContentColumn,
  ContentLayout,
  MapBlockProps,
  SectionBlockProps,
} from '../domain/blocks'
import type { PageHeroProps } from '../domain/hero'
import { type HeaderNavLink, isHeaderButtonPath } from '../domain/nav'

type StoredColumn = NonNullable<ContentBlock['columns']>[number]
type StoredSize = StoredColumn['size']

/** What news needs to load an archive block's posts: the stored fields, as the editor set them */
export type ArchivePostQuery = Pick<ArchiveBlock, 'populateBy' | 'categories' | 'limit' | 'selectedDocs'>

/** A section of the page: its items hold blocks of the same kind (an interface, so the type can refer to itself) */
export interface SectionLayoutBlock extends SectionBlockProps<PageLayoutBlock> {
  blockType: 'section'
}

/**
 * One block of a page's layout: site's own blocks as plain props (each keeps its `blockType`),
 * and the blocks other modules or `platform/` map as stored (decision 0013, point 4).
 */
export type PageLayoutBlock =
  | (ContentBlockProps & { blockType: 'content' })
  | (CallToActionBlockProps & { blockType: 'cta' })
  | (ArchiveBlockProps & { blockType: 'archive'; postQuery: ArchivePostQuery })
  | (MapBlockProps & { blockType: 'mapBlock' })
  | SectionLayoutBlock
  | FormBlock
  | MediaBlock
  | EventsThisWeekBlock
  | TopIssuesBlock

/**
 * The layout a content block's columns call for, from their sizes. A stored column with no size
 * counts as not full here, as it always has.
 */
export function toContentLayout(sizes: StoredSize[]): ContentLayout {
  const isMultiColumn = sizes.length > 1 && sizes.some((size) => size !== 'full')
  if (!isMultiColumn) return 'single'
  if (sizes.length === 4 && sizes.every((size) => size !== 'full')) return 'stats'
  // Text beside a side card (two-thirds and one-third); two halves are a pair of cards
  if (sizes.length === 2 && sizes.some((size) => size !== 'half')) return 'columns'
  return 'cards'
}

/** A column holding only headings, and no link: a section title over the cards, not a card */
function isTitleOnly({ enableLink, richText }: StoredColumn): boolean {
  const nodes = richText?.root?.children ?? []
  return !enableLink && nodes.length > 0 && nodes.every((node) => node.type === 'heading')
}

function toContentColumn({
  size,
  richText,
  enableLink,
  link,
  linkAlign,
}: StoredColumn): ContentColumn {
  const resolved = enableLink ? resolveLink(link) : null
  return {
    size: size ?? 'full',
    ...(richText && { body: richText }),
    ...(resolved && { link: resolved }),
    ...(resolved && linkAlign === 'end' && { linkAlign }),
  }
}

/** Cards in groups: each title-only column starts a new group under it */
function toCardGroups(columns: StoredColumn[]): ContentCardGroup[] {
  const groups: ContentCardGroup[] = []
  for (const column of columns) {
    if (isTitleOnly(column)) {
      groups.push({ title: column.richText ?? undefined, cards: [] })
    } else if (groups.length === 0) {
      groups.push({ cards: [toContentColumn(column)] })
    } else {
      groups[groups.length - 1].cards.push(toContentColumn(column))
    }
  }
  return groups
}

export function toContentBlockProps({ columns }: Pick<ContentBlock, 'columns'>): ContentBlockProps {
  const stored = columns ?? []
  const layout = toContentLayout(stored.map(({ size }) => size))
  return layout === 'cards'
    ? { layout, groups: toCardGroups(stored) }
    : { layout, columns: stored.map(toContentColumn) }
}

export function toCallToActionBlockProps({
  richText,
  links,
}: Pick<CallToActionBlock, 'richText' | 'links'>): CallToActionBlockProps {
  return {
    ...(richText && { body: richText }),
    links: (links ?? []).flatMap(({ link }) => resolveLink(link) ?? []),
  }
}

export function toArchiveBlockProps({
  id,
  introContent,
}: Pick<ArchiveBlock, 'id' | 'introContent'>): ArchiveBlockProps {
  return {
    ...(id && { id }),
    ...(introContent && { intro: introContent }),
  }
}

/** The map block as plain props: an address that isn't a Google map embed is dropped (#764) */
export function toMapBlockProps({
  title,
  description,
  embedUrl,
  preview,
}: Pick<MapBlock, 'title' | 'description' | 'embedUrl' | 'preview'>): MapBlockProps {
  const safeEmbedUrl = toGoogleMapsEmbedUrl(embedUrl)
  const image = toImageRef(preview)
  return {
    title,
    description,
    ...(safeEmbedUrl && { embedUrl: safeEmbedUrl }),
    ...(image && { preview: image }),
  }
}

/** The section block as plain props: each item's layout and its blocks, mapped like the page's (#884) */
export function toSectionBlockProps({
  items,
}: Pick<SectionBlock, 'items'>): SectionBlockProps<PageLayoutBlock> {
  return {
    items: items.map(({ width, align, verticalAlign, phoneOrder, content }) => ({
      width,
      align,
      verticalAlign,
      phoneOrder,
      blocks: toPageLayout(content ?? []),
    })),
  }
}

/** A page's layout with site's own blocks mapped; a block type the site doesn't know is dropped */
export function toPageLayout(layout: Page['layout']): PageLayoutBlock[] {
  return layout.flatMap((block): PageLayoutBlock[] => {
    switch (block.blockType) {
      case 'content':
        return [{ blockType: 'content', ...toContentBlockProps(block) }]
      case 'cta':
        return [{ blockType: 'cta', ...toCallToActionBlockProps(block) }]
      case 'archive': {
        const { populateBy, categories, limit, selectedDocs } = block
        const postQuery = { populateBy, categories, limit, selectedDocs }
        return [{ blockType: 'archive', ...toArchiveBlockProps(block), postQuery }]
      }
      case 'mapBlock':
        return [{ blockType: 'mapBlock', ...toMapBlockProps(block) }]
      case 'section':
        return [{ blockType: 'section', ...toSectionBlockProps(block) }]
      case 'formBlock':
      case 'mediaBlock':
      case 'eventsThisWeek':
      case 'topIssues':
        return [block]
      default:
        // Old data may hold a block type that no longer exists: it draws nothing, as before
        block satisfies never
        return []
    }
  })
}

const HERO_VARIANTS = { highImpact: 'high', mediumImpact: 'medium', lowImpact: 'low' } as const

/**
 * A page's hero as plain props, or `null` when it draws nothing: type `none`, or a hero with no
 * text, image or links. The low hero draws its text only, so it needs text.
 */
export function toPageHeroProps({
  type,
  richText,
  media,
  links,
}: Page['hero']): PageHeroProps | null {
  if (type === 'none') return null
  const body = richText ?? undefined
  const variant = HERO_VARIANTS[type]
  if (variant === 'low') return body ? { variant, body } : null

  const image = toImageRef(media) ?? undefined
  const resolved = (links ?? []).flatMap(({ link }) => resolveLink(link) ?? [])
  if (!body && !image && resolved.length === 0) return null
  return { variant, ...(body && { body }), ...(image && { image }), links: resolved }
}

/**
 * The header's nav as plain links (decision 0013): each stored link resolved to an address, with
 * the ones that go nowhere and the Contact page (the header has its own button) left out.
 */
export function toHeaderNavLinks({ navItems }: Pick<Header, 'navItems'>): HeaderNavLink[] {
  return (navItems ?? []).flatMap(({ link }) => {
    const resolved = resolveLink(link)
    if (!resolved || isHeaderButtonPath(resolved.href)) return []
    return [{ href: resolved.href, label: resolved.label, external: resolved.external }]
  })
}
