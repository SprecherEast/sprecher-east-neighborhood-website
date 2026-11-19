import React from 'react'

import { Media } from '@/platform/ui/Media'
import { Badge } from '@/platform/ui/Badge'
import { CancelledBadge } from '@/platform/ui/CancelledBadge'
import { Card, CardBody, CardMedia, CardMeta, CardTitle } from '@/platform/ui/Card'
import { DateTime } from '@/platform/ui/DateTime'
import { Text } from '@/platform/ui/Text'

import type { PostSummary } from '../domain/types'

/**
 * A post in a grid: share image or a branded placeholder, date, categories, title, summary, and
 * where the news came from. The source is plain text, so the card keeps one tap target, its
 * stretched title link; the post page links the source (#483).
 */
export const PostCard: React.FC<{
  post: PostSummary
  /** `h2` where nothing on the page heads the list (`/posts`, search) */
  headingLevel?: 'h2' | 'h3'
}> = ({ post, headingLevel = 'h3' }) => {
  const { href, cancelled, categories, description, image, publishedAt, source, title } = post

  const hasCategories = categories.length > 0
  const sanitizedDescription = description?.replace(/\u00A0/g, ' ') // non-breaking spaces to spaces

  return (
    <Card as="article" padding="none" interactive>
      <CardMedia>
        {image ? (
          <Media
            className="h-full"
            pictureClassName="h-full"
            resource={image}
            size="33vw"
            imgClassName="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-light">
            <div className="flex flex-col items-center gap-1 opacity-20" aria-hidden="true">
              <span className="text-lg font-bold tracking-tight text-primary-foreground italic">
                Sprecher
              </span>
              <span className="text-sm font-medium tracking-widest text-primary-foreground/80 uppercase">
                East
              </span>
            </div>
          </div>
        )}
      </CardMedia>
      <CardBody>
        {(publishedAt || hasCategories) && (
          <CardMeta className="mb-3">
            {publishedAt && <DateTime value={publishedAt} className="text-xs font-medium" />}
            {hasCategories && publishedAt && (
              <span className="text-muted-foreground/40" aria-hidden="true">
                &middot;
              </span>
            )}
            {categories.map((category) => (
              <Badge key={category.id}>{category.title}</Badge>
            ))}
          </CardMeta>
        )}
        {title && (
          <CardTitle as={headingLevel} href={href}>
            {/* Inside the title's link, so it reads "Cancelled: <title>", as event cards do (#471) */}
            {cancelled && (
              <>
                <span className="mb-1.5 flex">
                  <CancelledBadge />
                </span>
                <span className="sr-only">:</span>{' '}
              </>
            )}
            {title}
          </CardTitle>
        )}
        {description && (
          <Text variant="small" clamp={2} className="mt-2">
            {sanitizedDescription}
          </Text>
        )}
        {source && (
          <Text variant="small" clamp={2} className="mt-3 text-xs">
            Source: {source.name}
          </Text>
        )}
      </CardBody>
    </Card>
  )
}
