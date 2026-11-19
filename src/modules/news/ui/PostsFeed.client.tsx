'use client'

import React from 'react'

import { EmptyState } from '@/platform/ui/EmptyState'
import { LoadMoreFooter, useLoadMore } from '@/platform/ui/LoadMore.client'
import type { FeedPage } from '@/platform/lib'

import { loadMorePosts } from '../actions'
import type { PostSummary } from '../domain/types'
import { PostGrid } from './PostGrid'

/** News listing that loads more posts as the reader scrolls. */
export const PostsFeed: React.FC<{ initial: FeedPage<PostSummary> }> = ({ initial }) => {
  const feed = useLoadMore(initial, loadMorePosts)

  if (feed.totalDocs === 0) {
    return (
      <div className="container">
        <EmptyState title="No news posts yet." description="Check back soon." />
      </div>
    )
  }

  return (
    <div className="container">
      <PostGrid posts={feed.items} headingLevel="h2" />
      <LoadMoreFooter
        noun="posts"
        shownCount={feed.items.length}
        firstItemNumber={feed.firstItemNumber}
        totalDocs={feed.totalDocs}
        hasMore={feed.hasMore}
        status={feed.status}
        autoLoad={feed.autoLoad}
        onLoadMore={feed.loadMore}
        fallbackHref={`/posts/page/${feed.nextPage}`}
      />
    </div>
  )
}
