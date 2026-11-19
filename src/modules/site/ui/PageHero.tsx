import React from 'react'

import { cn } from '@/platform/lib/cn'
import type { ResolvedLink, RichTextValue } from '@/platform/lib'
import { RichText } from '@/platform/richtext/RichText'
import { splitHeadingFromBody } from '@/platform/richtext/splitHeadingFromBody'
import { Button } from '@/platform/ui'
import { Caption, CAPTION_RICH_TEXT } from '@/platform/ui/Caption'
import { LinkButton } from '@/platform/ui/CMSLink'
import { GlassPanel } from '@/platform/ui/GlassPanel'
import { Media } from '@/platform/ui/Media'
import { Section } from '@/platform/ui/Section'

import type { PageHeroProps } from '../domain/hero'
import { heroPhotoVars } from '../domain/heroGeometry'
import {
  HERO_BELOW_GAP,
  HERO_BOTTOM_SPACE,
  HERO_FADE_LENGTH,
  HERO_HORIZON_GAP,
  HERO_PHOTO_HEIGHT,
  HERO_PHOTO_LAYER_BOTTOM,
  HERO_SKY_GAP,
  HERO_SKY_HEIGHT,
  READING_WIDTH,
} from '@/platform/ui/layoutSizes'

type PhotoHeroProps = Extract<PageHeroProps, { variant: 'high' | 'medium' }>

/** A page's hero (H1, H4, H5) in the look the editor chose; `toPageHeroProps` builds its props. */
export function PageHero(props: PageHeroProps) {
  switch (props.variant) {
    case 'high':
      return <HighHero {...props} />
    case 'medium':
      return <MediumHero {...props} />
    case 'low':
      return <LowHero body={props.body} />
  }
}

/**
 * Home's hero: the title in the sky above the photo's horizon, then the glass-panel description and
 * the buttons just below it (#1304). The photo is at the top, its focal point marks the horizon
 * (`heroPhotoVars`), and it fades into the page over the first part of the next section.
 */
function HighHero({ body: richText, image, links }: PhotoHeroProps) {
  // The title and the description come from the same rich text without repeating it in the DOM
  // (two copies meant two <h1> elements on the home page)
  const { heading, body } = splitHeadingFromBody(richText)

  return (
    <div
      className={cn('hero-geometry relative -mt-[var(--header-height)]', HERO_BELOW_GAP)}
      style={heroPhotoVars(image) as React.CSSProperties}
    >
      {/* The photo runs on past the hero, under the next section, and fades into the page */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 overflow-hidden select-none',
          HERO_PHOTO_LAYER_BOTTOM,
        )}
      >
        <div className={cn('relative', HERO_PHOTO_HEIGHT)}>
          {image && (
            <Media fill atFocalPoint imgClassName="object-cover" priority resource={image} />
          )}
        </div>

        {/* The scrim darkens the left, where the text is, and fades out with the photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-scrim/60 via-scrim/30 to-transparent" />

        <div className={cn('absolute inset-x-0 bottom-0 hero-fade', HERO_FADE_LENGTH)} />
      </div>

      <div className="relative z-10 container pt-[var(--header-height)]" data-theme="dark">
        {/* The sky: the title ends just above the horizon */}
        <div className={cn('flex items-end', HERO_SKY_HEIGHT, HERO_SKY_GAP)}>
          {heading && (
            <div className="max-w-2xl">
              <RichText
                className="mb-0 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-balance [&_h1]:text-on-image [&_h1]:text-shadow-photo sm:[&_h1]:text-4xl lg:[&_h1]:text-5xl"
                data={heading}
                enableGutter={false}
              />
            </div>
          )}
        </div>

        {/* Below the horizon: the description and the buttons start level */}
        <div
          className={cn(
            'flex flex-col gap-6 md:flex-row md:items-start md:justify-between',
            HERO_HORIZON_GAP,
            HERO_BOTTOM_SPACE,
          )}
        >
          {body && (
            <GlassPanel className="max-w-2xl">
              <RichText
                className="mb-0 [&_a]:text-on-image [&_a:focus-visible]:outline-on-image [&_p]:mt-0 [&_p]:mb-0 [&_p]:text-base [&_p]:leading-relaxed [&_p]:text-on-image/90 md:[&_p]:text-lg [&_strong]:text-on-image"
                data={body}
                enableGutter={false}
              />
            </GlassPanel>
          )}

          {links.length > 0 && (
            <ul className="flex shrink-0 flex-col gap-3 sm:flex-row md:ml-auto md:w-60 md:flex-col">
              {links.map((link, i) => (
                <li key={i}>
                  {/* By position, as the design asks: the first is the main action */}
                  <Button
                    href={link.href}
                    external={link.external}
                    size="lg"
                    variant={i === 0 ? 'primary' : 'accent'}
                    // A white focus ring: the theme ring is green on a green photo
                    className="w-full focus-visible:outline-primary-foreground sm:w-auto md:w-full"
                  >
                    {link.label}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** The text and links above a wide image and its caption */
function MediumHero({ body, image, links }: PhotoHeroProps) {
  return (
    <div>
      {/* Clear of the site header, with the same space as the low hero (#202) */}
      <Section as="div" spacing="none" className="mt-16 mb-8">
        {body && <RichText className="mb-6" data={body} enableGutter={false} />}
        <HeroLinks links={links} />
      </Section>
      {image && (
        <Section as="div" spacing="none">
          <Media className="-mx-4 md:-mx-8 2xl:-mx-16" priority resource={image} />
          {image.caption && (
            <Caption as="div" className="mt-4">
              <RichText data={image.caption} enableGutter={false} className={CAPTION_RICH_TEXT} />
            </Caption>
          )}
        </Section>
      )}
    </div>
  )
}

/** The medium hero's links, each a `Button` in the look the editor chose */
function HeroLinks({ links }: { links: ResolvedLink[] }) {
  if (links.length === 0) return null
  return (
    <ul className="flex gap-4">
      {links.map((link, i) => (
        <li key={i}>
          <LinkButton link={link} />
        </li>
      ))}
    </ul>
  )
}

/** The page's title and text at a readable width, as the other pages' titles are */
function LowHero({ body }: { body: RichTextValue }) {
  return (
    <Section as="div" spacing="none" className="mt-16">
      <div className={READING_WIDTH}>
        <RichText
          // Match the h1 used on /events and /posts (prose renders it light)
          className="[&_h1]:mb-4 [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-balance md:[&_h1]:text-5xl"
          data={body}
          enableGutter={false}
        />
      </div>
    </Section>
  )
}
