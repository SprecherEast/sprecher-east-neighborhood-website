import { ArrowRight, CircleDashed, CircleX, Clock, Landmark } from 'lucide-react'
import React from 'react'

import { Badge, BadgeList } from '@/platform/ui/Badge'
import { Button } from '@/platform/ui/Button'
import { Card, CardBody, CardFooter, CardMedia, CardMeta, CardTitle } from '@/platform/ui/Card'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { DateTime } from '@/platform/ui/DateTime'
import { Disclosure } from '@/platform/ui/Disclosure'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Link } from '@/platform/ui/Link'
import { Media } from '@/platform/ui/Media'
import { MetaList } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import {
  SAMPLE_DATE_TIME,
  SAMPLE_DAY,
  SAMPLE_FACTS,
  SAMPLE_ICON_FACTS,
  SAMPLE_IMAGE,
} from './sampleData'

const CARD_VARIANTS = ['elevated', 'outline', 'muted', 'tinted'] as const
const CARD_PADDINGS = ['sm', 'md', 'lg'] as const
const META_VARIANTS = ['inline', 'stacked'] as const

/** Small pieces that show content: badges, cards, text, facts, dates and empty states */
export function DisplayGallery() {
  return (
    <>
      <GalleryEntry name="Badge">
        <GalleryVariant label="category">
          <BadgeList>
            <Badge>Parks</Badge>
            <Badge variant="category">Community meeting</Badge>
          </BadgeList>
        </GalleryVariant>
        <GalleryVariant label="on-image (on the photo of PageHeader · image)">
          <div className="rounded-2xl bg-scrim p-6">
            <Badge variant="on-image">Events</Badge>
          </div>
        </GalleryVariant>
        <GalleryVariant label="status (a cancelled event, #122)">
          <Badge variant="status">
            <CircleX aria-hidden="true" />
            Cancelled
          </Badge>
        </GalleryVariant>
        <GalleryVariant label="official (an official meeting, #122)">
          <Badge variant="official">
            <Landmark aria-hidden="true" />
            Official meeting
          </Badge>
        </GalleryVariant>
        <GalleryVariant label="current, caution, neutral (a timeline step, #507)">
          <BadgeList>
            <Badge variant="current">
              <ArrowRight aria-hidden="true" />
              Next up
            </Badge>
            <Badge variant="caution">
              <CircleDashed aria-hidden="true" />
              Depends
            </Badge>
            <Badge variant="neutral">
              <Clock aria-hidden="true" />
              Later
            </Badge>
          </BadgeList>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="Card" description="A box with parts; looks are variants.">
        <GalleryVariant label="variant" className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CARD_VARIANTS.map((variant) => (
            <Card key={variant} variant={variant}>
              <CardTitle>{variant}</CardTitle>
              <Text variant="small" className="mt-2 text-foreground">
                A short line of card text.
              </Text>
            </Card>
          ))}
        </GalleryVariant>
        <GalleryVariant label="padding" className="grid w-full gap-6 sm:grid-cols-3">
          {CARD_PADDINGS.map((padding) => (
            <Card key={padding} padding={padding} variant="outline">
              <CardTitle>padding {padding}</CardTitle>
            </Card>
          ))}
        </GalleryVariant>
        <GalleryVariant
          label="padding none, interactive, with every part"
          className="grid w-full gap-6 sm:grid-cols-2"
        >
          <SampleMediaCard interactive />
          <SampleMediaCard />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="CardGrid" description="One column on phones, two from sm, then columns.">
        {([2, 3, 4] as const).map((columns) => (
          <GalleryVariant key={columns} label={`columns ${columns}`} className="block">
            <CardGrid columns={columns} gap={columns === 4 ? 'sm' : 'md'}>
              {Array.from({ length: columns }, (_, index) => (
                <CardGridItem key={index}>
                  <Card padding="sm">
                    <CardTitle as="h4">Card {index + 1}</CardTitle>
                  </Card>
                </CardGridItem>
              ))}
            </CardGrid>
          </GalleryVariant>
        ))}
      </GalleryEntry>

      <GalleryEntry name="Text">
        <GalleryVariant label="section, subsection, overline, label, lead, small" className="block">
          <div className="space-y-3">
            <Text variant="overline">overline</Text>
            <Text variant="section" as="h4">
              section heading
            </Text>
            <Text variant="subsection" as="h5">
              subsection heading
            </Text>
            <Text variant="label">label</Text>
            <Text variant="lead">lead: a larger paragraph that introduces a page.</Text>
            <Text variant="small" clamp={2} className="max-w-sm">
              small, clamped to two lines: a long summary that keeps going so the clamp has
              something to cut off after the second line on every screen size.
            </Text>
          </div>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="MetaList">
        {META_VARIANTS.map((variant) => (
          <GalleryVariant
            key={variant}
            label={variant}
            className="grid w-full gap-6 sm:grid-cols-2"
          >
            <MetaList variant={variant} items={SAMPLE_FACTS} />
            <MetaList variant={variant} items={SAMPLE_ICON_FACTS} />
          </GalleryVariant>
        ))}
        <GalleryVariant label="on-image">
          <div className="w-full rounded-2xl bg-scrim p-6">
            <MetaList variant="on-image" items={SAMPLE_FACTS} />
          </div>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="DateTime"
        description="Day-only dates in UTC, others in the site's time zone."
      >
        <GalleryVariant label="short, long (day-only, then with a time)">
          <DateTime value={SAMPLE_DAY} />
          <DateTime value={SAMPLE_DAY} format="long" />
          <DateTime value={SAMPLE_DATE_TIME} />
          <DateTime value={SAMPLE_DATE_TIME} format="long" />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="EmptyState">
        <GalleryVariant label="boxed" className="block">
          <EmptyState
            title="No upcoming events"
            description="Check back soon, or browse past events."
            action={<Button href="/events">See all events</Button>}
          />
        </GalleryVariant>
        <GalleryVariant label="plain" className="block">
          <EmptyState
            variant="plain"
            title="No results for “picnic”"
            description="Try fewer words."
          />
        </GalleryVariant>
        <GalleryVariant label="page (its title is an h1)" className="block">
          <EmptyState
            variant="page"
            title="404"
            description="This page could not be found."
            action={<Button href="/">Go home</Button>}
          />
        </GalleryVariant>
      </GalleryEntry>
      <GalleryEntry
        name="Disclosure"
        description="An open-and-close box: a native details with the kit's summary row and chevron."
      >
        <GalleryVariant label="card (an FAQ question)" className="block">
          <div className="max-w-prose space-y-4">
            <Disclosure variant="card" summary="Who runs this site?">
              <Text variant="small">Neighbors, with help from AI. It is unofficial.</Text>
            </Disclosure>
            <Disclosure variant="card" summary="Is this one open?" defaultOpen>
              <Text variant="small">Yes: defaultOpen starts it open.</Text>
            </Disclosure>
          </div>
        </GalleryVariant>
        <GalleryVariant label="bar (the On this page row on small screens)" className="block">
          <div className="max-w-prose rounded-2xl border border-border">
            <Disclosure variant="bar" summary="On this page" bodyClassName="px-4 py-3">
              <Text variant="small">The list of sections goes here.</Text>
            </Disclosure>
          </div>
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}

function SampleMediaCard({ interactive = false }: { interactive?: boolean }) {
  return (
    <Card as="article" padding="none" interactive={interactive}>
      <CardMedia>
        <Media resource={SAMPLE_IMAGE} fill imgClassName="object-cover" />
      </CardMedia>
      <CardBody>
        <CardMeta>
          <DateTime value={SAMPLE_DAY} />
          <Badge>Parks</Badge>
        </CardMeta>
        <CardTitle href={interactive ? '/events' : undefined} className="mt-2">
          {interactive ? 'Interactive card: the title links' : 'Card that is not a link'}
        </CardTitle>
        <Text variant="small" className="mt-2">
          CardMedia holds the photo; CardBody grows so the footer sits at the bottom.
        </Text>
        <CardFooter>
          {interactive ? (
            <Text variant="small">CardFooter</Text>
          ) : (
            <Link href="/events" variant="action" icon={<ArrowRight aria-hidden="true" />}>
              CardFooter action
            </Link>
          )}
        </CardFooter>
      </CardBody>
    </Card>
  )
}
