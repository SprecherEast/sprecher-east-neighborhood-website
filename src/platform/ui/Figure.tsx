import { cva } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Badge } from './Badge'
import { Caption } from './Caption'
import { Legend, type LegendItem } from './Legend'
import { FIGURE_GAP } from './layoutSizes'
import { Media } from './Media'
import type { MediaProps } from './mediaProps'
import { Zoom } from './Zoom.client'

/*
 * The float is written out in full so Tailwind finds each class. Below `md` the figure is the full
 * column width and sits between paragraphs; from `md` it floats right and the text wraps on its left.
 */
const figureVariants = cva(
  `${FIGURE_GAP} not-prose w-full md:float-right md:mb-4 md:ml-6 md:mt-1`,
  {
    variants: {
      size: {
        third: 'md:w-1/3',
        'two-fifths': 'md:w-2/5',
        half: 'md:w-1/2',
        // The article's picture (`FeaturedImage`): half the column on a tablet, a third from `lg`
        'half-then-third': 'md:w-1/2 lg:w-1/3',
      },
    },
    defaultVariants: { size: 'two-fifths' },
  },
)

export type FigureSize = 'third' | 'two-fifths' | 'half' | 'half-then-third'

/** What the browser is told the small picture's width is, so it asks for no larger a file */
const SMALL_SIZES = '(min-width: 1024px) 24rem, (min-width: 768px) 40vw, 100vw'
const SMALL_SIZES_HALF_THEN_THIRD = '(min-width: 960px) 20rem, (min-width: 768px) 50vw, 100vw'

export type FigureProps = Pick<MediaProps, 'resource' | 'src' | 'alt'> & {
  /** Names the Enlarge button and the dialog */
  title: string
  /** The figure's number or name in its source ("Figure 2-9"), shown in a neutral badge */
  label?: string
  /** The short line under the small picture */
  caption?: React.ReactNode
  /** The long caption and credit, shown only in the dialog */
  longCaption?: React.ReactNode
  /** The numbered key, shown only in the dialog beside or under the large picture */
  items?: LegendItem[]
  /** Its label for assistive technology; "Diagram key" by default */
  keyLabel?: string
  /** Width of the small picture in the article's text column, from `md`; two fifths by default */
  size?: FigureSize
  /** The first image the reader sees: loads early instead of lazily */
  priority?: boolean
  /**
   * Where the Enlarge button sits, which is above the picture unless given. Below it, the picture
   * starts on the first line of the text beside it, with no gap.
   */
  enlarge?: 'above' | 'below'
  className?: string
}

/**
 * A picture that floats right in an article, small, with a short caption (#816). Clicking or
 * tapping it opens the large picture with its numbered key and the long caption. The key is never in
 * the small view: its numbers can't be read there. Without scripting the small picture stays as it is.
 */
export function Figure({
  title,
  label,
  caption,
  longCaption,
  items = [],
  keyLabel = 'Diagram key',
  size,
  priority,
  enlarge = 'above',
  className,
  resource,
  src,
  alt,
}: FigureProps) {
  const picture = (sizes: string, early = false) => (
    <Media
      resource={resource}
      src={src}
      alt={alt}
      size={sizes}
      priority={early}
      imgClassName="h-auto w-full rounded-xl border border-border"
    />
  )
  const hasAside = items.length > 0 || Boolean(longCaption) || Boolean(label)

  return (
    <figure className={cn(figureVariants({ size }), className)}>
      <Zoom
        title={title}
        buttonClassName={enlarge === 'below' ? 'order-last' : undefined}
        large={picture('(min-width: 1024px) 66vw, 100vw')}
        aside={
          hasAside ? (
            <div className="flex flex-col gap-4">
              {label && (
                <Badge variant="neutral" className="self-start">
                  {label}
                </Badge>
              )}
              {longCaption && <Caption as="div">{longCaption}</Caption>}
              {items.length > 0 && (
                <Legend items={items} label={keyLabel} attach="none" columns="one" />
              )}
            </div>
          ) : undefined
        }
      >
        {picture(size === 'half-then-third' ? SMALL_SIZES_HALF_THEN_THIRD : SMALL_SIZES, priority)}
      </Zoom>
      {(label || caption) && (
        <figcaption className="mt-2 flex flex-col items-start gap-2">
          {label && <Badge variant="neutral">{label}</Badge>}
          {caption && <Caption as="div">{caption}</Caption>}
        </figcaption>
      )}
    </figure>
  )
}
