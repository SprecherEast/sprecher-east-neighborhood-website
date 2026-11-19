import React from 'react'

import { MediaBlock } from '@/platform/richtext/MediaBlock'
import { RichText } from '@/platform/richtext/RichText'
import { Badge, BadgeList } from '@/platform/ui/Badge'
import { Breadcrumbs } from '@/platform/ui/Breadcrumbs'
import { Caption, CAPTION_RICH_TEXT } from '@/platform/ui/Caption'
import { FeaturedImage } from '@/platform/ui/FeaturedImage'
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
  SAMPLE_IMAGE,
  SAMPLE_LEGEND_ITEMS,
  SAMPLE_LEGEND_SWATCHES,
  SAMPLE_PHOTO,
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
        <GalleryVariant label="default, with a back link" labelAs="p">
          <div className={`${FRAME} py-8`}>
            <PageHeader
              eyebrow="Events"
              title="Summer picnic in the park"
              description="Bring a dish to share. Everyone in the neighborhood is welcome."
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
        <GalleryVariant label="band, with badges as the eyebrow" labelAs="p">
          {/* The band slides under the sticky site header; here it starts in place */}
          <div className={`${FRAME} [--header-height:0px]`}>
            <PageHeader
              variant="band"
              eyebrow={
                <BadgeList>
                  <Badge variant="category">Events</Badge>
                  <Badge variant="category">Parks</Badge>
                </BadgeList>
              }
              title="Summer picnic in the park"
              className="pb-2"
            />
          </div>
        </GalleryVariant>
        <GalleryVariant label="band, with a title that wraps" labelAs="p">
          <div className={`${FRAME} [--header-height:0px]`}>
            <PageHeader
              variant="band"
              eyebrow={
                <BadgeList>
                  <Badge variant="category">Development</Badge>
                </BadgeList>
              }
              title="A new way onto I-94 at Milwaukee Street: what it could mean for our streets"
              className="pb-2"
            />
          </div>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="BandBackdrop"
        description="The faded, grayed photo behind a post's or an event's title band, with a crop per screen size (#1024). The title keeps its contrast over any photo, so the band reads the same over the sample photo as over none. Decorative; the sample photo is a blurred test image."
      >
        <GalleryVariant
          label="band, over a faded photo (a post's or an event's backdrop)"
          labelAs="p"
        >
          <div className={`${FRAME} [--header-height:0px]`}>
            <PageHeader
              variant="band"
              eyebrow={
                <BadgeList plated>
                  <Badge variant="category">Events</Badge>
                  <Badge variant="category">Parks</Badge>
                </BadgeList>
              }
              title="Summer picnic in the park"
              backdrop={{ phone: null, tablet: null, desktop: SAMPLE_IMAGE }}
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
        name="FeaturedImage"
        description="The picture of a post or an event, shown whole: full width above the text on a phone, half the column to its right on a tablet, a third from the desktop breakpoint, with the text beside it and no Enlarge button; nothing without a picture."
      >
        <GalleryVariant label="whole picture, text beside it, with its credit" className="w-full">
          <div className={`${FRAME} flow-root p-6`}>
            <FeaturedImage image={SAMPLE_IMAGE} />
            <p>
              The text of the article starts on the picture&rsquo;s first line and runs beside it,
              then continues under it once it is past the picture&rsquo;s end. A short article ends
              before the picture does, and what follows clears it.
            </p>
            <p className="mt-4">
              A second paragraph, so the wrapping beside the picture is visible at each width.
            </p>
          </div>
        </GalleryVariant>
        <GalleryVariant label="no picture: nothing is drawn and no gap is left" className="w-full">
          <div className={`${FRAME} p-6`}>
            <FeaturedImage image={null} />
            <p>The text starts right away.</p>
          </div>
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
        description="Numbered markers (white number and ring on the accent orange, like the markers on a photo) in a panel as wide as the annotated image above it and its caption, no animation. With marker swatch, the chart colour of each item (and its hatch pattern), as a plain list under a chart."
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
        <GalleryVariant label="under an image block with a caption" className="w-full max-w-3xl">
          {/* The caption sits between the image and the legend; the legend never covers it (#658) */}
          <MediaBlock
            blockType="mediaBlock"
            media={{
              id: 0,
              alt: 'A sample diagram',
              caption: SAMPLE_CAPTION_RICH_TEXT,
              createdAt: '',
              updatedAt: '',
            }}
            placement="inline"
            staticImage={SAMPLE_PHOTO}
          />
          <Legend label="Diagram key" items={SAMPLE_LEGEND_ITEMS} />
        </GalleryVariant>
        <GalleryVariant label="swatches, a plain list under a chart" className="w-full max-w-3xl">
          <Legend marker="swatch" attach="none" label="Chart key" items={SAMPLE_LEGEND_SWATCHES} />
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
