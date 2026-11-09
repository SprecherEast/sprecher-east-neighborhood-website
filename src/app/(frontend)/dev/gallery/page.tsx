import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { Link } from '@/platform/ui/Link'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Text } from '@/platform/ui/Text'

import { ActionsGallery } from './ActionsGallery.client'
import { ChartGallery } from './ChartGallery'
import { DisplayGallery } from './DisplayGallery'
import { ProgressGallery } from './ProgressGallery'
import { FieldsGallery } from './FieldsGallery.client'
import { GALLERY_COMPONENTS } from './galleryComponents'
import { HeadersGallery } from './HeadersGallery'
import { InteractiveGallery } from './InteractiveGallery.client'
import { isGalleryEnabled } from './isGalleryEnabled'
import { DismissAndZoomGallery } from './DismissAndZoomGallery'
import { LayoutGallery } from './LayoutGallery'
import { RichTextGallery } from './RichTextGallery'
import { TabsGallery } from './TabsGallery'

export const metadata: Metadata = {
  title: 'Component gallery',
  description: 'Every shared component and its variants, for development only.',
  robots: NOT_INDEXED,
}

/*
 * `/dev/gallery` (#466): every shared component in `docs/ui/component-set.md` with each of its
 * variants, from fixed sample data, so a visual change in one shows up in one place. It exists
 * under `next dev` only; everywhere else it is a 404, and it is never indexed or in the sitemap.
 */
export default function GalleryPage() {
  if (!isGalleryEnabled()) notFound()

  return (
    <div className="pt-12 pb-16">
      <PageHeader
        eyebrow="Development only"
        title="Component gallery"
        description="Every shared component and its variants, with sample content. Turn on dark mode in your system settings to check the dark theme."
        className="mb-8 md:mb-8"
      />
      <div className="container">
        <nav aria-labelledby="gallery-contents" className="pb-10">
          <Text variant="label" as="h2" id="gallery-contents" className="mb-3">
            Contents
          </Text>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {GALLERY_COMPONENTS.map((name) => (
              <li key={name}>
                <Link href={`#gallery-${name.toLowerCase()}`} variant="muted">
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ActionsGallery />
        <FieldsGallery />
        <DisplayGallery />
        <ProgressGallery />
        <TabsGallery />
        <HeadersGallery />
        <LayoutGallery />
        <DismissAndZoomGallery />
        <InteractiveGallery />
        <ChartGallery />
        <RichTextGallery />
      </div>
    </div>
  )
}
