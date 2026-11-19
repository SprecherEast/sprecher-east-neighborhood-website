import React from 'react'

import { Badge, BadgeList } from '@/platform/ui/Badge'
import { DateTime } from '@/platform/ui/DateTime'
import type { MetaBarItem } from '@/platform/ui/MetaBar'
import type { PageHeaderProps } from '@/platform/ui/PageHeader'

import { formatAuthors } from '../domain/authors'
import type { PostDetail } from '../domain/types'

/**
 * A post's author and date (#774, #1055): the facts the page draws as its `MetaBar` (#1002), at the
 * right of the article column. The date is the compact one ("Nov 3"), so the row stays on one line;
 * a long author name is cut by the bar and keeps its full text as the value's title. The source is
 * not shown here.
 */
export function postByline(post: PostDetail): MetaBarItem[] {
  const { publishedAt } = post
  const authors = formatAuthors(post.authors)
  return [
    ...(authors ? [{ label: 'Author', value: authors, title: authors }] : []),
    ...(publishedAt ? [{ label: 'Published', value: <DateTime value={publishedAt} /> }] : []),
  ]
}

/**
 * The top of a post's page as `PageHeader` props (#461): its categories and title on a plain
 * band, whether or not it has a picture, which `FeaturedImage` shows in the article (#1013). The
 * author, date and source are `postByline`, above the article text (#774).
 */
export function postHeaderProps(post: PostDetail): PageHeaderProps {
  const { backdrop, categories, title } = post
  const eyebrow =
    categories.length > 0 ? (
      <BadgeList plated={Boolean(backdrop)}>
        {categories.map((category) => (
          <Badge key={category.id} variant="category">
            {category.title}
          </Badge>
        ))}
      </BadgeList>
    ) : undefined

  return { variant: 'band', eyebrow, title, backdrop }
}
