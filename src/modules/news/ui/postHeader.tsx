import { ExternalLink } from 'lucide-react'
import React from 'react'

import { Link } from '@/platform/ui/Link'
import { Badge, BadgeList } from '@/platform/ui/Badge'
import { DateTime } from '@/platform/ui/DateTime'
import type { LabelledMetaItem } from '@/platform/ui/MetaList'
import type { PageHeaderProps } from '@/platform/ui/PageHeader'

import { formatAuthors } from '../domain/authors'
import type { PostDetail, PostSource } from '../domain/types'

/**
 * Where the news came from (#483): the source's name, linking to the original in a new tab when
 * the post has a link, in the site's link color.
 */
function SourceValue({ source }: { source: PostSource }) {
  if (!source.url) return source.name

  // The icon stays with the name's last word, so a wrapped name never leaves it on a line alone
  const split = source.name.lastIndexOf(' ') + 1
  return (
    <Link href={source.url} external>
      {source.name.slice(0, split)}
      <span className="whitespace-nowrap">
        {source.name.slice(split)}
        <ExternalLink aria-hidden="true" className="ml-1 inline align-[-0.125em]" />
      </span>
    </Link>
  )
}

/**
 * A post's author, date and source (#774): the facts the page puts as the first row of the article
 * column, right-aligned from `lg`, so they sit on the text's right edge and not in the header.
 */
export function postByline(post: PostDetail): LabelledMetaItem[] {
  const { publishedAt, source } = post
  const authors = formatAuthors(post.authors)
  return [
    ...(authors ? [{ label: 'Author', value: authors }] : []),
    ...(publishedAt
      ? [{ label: 'Date Published', value: <DateTime value={publishedAt} format="long" /> }]
      : []),
    ...(source ? [{ label: 'Source', value: <SourceValue source={source} /> }] : []),
  ]
}

/**
 * The top of a post's page as `PageHeader` props (#461): its categories and title on a plain
 * band, whether or not it has a picture, which `FeaturedImage` shows in the article (#1013). The
 * author, date and source are `postByline`, above the article text (#774).
 */
export function postHeaderProps(post: PostDetail): PageHeaderProps {
  const { categories, title } = post
  const eyebrow =
    categories.length > 0 ? (
      <BadgeList>
        {categories.map((category) => (
          <Badge key={category.id} variant="category">
            {category.title}
          </Badge>
        ))}
      </BadgeList>
    ) : undefined

  return { variant: 'band', eyebrow, title }
}
