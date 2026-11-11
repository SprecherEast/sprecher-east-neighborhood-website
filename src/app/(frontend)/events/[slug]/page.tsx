import type { Metadata } from 'next'

import { draftMode } from 'next/headers'
import { ArrowRight } from 'lucide-react'
import React from 'react'

import { PayloadRedirects } from '@/modules/site/server'
import { articleColumnClass } from '@/platform/richtext/articleColumn'
import { articleToc } from '@/platform/richtext/articleToc'
import { RichText } from '@/platform/richtext/RichText'
import { richTextBlocks } from '@/platform/richtext/richTextBlocks'
import { ArticlePage } from '@/platform/ui/ArticlePage'
import { SidebarCTA } from '@/platform/ui/SidebarCTA'
import {
  eventByline,
  eventHeaderProps,
  EventLocation,
  SidebarEvents,
  eventJsonLd,
  findUpcomingEvents,
  OfficialAgenda,
  getEventBySlug,
  listEventSlugs,
} from '@/modules/events/server'
import { Alert, Button } from '@/platform/ui'
import { generateMeta } from '@/platform/seo/generateMeta'
import { Text } from '@/platform/ui/Text'

// A scheduled publish or unpublish runs outside a request, where Next can't refresh the cache, so
// the page also re-renders every 10 minutes (#141, decision 0011)
export const revalidate = 600

export async function generateStaticParams() {
  try {
    const events = await listEventSlugs()
    return events.map(({ slug }) => ({ slug }))
  } catch (error) {
    console.error('[events] generateStaticParams failed; falling back to []', error)
    return []
  }
}

type Args = {
  params: Promise<{ slug?: string }>
}

export default async function EventPage({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const url = '/events/' + decodedSlug
  const event = await getEventBySlug(decodedSlug)

  if (!event) return <PayloadRedirects url={url} />

  const upcomingEvents = await findUpcomingEvents({ excludeId: event.id })
  const hasImage = event.image !== null
  const textClassName = articleColumnClass(event.content)
  return (
    <ArticlePage
      className="pt-16 pb-24"
      jsonLd={eventJsonLd(event)}
      redirects={<PayloadRedirects disableNotFound url={url} />}
      draft={draft}
      image={event.image}
      header={eventHeaderProps(event)}
      // No text width: what sits under the bar (the Location panel, the notices) runs the column's
      // full width, so the bar's groove does too
      byline={eventByline(event)}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Community Events', href: '/events' },
        { label: event.title },
      ]}
      toc={articleToc(event.content)}
      aside={
        <>
          <SidebarEvents events={upcomingEvents} title="Upcoming Events" />
          <SidebarCTA heading="More events" buttonLabel="View All Events" buttonHref="/events" />
        </>
      }
    >
      {event.cancelled && (
        // Part of the page, read in its place, so not announced (#122)
        <Alert tone="error" live={false} className="mb-8">
          <p className="font-semibold">This event is cancelled.</p>
        </Alert>
      )}

      <OfficialAgenda event={event} />

      <EventLocation event={event} />

      {/* A cancelled event takes no registrations */}
      {event.registrationUrl && !event.cancelled && (
        <div className="mb-8">
          <Button href={event.registrationUrl} external iconEnd={<ArrowRight aria-hidden="true" />}>
            Register for This Event
          </Button>
        </div>
      )}

      {event.description && !hasImage && (
        <Text variant="lead" className="mb-8">
          {event.description}
        </Text>
      )}

      {event.content && (
        <RichText
          blocks={richTextBlocks}
          className={textClassName}
          data={event.content}
          enableGutter={false}
          besideFloat={hasImage}
        />
      )}
    </ArticlePage>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  const event = await getEventBySlug(decodeURIComponent(slug))

  const meta = await generateMeta({ doc: event && { slug: event.slug, meta: event.meta } })
  if (!event) return meta

  return {
    ...meta,
    openGraph: {
      ...(meta.openGraph ?? {}),
      url: `/events/${event.slug}`,
    },
  }
}
