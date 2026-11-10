import { cva } from 'class-variance-authority'
import { ArrowLeft } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { READING_GRID, READING_WIDTH } from './layoutSizes'
import { Link } from './Link'
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

/**
 * Heads a post or event page: the title on a short plain band, the facts under it (#1013). The
 * page's picture is not in the band: `FeaturedImage` shows it whole in the article.
 */
type BandHeaderProps = HeaderBase & {
  variant: 'band'
  /** A short label above the title, or `Badge` items */
  eyebrow?: React.ReactNode
  facts?: LabelledMetaItem[]
  description?: never
  backLink?: never
  children?: never
}

export type PageHeaderProps = DefaultHeaderProps | CompactHeaderProps | BandHeaderProps

// The h1 of each variant. Every one is bold (the photo title was weight 400, docs/ui/evidence.md)
const titleVariants = cva('font-bold text-balance', {
  variants: {
    variant: {
      default: 'text-4xl tracking-tight text-foreground md:text-5xl',
      compact: 'text-3xl text-foreground',
      band: 'text-2xl text-foreground sm:text-3xl lg:text-4xl',
    },
  },
})

const EYEBROW_CLASS = 'mb-3'

/*
 * The top of a page (#430, docs/ui/component-set.md). `default` heads a list page, and a post or
 * event without a photo: eyebrow, title, description, facts, an optional way back and control,
 * left-aligned. `compact` is the small header of a form page, inside the page's own column.
 * `band` puts the title on a short plain band, a themed surface under the site header, and the facts
 * in a row under it, as posts and events show it (#461, #571, #1013): the article starts on the
 * first screen, and the page's picture is shown whole in the article, never cropped behind the title.
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

  if (props.variant === 'band') return <BandHeader {...props} />

  const { eyebrow, title, description, facts, backLink, children, className } = props
  return (
    <header className={cn('container mb-12 md:mb-16', className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
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
      {children && <div className={cn('mt-6', READING_WIDTH)}>{children}</div>}
    </header>
  )
}

function BandHeader({ eyebrow, title, facts, className }: BandHeaderProps) {
  return (
    <header className={className}>
      {/* The band slides under the sticky site header, so it reads as one block with it */}
      <div className="-mt-[var(--header-height)] border-b border-border bg-surface">
        <div className={cn('container pt-[var(--header-height)] pb-6 lg:grid', READING_GRID)}>
          <div className="lg:col-span-2 lg:col-start-2">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className={titleVariants({ variant: 'band' })}>{title}</h1>
          </div>
        </div>
      </div>
      {facts && facts.length > 0 && (
        <div className={cn('container mt-3 lg:grid', READING_GRID)}>
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
function Eyebrow({ children }: { children: React.ReactNode }) {
  if (!children) return null
  if (typeof children !== 'string') return <div className={EYEBROW_CLASS}>{children}</div>

  return (
    <Text variant="overline" as="div" className={EYEBROW_CLASS}>
      {children}
    </Text>
  )
}
