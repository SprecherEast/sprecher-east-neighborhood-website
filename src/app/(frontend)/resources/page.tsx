import type { Metadata } from 'next/types'

import React from 'react'
import {
  RESOURCE_SECTION_NOTES,
  toResourceGroups,
  type ResourceCategory,
} from '@/modules/directory'
import { ResourceCard, findResources } from '@/modules/directory/server'
import { cn } from '@/platform/lib/cn'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { EmptyState } from '@/platform/ui/EmptyState'
import { JumpLinks } from '@/platform/ui/JumpLinks'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Text } from '@/platform/ui/Text'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'
import { SECTION_SCROLL_MARGIN } from '@/platform/ui/scrollMargin'

export const dynamic = 'force-static'
export const revalidate = 600

/** The line under a heading for the categories that have one (an official's photo is not an endorsement) */
function SectionNote({ category }: { category: ResourceCategory }) {
  const note = RESOURCE_SECTION_NOTES[category]
  return note ? (
    <Text variant="small" className="mt-3 mb-4">
      {note}
    </Text>
  ) : null
}

export default async function ResourcesPage() {
  const groups = toResourceGroups(await findResources())

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow="Directory"
        title="Neighborhood Resources"
        description="Contacts and services neighbors use."
      />

      <div className="container space-y-16">
        <JumpLinks label="Resource groups" items={groups} />

        {groups.map(({ id, label, sections }) => (
          <section key={id} aria-labelledby={id}>
            <Text
              variant="section"
              id={id}
              className={cn('border-b border-border pb-3', SECTION_SCROLL_MARGIN)}
            >
              {label}
            </Text>
            {/* A group with one category already says what it holds in its own heading, and its note goes under that */}
            {sections.length === 1 && <SectionNote category={sections[0].category} />}
            <div className="mt-6 space-y-10">
              {sections.map(({ category, label: categoryLabel, items }) => (
                <div key={category}>
                  {sections.length > 1 && (
                    <>
                      <Text variant="subsection" as="h3" className="mb-3">
                        {categoryLabel}
                      </Text>
                      <SectionNote category={category} />
                    </>
                  )}
                  <CardGrid gap="sm">
                    {items.map((resource) => (
                      <CardGridItem key={resource.id}>
                        <ResourceCard resource={resource} />
                      </CardGridItem>
                    ))}
                  </CardGrid>
                </div>
              ))}
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <EmptyState title="Resources are being added." description="Check back soon!" />
        )}
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  const title = 'Neighborhood Resources'
  const description =
    'Contacts, services, and organizations serving the Sprecher East neighborhood in Madison, WI.'

  return {
    title,
    description,
    openGraph: mergeOpenGraph({ title, description }),
  }
}
