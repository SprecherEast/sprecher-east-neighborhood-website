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
 * the post has a link, in the site's link color: the facts sit on the page, not on the photo (#571).
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
 * The top of a post's page as `PageHeader` props (#461): its categories, title, byline, date and
 * source, on its hero photo (`image`), or plain (`default`) when it has none.
 */
export function postHeaderProps(post: PostDetail): PageHeaderProps {
  const { categories, heroImage, publishedAt, source, title } = post
  const byline = formatAuthors(post.authors)
  const facts: LabelledMetaItem[] = [
    ...(byline ? [{ label: 'Author', value: byline }] : []),
    ...(publishedAt
      ? [{ label: 'Date Published', value: <DateTime value={publishedAt} format="long" /> }]
      : []),
    ...(source ? [{ label: 'Source', value: <SourceValue source={source} /> }] : []),
  ]
  const badge = heroImage ? 'on-image' : 'category'
  const eyebrow =
    categories.length > 0 ? (
      <BadgeList>
        {categories.map((category) => (
          <Badge key={category.id} variant={badge}>
            {category.title}
          </Badge>
        ))}
      </BadgeList>
    ) : undefined

  return heroImage
    ? { variant: 'image', image: heroImage, eyebrow, title, facts }
    : { eyebrow, title, facts }
}
