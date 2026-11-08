import React from 'react'

import { cn } from '@/platform/lib/cn'
import { RichText } from '@/platform/richtext/RichText'
import { Card } from '@/platform/ui/Card'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { LinkButton } from '@/platform/ui/CMSLink'
import { Section, type SectionPlacement } from '@/platform/ui/Section'

import type {
  ContentBlockProps,
  ContentCardGroup,
  ContentColumn,
  ContentColumnSize,
} from '../domain/blocks'
import { TITLE_TEXT } from './blockStyles'
import { COLUMN_SPAN } from './columnSpan'

/*
 * Text, cards or stats from the page builder (B8–B11). The mapper picks the layout; this draws it.
 * The rich-text sizes per layout stay as selectors until `RichText` has its `compact` variant.
 */

/** A column's width on the 12-column grid of the single and columns layouts */
const SPAN: Record<ContentColumnSize, string> = COLUMN_SPAN

/** A card's width in a `CardGrid`: a full card takes the row, two-thirds two of three columns */
const CARD_SPAN: Record<ContentColumnSize, string> = {
  full: 'col-span-full',
  half: '',
  oneThird: '',
  twoThirds: 'lg:col-span-2',
}

const SINGLE_TEXT =
  'max-w-prose border-l-4 border-primary pl-6 md:pl-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground md:[&_h2]:text-3xl [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-muted-foreground'
const MAIN_TEXT =
  '[&_h2]:mb-4 [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground md:[&_h2]:text-4xl [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-muted-foreground md:[&_p]:text-lg'
const SIDE_CARD_TEXT =
  '[&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-foreground [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground'
const STAT_TEXT =
  '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground [&_p]:mt-1 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground'

/** A column's text, then its link button */
function ColumnContent({ body, link }: Pick<ContentColumn, 'body' | 'link'>) {
  return (
    <>
      {body && <RichText data={body} enableGutter={false} />}
      {link && <LinkButton link={link} />}
    </>
  )
}

function CardGroup({ title, cards }: ContentCardGroup) {
  // Halves sit two to a row, beside any full cards (which take their own row); any other mix
  // sits in thirds
  const columns =
    cards.length > 0 && cards.every(({ size }) => size === 'half' || size === 'full') ? 2 : 3
  return (
    <>
      {title && (
        <div className={TITLE_TEXT}>
          <RichText data={title} enableGutter={false} />
        </div>
      )}
      {cards.length > 0 && (
        <CardGrid columns={columns}>
          {cards.map(({ size, ...column }, index) => (
            <CardGridItem key={index} className={CARD_SPAN[size]}>
              <Card padding="lg">
                <ColumnContent {...column} />
              </Card>
            </CardGridItem>
          ))}
        </CardGrid>
      )}
    </>
  )
}

function Layout(props: ContentBlockProps) {
  switch (props.layout) {
    case 'cards':
      return (
        <div className="flex flex-col gap-6">
          {props.groups.map((group, index) => (
            <CardGroup key={index} {...group} />
          ))}
        </div>
      )
    case 'stats':
      return (
        <CardGrid columns={4} gap="sm">
          {props.columns.map((column, index) => (
            <CardGridItem key={index}>
              <Card className={STAT_TEXT}>
                <ColumnContent {...column} />
              </Card>
            </CardGridItem>
          ))}
        </CardGrid>
      )
    case 'columns':
      return (
        <div className="grid grid-cols-4 gap-8 lg:grid-cols-12 lg:gap-x-12">
          {props.columns.map(({ size, ...column }, index) =>
            // The first column is the text; the one beside it a side card
            index === 0 ? (
              <div key={index} className={cn(SPAN[size], MAIN_TEXT)}>
                <ColumnContent {...column} />
              </div>
            ) : (
              <Card
                key={index}
                padding="lg"
                className={cn(SPAN[size], 'flex flex-col justify-center', SIDE_CARD_TEXT)}
              >
                <ColumnContent {...column} />
              </Card>
            ),
          )}
        </div>
      )
    case 'single':
      return (
        <div className="grid grid-cols-4 gap-x-16 gap-y-8 lg:grid-cols-12">
          {props.columns.map(({ size, ...column }, index) => (
            <div key={index} className={cn(SPAN[size], SINGLE_TEXT)}>
              <ColumnContent {...column} />
            </div>
          ))}
        </div>
      )
  }
}

export function ContentBlock(props: ContentBlockProps & { placement?: SectionPlacement }) {
  const isEmpty = props.layout === 'cards' ? props.groups.length === 0 : props.columns.length === 0
  if (isEmpty) return null

  const isBand = props.layout === 'cards' || props.layout === 'stats'
  return (
    <Section tone={isBand ? 'surface' : 'plain'} spacing="sm" placement={props.placement}>
      <Layout {...props} />
    </Section>
  )
}
