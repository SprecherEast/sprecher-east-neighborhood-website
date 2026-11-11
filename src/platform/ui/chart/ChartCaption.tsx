import React from 'react'

import type { Certainty } from '@/platform/lib/certainty'
import { Caption } from '@/platform/ui/Caption'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Link } from '@/platform/ui/Link'

export type ChartCaptionProps = {
  /** What a unit or a scale means, one sentence each */
  notes: readonly string[]
  finePrint?: string
  /** When the figures are from */
  asOf?: string
  sources?: readonly { label: string; href: string }[]
  certainty?: Certainty
  className?: string
}

/** Whether there is anything to put under the drawing: an empty caption would only leave a gap */
export function hasCaption({ notes, finePrint, asOf, sources, certainty }: ChartCaptionProps) {
  return Boolean(notes.length > 0 || finePrint || asOf || sources?.length || certainty)
}

/**
 * What a unit means, when the figures are from, where they came from and how sure we are: the text
 * under a chart's drawing. It takes plain parts, not the spec, so a chart drawn in the browser (a
 * breakdown scaled to a reader's home) writes the same caption without the spec's rules.
 */
export function ChartCaption({
  notes,
  finePrint,
  asOf,
  sources,
  certainty,
  className,
}: ChartCaptionProps) {
  return (
    <Caption as="figcaption" finePrint={finePrint} className={className}>
      {notes.length > 0 && <span className="block">{notes.join(' ')}</span>}
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {asOf && <span>{asOf}</span>}
        {sources?.map((source) => (
          <Link
            key={source.href}
            href={source.href}
            external={source.href.startsWith('http')}
            variant="caption"
          >
            {source.label}
          </Link>
        ))}
        {certainty && <CertaintyBadge certainty={certainty} />}
      </span>
    </Caption>
  )
}
