import React from 'react'

import { Alert, type AlertTone } from '@/platform/ui/Alert'
import { ArticlePage } from '@/platform/ui/ArticlePage'
import { Button } from '@/platform/ui/Button'
import { Card } from '@/platform/ui/Card'
import { DetailLayout } from '@/platform/ui/DetailLayout'
import { OnThisPage } from '@/platform/ui/OnThisPage.client'
import { SECTION_SCROLL_MARGIN } from '@/platform/ui/scrollMargin'
import { Section } from '@/platform/ui/Section'
import { SidebarCTA } from '@/platform/ui/SidebarCTA'
import { Text } from '@/platform/ui/Text'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const TONES: AlertTone[] = ['info', 'success', 'warning', 'error']
const SECTION_TONES = ['plain', 'surface', 'brand'] as const
const SPACINGS = ['none', 'sm', 'md', 'lg'] as const
const WIDTHS = ['page', 'prose', 'narrow'] as const

const TOC_SECTIONS = [
  { id: 'gallery-toc-short', text: 'The short version', level: 2 },
  { id: 'gallery-toc-map', text: 'The map', level: 2 },
  { id: 'gallery-toc-who', text: 'Who gains', level: 3 },
  { id: 'gallery-toc-timeline', text: 'Timeline', level: 2 },
  { id: 'gallery-toc-money', text: 'Money', level: 2 },
  { id: 'gallery-toc-next', text: 'What happens next', level: 2 },
] as const

const FRAME = 'w-full overflow-hidden rounded-2xl border border-border'

/** Messages, and the bands and columns a page is built from */
export function LayoutGallery() {
  return (
    <>
      <GalleryEntry
        name="Alert"
        description="Samples here are not live regions, so screen readers don't announce four at once."
      >
        <GalleryVariant label="tone" className="grid w-full gap-4 sm:grid-cols-2">
          {TONES.map((tone) => (
            <Alert key={tone} tone={tone} live={false} title={`${tone} title`}>
              A message in the {tone} tone.
            </Alert>
          ))}
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="Section" description="A band of the page: tone, spacing and width.">
        <GalleryVariant label="tone (spacing sm)" className="block space-y-4">
          {SECTION_TONES.map((tone) => (
            <div key={tone} className={FRAME}>
              <Section as="div" tone={tone} spacing="sm">
                <Text variant="subsection" as="p">
                  tone {tone}
                </Text>
                {tone === 'brand' && (
                  <div className="mt-4">
                    <Button variant="inverse">Get involved</Button>
                  </div>
                )}
              </Section>
            </div>
          ))}
        </GalleryVariant>
        <GalleryVariant label="spacing (tone surface)" className="block space-y-4">
          {SPACINGS.map((spacing) => (
            <div key={spacing} className={FRAME}>
              <Section as="div" tone="surface" spacing={spacing}>
                <p>spacing {spacing}</p>
              </Section>
            </div>
          ))}
        </GalleryVariant>
        <GalleryVariant label="spacing center" className="block">
          <div className={FRAME}>
            <Section as="div" spacing="center" width="narrow">
              <p className="text-center">Centred in at least 60% of the screen&apos;s height.</p>
            </Section>
          </div>
        </GalleryVariant>
        <GalleryVariant label="width (spacing sm)" className="block space-y-4">
          {WIDTHS.map((width) => (
            <div key={width} className={FRAME}>
              <Section as="div" width={width} spacing="sm">
                <div className="rounded-xl bg-primary/10 p-4">width {width}</div>
              </Section>
            </div>
          ))}
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="DetailLayout"
        description="Content with a sidebar beside it from lg, below it before that."
      >
        <GalleryVariant label="with-sidebar" className="block">
          <div className={`${FRAME} py-6`}>
            <DetailLayout
              aside={
                <SidebarCTA
                  heading="Sidebar box"
                  description="The aside: here a SidebarCTA, a tinted Card."
                  buttonLabel="Get involved"
                  buttonHref="/events"
                />
              }
            >
              <Card variant="muted">
                <Text variant="subsection" as="p">
                  Main content
                </Text>
                <Text variant="small" className="mt-2">
                  A post&apos;s or an event&apos;s body goes here.
                </Text>
              </Card>
            </DetailLayout>
          </div>
        </GalleryVariant>
      </GalleryEntry>
      <GalleryEntry
        name="ArticlePage"
        description="A post's or an event's page: header, breadcrumbs, text and sidebar, with its structured data."
      >
        <GalleryVariant label="with-sidebar" className="block">
          <div className={`${FRAME} py-6`}>
            <ArticlePage
              jsonLd={{ '@context': 'https://schema.org', '@type': 'Article', headline: 'Sample' }}
              redirects={null}
              draft={false}
              hasHeroImage={false}
              header={{
                title: 'A sample article',
                description: 'The header, then the trail, the text and the sidebar.',
              }}
              breadcrumbs={[
                { label: 'Home', href: '/' },
                { label: 'News', href: '/posts' },
                { label: 'A sample article' },
              ]}
              aside={
                <SidebarCTA
                  heading="Sidebar box"
                  description="The aside: here a SidebarCTA."
                  buttonLabel="Get involved"
                  buttonHref="/events"
                />
              }
            >
              <Text variant="small">The article&apos;s text goes here.</Text>
            </ArticlePage>
          </div>
        </GalleryVariant>
      </GalleryEntry>
      <GalleryEntry
        name="OnThisPage"
        description="An article's sections as a menu: a sticky rail from lg, a bar under the site header before that."
      >
        <GalleryVariant label="with-toc" className="block">
          <div className="w-full rounded-2xl border border-border py-6">
            <DetailLayout
              toc={<OnThisPage sections={[...TOC_SECTIONS]} />}
              aside={<p>The sidebar reads below the article.</p>}
            >
              {TOC_SECTIONS.map((section) => (
                <section key={section.id} className="mb-10">
                  {section.level === 2 ? (
                    <h2 id={section.id} className={`${SECTION_SCROLL_MARGIN} text-2xl font-bold`}>
                      {section.text}
                    </h2>
                  ) : (
                    <h3 id={section.id} className={`${SECTION_SCROLL_MARGIN} text-xl font-bold`}>
                      {section.text}
                    </h3>
                  )}
                  <p className="mt-3 h-64 max-w-prose">
                    Sample text for this section, long enough to scroll past.
                  </p>
                </section>
              ))}
            </DetailLayout>
          </div>
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
