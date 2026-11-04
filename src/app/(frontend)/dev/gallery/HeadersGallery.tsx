import React from 'react'

import { MediaBlock } from '@/platform/richtext/MediaBlock'
import { RichText } from '@/platform/richtext/RichText'
import { Badge, BadgeList } from '@/platform/ui/Badge'
import { Breadcrumbs } from '@/platform/ui/Breadcrumbs'
import { Caption, CAPTION_RICH_TEXT } from '@/platform/ui/Caption'
import { ImageCredit } from '@/platform/ui/ImageCredit'
import { Legend } from '@/platform/ui/Legend'
import { Media } from '@/platform/ui/Media'
import { PageHeader } from '@/platform/ui/PageHeader'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import {
  SAMPLE_BREADCRUMBS,
  SAMPLE_BREADCRUMBS_LONG,
  SAMPLE_BREADCRUMBS_TIGHT,
  SAMPLE_CAPTION_RICH_TEXT,
  SAMPLE_FACTS,
  SAMPLE_IMAGE,
  SAMPLE_LEGEND_ITEMS,
  SAMPLE_PHOTO,
  SAMPLE_WHITE_IMAGE,
} from './sampleData'

// A frame round each header, so it reads as a sample and not as the gallery's own header
const FRAME = 'w-full overflow-hidden rounded-2xl border border-border'

/** The top of a page, the trail above it, and images */
export function HeadersGallery() {
  return (
    <>
      <GalleryEntry
        name="PageHeader"
        description="Each variant holds the page's h1, so each sample here has one."
      >
        <GalleryVariant label="default, with facts and a back link" labelAs="p">
          <div className={`${FRAME} py-8`}>
            <PageHeader
              eyebrow="Events"
              title="Summer picnic in the park"
              description="Bring a dish to share. Everyone in the neighborhood is welcome."
              facts={SAMPLE_FACTS}
              backLink={{ href: '/events', label: 'Back to all events' }}
              className="mb-0 md:mb-0"
            />
          </div>
        </GalleryVariant>
        <GalleryVariant label="compact" labelAs="p">
          <div className={`${FRAME} p-6`}>
            <PageHeader
              variant="compact"
              title="Log In"
              description="Log in to your Sprecher East account."
              className="mb-0"
            />
          </div>
        </GalleryVariant>
        <GalleryVariant label="image, with badges as the eyebrow" labelAs="p">
          {/* The image header slides under the sticky site header; here it starts in place */}
          <div className={`${FRAME} [--header-height:0px]`}>
            <PageHeader
              variant="image"
              image={SAMPLE_IMAGE}
              eyebrow={
                <BadgeList>
                  <Badge variant="on-image">Events</Badge>
                  <Badge variant="on-image">Parks</Badge>
                </BadgeList>
              }
              title="Summer picnic in the park"
              facts={SAMPLE_FACTS}
              className="pb-2"
            />
          </div>
        </GalleryVariant>
        <GalleryVariant
          label="image, on a pure white photo (the worst case for readability)"
          labelAs="p"
        >
          <div className={`${FRAME} [--header-height:0px]`}>
            <PageHeader
              variant="image"
              image={SAMPLE_WHITE_IMAGE}
              eyebrow={
                <BadgeList>
                  <Badge variant="on-image">Development</Badge>
                </BadgeList>
              }
              title="A new way onto I-94 at Milwaukee Street: what it could mean for our streets"
              facts={SAMPLE_FACTS}
              className="pb-2"
            />
          </div>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="Breadcrumbs" description="A flat trail, with its JSON-LD.">
        <GalleryVariant label="one look" className="w-full">
          <Breadcrumbs items={SAMPLE_BREADCRUMBS} />
        </GalleryVariant>
        <GalleryVariant label="a long last crumb is cut with an ellipsis" className="w-full">
          <Breadcrumbs items={SAMPLE_BREADCRUMBS_LONG} />
        </GalleryVariant>
        <GalleryVariant label="a long middle crumb and a long last crumb" className="w-full">
          <Breadcrumbs items={SAMPLE_BREADCRUMBS_TIGHT} />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="Media" description="An upload or a bundled image through next/image.">
        <GalleryVariant
          label="resource (intrinsic size), fill, src"
          className="grid w-full gap-6 sm:grid-cols-3"
        >
          <Media resource={SAMPLE_IMAGE} imgClassName="h-auto w-full rounded-2xl" />
          <div className="relative aspect-square overflow-hidden rounded-2xl">
            <Media resource={SAMPLE_IMAGE} fill imgClassName="object-cover" />
          </div>
          <Media
            src={SAMPLE_PHOTO}
            alt="The same photo, from a static import"
            imgClassName="h-auto w-full rounded-2xl"
          />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="ImageCredit" description="Shows nothing for an image without a credit.">
        <GalleryVariant label="with source and license links">
          <ImageCredit image={SAMPLE_IMAGE} />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="Caption"
        description="Small, muted text under a picture, diagram or chart; an optional second line of fine print."
      >
        <GalleryVariant label="under an image, with fine print" className="w-full max-w-3xl">
          <figure className="w-full">
            <Media resource={SAMPLE_IMAGE} imgClassName="h-auto w-full rounded-2xl" />
            <Caption as="figcaption" className="mt-4" finePrint="Not final drawings; not to scale.">
              A sample diagram, with the numbers added for this neighborhood guide.
            </Caption>
          </figure>
        </GalleryVariant>
        <GalleryVariant label="rich text, as MediaBlock draws it" className="w-full max-w-3xl">
          <Caption as="div">
            <RichText
              data={SAMPLE_CAPTION_RICH_TEXT}
              enableGutter={false}
              className={CAPTION_RICH_TEXT}
            />
          </Caption>
        </GalleryVariant>
        <GalleryVariant label="size sm, for a credit on its own line">
          <Caption size="sm">Photo: Sample Photographer</Caption>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="Legend"
        description="Numbered markers under an annotated image or a chart, hanging from the image like a drawer: square top tucked under it, rounded bottom, narrower than the image, no animation."
      >
        <GalleryVariant label="under an image block" className="w-full max-w-3xl">
          {/* The real inline image block, so the sample can't drift from the article */}
          <MediaBlock
            blockType="mediaBlock"
            media={0}
            placement="inline"
            staticImage={SAMPLE_PHOTO}
          />
          <Legend label="Diagram key" items={SAMPLE_LEGEND_ITEMS} />
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
