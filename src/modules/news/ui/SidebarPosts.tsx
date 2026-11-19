import Link from 'next/link'
import React from 'react'

import { Media } from '@/platform/ui/Media'
import { Text } from '@/platform/ui/Text'

import type { PostSummary } from '../domain/types'

/** A titled list of posts for the post page's sidebar, each with a small thumbnail. */
export const SidebarPosts: React.FC<{
  posts: PostSummary[]
  title?: string
}> = ({ posts, title = 'Related Posts' }) => {
  if (posts.length === 0) return null

  return (
    <div>
      <Text variant="label" as="h3" className="mb-4">
        {title}
      </Text>
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={post.href} className="group flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface">
                {post.image ? (
                  <Media
                    resource={post.image}
                    imgClassName="object-cover w-full h-full"
                    fill
                    size="64px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface">
                    <span className="sr-only">No image available</span>
                  </div>
                )}
              </div>
              <span className="text-sm leading-snug font-medium text-foreground group-hover:text-primary">
                {post.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
