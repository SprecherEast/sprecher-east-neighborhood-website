import { cva } from 'class-variance-authority'
import { ArrowLeft } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import type { ImageRef } from '@/platform/lib/content'

import { ImageCredit } from './ImageCredit'
import { Link } from './Link'
import { Media } from './Media'
import { MetaList, type LabelledMetaItem } from './MetaList'
import { Text } from './Text'

type HeaderBase = {
  /** The page's one `h1` */
  title: React.ReactNode
  className?: string
}

/** Heads a list page, or a post or event page without a photo */
type DefaultHeaderProps = HeaderBase & {
  variant?: 'default'
  /** A short label above the title: the section ("News") or a `Badge` */
  eyebrow?: React.ReactNode
  /** One or two sentences on what the page holds */
  description?: React.ReactNode
  /** Facts about the page's item, label and value: "Date", "Time" */
  facts?: LabelledMetaItem[]
  /** A way back, for a page inside a list: "Back to all events" */
  backLink?: { href: string; label: string }
  /** A control that belongs to the header, such as the search box */
  children?: React.ReactNode
}

/** Heads a page holding one form or message, inside a narrow `Section`: title and description only */
type CompactHeaderProps = HeaderBase & {
  variant: 'compact'
  description?: React.ReactNode
  eyebrow?: never
  facts?: never
  backLink?: never
  children?: never
}

/** Heads a post or event page with a photo: the title on a short photo band, the facts under it (#571) */
type ImageHeaderProps = HeaderBase & {
  variant: 'image'
  /** The photo behind the title; it loads first, and its credit shows under it */
  image: ImageRef
  /** A short label above the title, or `Badge · on-image` items */
  eyebrow?: React.ReactNode
  facts?: LabelledMetaItem[]
  description?: never
  backLink?: never
  children?: never
}

export type PageHeaderProps = DefaultHeaderProps | CompactHeaderProps | ImageHeaderProps

// The h1 of each variant. Every one is bold (the photo title was weight 400, docs/ui/evidence.md)
const titleVariants = cva('font-bold text-balance', {
  variants: {
    variant: {
      default: 'text-4xl tracking-tight text-foreground md:text-5xl',
      compact: 'text-3xl text-foreground',
      image: 'text-2xl text-on-image text-shadow-photo sm:text-3xl lg:text-4xl',
    },
  },
})

// A text eyebrow is the coloured overline; on a photo it takes the photo's text color
const eyebrowVariants = cva('', {
  variants: {
    variant: { default: 'mb-3', image: 'mb-3 text-on-image' },
  },
})

/*
 * The top of a page (#430, docs/ui/component-set.md). `default` heads a list page, and a post or
 * event without a photo: eyebrow, title, description, facts, an optional way back and control,
 * left-aligned. `compact` is the small header of a form page, inside the page's own column.
 * `image` puts the title on a short photo band behind a `scrim` fade and the facts in a byline row
 * under the photo, as posts and events with a photo show it (#461, #571): the article starts on the
 * first screen.
 */
export function PageHeader(props: PageHeaderProps) {
  if (props.variant === 'compact') {
    const { title, description, className } = props
    return (
      <header className={cn(description ? 'mb-8' : 'mb-6', className)}>
        <h1 className={titleVariants({ variant: 'compact' })}>{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </header>
    )
  }

  if (props.variant === 'image') return <ImageHeader {...props} />

  const { eyebrow, title, description, facts, backLink, children, className } = props
  return (
    <header className={cn('container mb-12 md:mb-16', className)}>
      <Eyebrow variant="default">{eyebrow}</Eyebrow>
      <h1 className={titleVariants({ variant: 'default' })}>{title}</h1>
      {description && (
        <Text variant="lead" className="mt-4 max-w-2xl">
          {description}
        </Text>
      )}
      {facts && facts.length > 0 && <MetaList variant="inline" items={facts} className="mt-6" />}
      {backLink && (
        <Link
          href={backLink.href}
          variant="action"
          icon={<ArrowLeft aria-hidden="true" />}
          className="mt-4"
        >
          {backLink.label}
        </Link>
      )}
      {children && <div className="mt-6 max-w-[50rem]">{children}</div>}
    </header>
  )
}

function ImageHeader({ image, eyebrow, title, facts, className }: ImageHeaderProps) {
  return (
    <header className={className}>
      <div className="relative -mt-[var(--header-height)] flex items-end">
        <div className="relative z-10 container pt-[var(--header-height)] pb-6 text-on-image lg:grid lg:grid-cols-[1fr_48rem_1fr]">
          <div className="lg:col-span-2 lg:col-start-2">
            <Eyebrow variant="image">{eyebrow}</Eyebrow>
            <h1 className={titleVariants({ variant: 'image' })}>{title}</h1>
          </div>
        </div>
        {/* A band, not a hero: about 42% of the screen, 16rem to 28rem, so the article starts on
            the first screen. `svh` keeps a phone's address bar from making it jump (#571) */}
        <div className="min-h-[clamp(16rem,42svh,28rem)] select-none">
          <Media fill priority imgClassName="-z-10 object-cover" resource={image} />
          {/* The whole band is darkened, never lighter than 55% at the top, so a title that wraps
              onto three lines still sits on a scrim. `ON_IMAGE_TITLE_SCRIM_ALPHA` tests that 55%
              over a white photo (#572) */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-scrim/80 via-scrim/65 to-scrim/55" />
        </div>
      </div>
      <ImageCredit image={image} className="container mt-2 text-right" />
      {facts && facts.length > 0 && (
        <div className="container mt-3 lg:grid lg:grid-cols-[1fr_48rem_1fr]">
          <MetaList
            variant="inline"
            items={facts}
            className="gap-x-6 gap-y-1 text-sm lg:col-span-2 lg:col-start-2"
          />
        </div>
      )}
    </header>
  )
}

/** Text is the overline; anything else (a row of badges) keeps its own look */
function Eyebrow({
  variant,
  children,
}: {
  variant: 'default' | 'image'
  children: React.ReactNode
}) {
  if (!children) return null
  const className = eyebrowVariants({ variant })
  if (typeof children !== 'string') return <div className={className}>{children}</div>

  return (
    <Text variant="overline" as="div" className={className}>
      {children}
    </Text>
  )
}
