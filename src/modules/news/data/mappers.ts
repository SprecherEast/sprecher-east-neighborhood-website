import 'server-only'

import type { ArchiveBlock, Post, Search, TopIssuesBlock } from '@/payload-types'
import { isHttpUrl } from '@/platform/lib/reviewQueue'
import { documentHref } from '@/platform/payload/documentHref'
import { toImageRef } from '@/platform/payload/imageRef'
import { resolveLink } from '@/platform/payload/resolveLink'

import {
  isSafeHref,
  TOP_ISSUES_DEFAULT_HEADING,
  TOP_ISSUES_LIMITS,
  type TopIssue,
  type TopIssuesBlockProps,
} from '../domain/topIssues'
import type { PostCategory, PostDetail, PostSource, PostSummary } from '../domain/types'

/** The fields `toPostSummary` reads; queries for summaries select exactly these. */
export const SUMMARY_FIELDS = {
  title: true,
  slug: true,
  categories: true,
  publishedAt: true,
  meta: true,
  sourceName: true,
  sourceUrl: true,
} as const

type SummaryDoc = Pick<Post, 'id' | keyof typeof SUMMARY_FIELDS>

const toCategory = (id: number, title: string | null | undefined): PostCategory => ({
  id,
  title: title || 'Untitled category',
})

/** The loaded categories; a category that is only an id (not loaded) is left out. */
function toCategories(values: Post['categories']): PostCategory[] {
  return (values ?? []).flatMap((category) =>
    typeof category === 'object' ? [toCategory(category.id, category.title)] : [],
  )
}

/**
 * Where a post's news came from (#483). The link is kept only when it's an absolute http(s)
 * address: the field checks that on save, but older or imported data is never trusted to render
 * as a link. A link without a name is named by its host; with neither, the post has no source.
 */
function toPostSource(
  name: string | null | undefined,
  url: string | null | undefined,
): PostSource | null {
  const link = isHttpUrl(url) ? url : null
  const label = name?.trim() || (link ? new URL(link).hostname : '')
  return label ? { name: label, url: link } : null
}

/** A post document as a card or sidebar item shows it. */
export function toPostSummary(doc: SummaryDoc): PostSummary {
  return {
    id: doc.id,
    slug: doc.slug,
    href: documentHref('posts', doc.slug),
    title: doc.title,
    publishedAt: doc.publishedAt ?? null,
    categories: toCategories(doc.categories),
    description: doc.meta?.description ?? null,
    image: toImageRef(doc.meta?.image),
    source: toPostSource(doc.sourceName, doc.sourceUrl),
  }
}

/**
 * A post document as its own page shows it. Related posts the reader may not see come back
 * from Payload as ids only, so only the loaded ones are kept.
 */
export function toPostDetail(doc: Post): PostDetail {
  return {
    ...toPostSummary(doc),
    heroImage: toImageRef(doc.heroImage),
    content: doc.content,
    authors: (doc.populatedAuthors ?? []).flatMap(({ name }) => (name ? [name] : [])),
    relatedPosts: (doc.relatedPosts ?? []).flatMap((related) =>
      typeof related === 'object' ? [toPostSummary(related)] : [],
    ),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    meta: {
      title: doc.meta?.title ?? null,
      description: doc.meta?.description ?? null,
      image: toImageRef(doc.meta?.image),
    },
  }
}

/** The stored archive block as the use case reads it: how it fills, its categories, limit and picks (#617). */
export type StoredArchiveBlock = Pick<
  ArchiveBlock,
  'populateBy' | 'categories' | 'limit' | 'selectedDocs'
>

/** The ids of a relationship to categories, whether each category is loaded or not. */
export function toCategoryIds(values: ArchiveBlock['categories'] | undefined): number[] {
  return (values ?? []).map((category) => (typeof category === 'object' ? category.id : category))
}

/** The posts an editor picked for an archive block, leaving out those the reader may not see. */
export function toPickedPosts(selected: ArchiveBlock['selectedDocs'] | undefined): PostSummary[] {
  return (selected ?? []).flatMap(({ value }) =>
    typeof value === 'object' ? [toPostSummary(value)] : [],
  )
}

/** The fields `toSearchResult` reads; the search query selects exactly these. */
export const SEARCH_RESULT_FIELDS = {
  doc: true,
  title: true,
  slug: true,
  categories: true,
  meta: true,
  cancelled: true,
  sourceName: true,
  sourceUrl: true,
} as const

/**
 * A search entry (a post or an event, as the search plugin copied it) as a post card shows it,
 * linking to the post's or the event's own page (#200). The entry keeps no date, and its
 * categories are copies with the category's id as text. An entry without a slug has no page to
 * link to, so it gives `null`.
 */
export function toSearchResult(
  doc: Pick<Search, 'id' | keyof typeof SEARCH_RESULT_FIELDS>,
): PostSummary | null {
  if (!doc.slug) return null
  return {
    // The search entry's id, not a post's: the entry may be an event (#200). Don't use it to
    // exclude or deduplicate posts.
    id: doc.id,
    slug: doc.slug,
    href: documentHref(doc.doc.relationTo, doc.slug),
    title: doc.title ?? '',
    publishedAt: null,
    categories: (doc.categories ?? []).map(({ categoryID, title }) =>
      toCategory(Number(categoryID), title),
    ),
    description: doc.meta?.description ?? null,
    image: toImageRef(doc.meta?.image),
    source: toPostSource(doc.sourceName, doc.sourceUrl),
    cancelled: doc.cancelled === true,
  }
}

type StoredIssue = TopIssuesBlock['items'][number]

/**
 * One stored issue as it draws, or `null` when it has no title or nowhere safe to go: a post or
 * page the reader may not see (Payload leaves its id unpopulated) or that was deleted, or a custom
 * URL that is neither http(s) nor a path on this site.
 */
function toTopIssue({ title, summary, link }: StoredIssue): TopIssue | null {
  const text = title?.trim()
  const resolved = resolveLink(link)
  if (!text || !resolved || !isSafeHref(resolved.href)) return null
  return {
    title: text,
    summary: summary?.trim() || null,
    link: { href: resolved.href, external: resolved.external },
  }
}

/**
 * "Top issues" as it draws (#484), from the stored block: the issues that can be shown, in the
 * editor's order, at most five. With none left the block draws nothing, so this gives `null`.
 */
export function toTopIssuesBlockProps({
  id,
  heading,
  reviewedAt,
  items,
}: Pick<TopIssuesBlock, 'id' | 'heading' | 'reviewedAt' | 'items'>): TopIssuesBlockProps | null {
  const shown = (items ?? [])
    .flatMap((item) => toTopIssue(item) ?? [])
    .slice(0, TOP_ISSUES_LIMITS.items.max)
  if (shown.length === 0) return null
  return {
    ...(id && { id }),
    heading: heading?.trim() || TOP_ISSUES_DEFAULT_HEADING,
    reviewedAt: reviewedAt ?? null,
    items: shown,
  }
}
