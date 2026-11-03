import type { Metadata } from 'next/types'

import React from 'react'

import { parseSearchQuery } from '@/modules/news'
import { findSearchResults, PostGrid, SearchBox } from '@/modules/news/server'
import { EmptyState } from '@/platform/ui/EmptyState'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

type Args = {
  searchParams: Promise<{
    q?: string | string[]
  }>
}

export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q } = await searchParamsPromise
  const query = parseSearchQuery(q)
  const results = await findSearchResults(query)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader title="Search">
        <SearchBox initialQuery={query} />
      </PageHeader>

      {results.length > 0 ? (
        <div className="container">
          <PostGrid posts={results} headingLevel="h2" />
        </div>
      ) : (
        <div className="container">
          <EmptyState
            variant="plain"
            title="No results found."
            // Only a search that was typed can be retried with other words
            description={query ? 'Try different words, or check the spelling.' : undefined}
          />
        </div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Search',
    description: 'Search the Sprecher East website for news, events, and resources.',
  }
}
