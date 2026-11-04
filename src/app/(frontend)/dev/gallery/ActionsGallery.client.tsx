'use client'

// A client component: `Button loading` adds a click guard, which a server component can't render
import { ArrowRight, Download, Home, Plus } from 'lucide-react'
import React from 'react'

import { Button } from '@/platform/ui/Button'
import { Link } from '@/platform/ui/Link'
import { Section } from '@/platform/ui/Section'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const VARIANTS = ['primary', 'secondary', 'accent', 'ghost'] as const
const SIZES = ['sm', 'md', 'lg'] as const

/** `Button` and `Link`: everything a resident clicks */
export function ActionsGallery() {
  return (
    <>
      <GalleryEntry
        name="Button"
        description="The only thing that draws a button. With href it renders a link."
      >
        <GalleryVariant label="variant">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </GalleryVariant>
        <GalleryVariant label="variant: inverse, inverse-outline (on a brand band)">
          <Section tone="brand" spacing="sm" as="div" className="w-full rounded-2xl">
            <div className="flex flex-wrap gap-4">
              <Button variant="inverse">inverse</Button>
              <Button variant="inverse-outline">inverse-outline</Button>
            </div>
          </Section>
        </GalleryVariant>
        <GalleryVariant label="size" className="items-center">
          {SIZES.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
          <Button size="icon" variant="secondary" aria-label="Add">
            <Plus aria-hidden="true" />
          </Button>
        </GalleryVariant>
        <GalleryVariant label="icons, loading, disabled">
          <Button iconStart={<Download aria-hidden="true" />}>iconStart</Button>
          <Button variant="secondary" iconEnd={<ArrowRight aria-hidden="true" />}>
            iconEnd
          </Button>
          <Button loading>loading</Button>
          <Button disabled>disabled</Button>
        </GalleryVariant>
        <GalleryVariant label="href, external, fullWidth: mobile">
          <Button href="/events">href</Button>
          <Button href="https://example.com" external variant="secondary">
            external
          </Button>
          <Button fullWidth="mobile" variant="accent">
            fullWidth mobile
          </Button>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="Link" description="Every text link. A link only ever looks like text.">
        <GalleryVariant label="inline">
          <p className="max-w-prose">
            Running text with <Link href="/events">an inline link</Link> and{' '}
            <Link href="https://example.com" external>
              an external one
            </Link>
            .
          </p>
        </GalleryVariant>
        <GalleryVariant label="nav: sm, md, current">
          <Link href="/events" variant="nav" size="sm">
            nav sm
          </Link>
          <Link href="/dev/gallery" variant="nav" size="sm" current>
            nav sm current
          </Link>
          <div className="w-full max-w-xs">
            <Link href="/posts" variant="nav" size="md" icon={<Home aria-hidden="true" />}>
              nav md with icon
            </Link>
          </div>
        </GalleryVariant>
        <GalleryVariant label="crumb (one step of a breadcrumb trail)">
          <Link href="/events" variant="crumb">
            Events
          </Link>
        </GalleryVariant>
        <GalleryVariant label="muted, caption, action">
          <Link href="/faq" variant="muted">
            muted
          </Link>
          <Link href="https://example.com" variant="caption" external>
            caption
          </Link>
          <Link
            href="/events"
            variant="action"
            icon={<ArrowRight aria-hidden="true" />}
            iconPosition="end"
          >
            action
          </Link>
        </GalleryVariant>
        <GalleryVariant label="iconOnly">
          <Link href="/" variant="nav" size="sm" iconOnly icon={<Home aria-hidden="true" />}>
            Home
          </Link>
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
