import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'
import {
  RESOURCE_GROUPS,
  RESOURCE_SECTION_NOTES,
  resourceGroupHref,
  toResourceGroups,
  type ResourceCategory,
} from '@/modules/directory'
import { ResourceCard, findResources } from '@/modules/directory/server'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { DetailLayout } from '@/platform/ui/DetailLayout'
import { EmptyState } from '@/platform/ui/EmptyState'
import { PageHeader } from '@/platform/ui/PageHeader'
import { RelatedLinks } from '@/platform/ui/RelatedLinks'
import { Text } from '@/platform/ui/Text'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

export const dynamic = 'force-static'
export const revalidate = 600
// An address that is not a group is a not-found page, never rendered on request
export const dynamicParams = false

type Args = { params: Promise<{ group: string }> }

export function generateStaticParams() {
  return RESOURCE_GROUPS.map(({ id }) => ({ group: id }))
}

const findGroup = (id: string) => RESOURCE_GROUPS.find((group) => group.id === id)

/** The line under a heading for the categories that have one (an official's photo is not an endorsement) */
function SectionNote({ category }: { category: ResourceCategory }) {
  const note = RESOURCE_SECTION_NOTES[category]
  return note ? (
    <Text variant="small" className="mb-4">
      {note}
    </Text>
  ) : null
}

export default async function ResourceGroupPage({ params }: Args) {
  const group = findGroup((await params).group)
  if (!group) notFound()

  const sections =
    toResourceGroups(await findResources()).find(({ id }) => id === group.id)?.sections ?? []
  const related = RESOURCE_GROUPS.filter(({ id }) => id !== group.id).map(({ id, label }) => ({
    href: resourceGroupHref(id),
    label,
  }))

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow="Resources"
        title={group.label}
        description="Contacts and services neighbors use."
      />

      <DetailLayout aside={<RelatedLinks title="More resources" items={related} />}>
        <div className="space-y-10">
          {sections.map(({ category, label, items }) => (
            <div key={category}>
              {/* A group with one category already says what it holds in its own heading */}
              {sections.length > 1 && (
                <Text variant="section" className="mb-3">
                  {label}
                </Text>
              )}
              <SectionNote category={category} />
              <CardGrid gap="sm">
                {items.map((resource) => (
                  <CardGridItem key={resource.id}>
                    <ResourceCard resource={resource} />
                  </CardGridItem>
                ))}
              </CardGrid>
            </div>
          ))}

          {sections.length === 0 && (
            <EmptyState title="Resources are being added." description="Check back soon!" />
          )}
        </div>
      </DetailLayout>
    </div>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const group = findGroup((await params).group)
  if (!group) return {}

  const title = `${group.label}: Neighborhood Resources`
  const description = `${group.label}: contacts, services, and organizations for the Sprecher East neighborhood in Madison, WI.`

  return {
    title,
    description,
    openGraph: mergeOpenGraph({ title, description }),
  }
}
