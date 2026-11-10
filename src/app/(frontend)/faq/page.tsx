import type { Metadata } from 'next/types'

import React from 'react'
import { JsonLd } from '@/platform/ui/JsonLd'
import { toFaqSections } from '@/modules/directory'
import { FaqList, faqJsonLd, findFaqEntries } from '@/modules/directory/server'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { EmptyState } from '@/platform/ui/EmptyState'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Text } from '@/platform/ui/Text'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function FAQPage() {
  const entries = await findFaqEntries()
  const sections = toFaqSections(entries)

  return (
    <div className={PAGE_SHELL}>
      <JsonLd data={faqJsonLd(entries)} />
      <PageHeader
        eyebrow="FAQ"
        title="Frequently Asked Questions"
        description="Common questions about Sprecher East, how it works, and how to get involved."
      />

      <div className="container max-w-3xl space-y-12">
        {sections.map(({ category, label, items }) => (
          <section key={category}>
            <Text variant="section" className="mb-6">
              {label}
            </Text>
            <FaqList items={items} />
          </section>
        ))}

        {sections.length === 0 && (
          <EmptyState
            variant="plain"
            title="FAQ items are being added."
            description="Check back soon!"
          />
        )}
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  const title = 'FAQ'
  const description = 'Common questions about this unofficial Sprecher East site.'

  return {
    title,
    description,
    openGraph: mergeOpenGraph({ title, description }),
  }
}
