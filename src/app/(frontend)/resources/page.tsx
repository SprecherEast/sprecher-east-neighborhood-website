import type { Metadata } from 'next/types'

import React from 'react'
import { RESOURCE_SECTION_NOTES, toResourceSections } from '@/modules/directory'
import { ResourceCard, findResources } from '@/modules/directory/server'
import { cn } from '@/platform/lib/cn'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { EmptyState } from '@/platform/ui/EmptyState'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Text } from '@/platform/ui/Text'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function ResourcesPage() {
  const sections = toResourceSections(await findResources())

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow="Directory"
        title="Neighborhood Resources"
        description="Helpful contacts, services, and organizations for Sprecher East residents."
      />

      <div className="container space-y-16">
        {sections.map(({ category, label, items }) => {
          const note = RESOURCE_SECTION_NOTES[category]
          return (
            <section key={category}>
              <Text
                variant="section"
                className={cn('border-b border-border pb-3', note ? 'mb-3' : 'mb-6')}
              >
                {label}
              </Text>
              {note && (
                <Text variant="small" className="mb-6">
                  {note}
                </Text>
              )}
              <CardGrid gap="sm">
                {items.map((resource) => (
                  <CardGridItem key={resource.id}>
                    <ResourceCard resource={resource} />
                  </CardGridItem>
                ))}
              </CardGrid>
            </section>
          )
        })}

        {sections.length === 0 && (
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
