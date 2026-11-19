import { ArrowRight, Check, CircleDashed, Clock } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Badge, type BadgeProps } from '@/platform/ui/Badge'
import { Link } from '@/platform/ui/Link'

import type { TimelineEntry, TimelineProps } from './timeline'
import { TIMELINE_STATUS_LABELS, type TimelineStatus } from './timelineStatus'

/**
 * Milestones on a vertical line, oldest first (#507), following the MOJ and DWP timeline: the
 * date leads each entry beside its marker. A milestone's status shows three ways: the marker's
 * shape (filled, ringed, dashed, hollow), the line to it (solid once reached, dashed ahead) and
 * a labelled badge, so it reads without colour. The markers and line are decoration; the list,
 * dates, titles and badges carry the meaning for screen readers.
 */
export function Timeline({ entries, className }: TimelineProps & { className?: string }) {
  if (entries.length === 0) return null
  // Only one step can be the reader's "you are here", even if an editor marked two
  const current = entries.findIndex((entry) => entry.status === 'next')
  return (
    // `role="list"`: Safari drops list semantics from a list without bullets
    <ol role="list" className={cn('not-prose my-8 w-full', className)}>
      {entries.map((entry, index) => (
        <TimelineItem
          key={`${index}-${entry.title}`}
          entry={entry}
          isCurrent={index === current}
          // The line runs down to the next milestone: solid when that one has happened
          lineToNext={index < entries.length - 1 ? lineStyle(entries[index + 1].status) : null}
        />
      ))}
    </ol>
  )
}

type LineStyle = 'reached' | 'ahead'

const lineStyle = (nextStatus: TimelineStatus): LineStyle =>
  nextStatus === 'done' ? 'reached' : 'ahead'

function TimelineItem({
  entry,
  isCurrent,
  lineToNext,
}: {
  entry: TimelineEntry
  isCurrent: boolean
  lineToNext: LineStyle | null
}) {
  return (
    <li
      className={cn('relative pl-10', lineToNext && 'pb-8')}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {lineToNext && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-7 bottom-1 left-3 -ml-px border-l-2',
            lineToNext === 'reached'
              ? 'border-primary'
              : 'border-dashed border-muted-foreground/60',
          )}
        />
      )}
      <Marker status={entry.status} />
      {entry.date && (
        <p className="text-sm leading-6 font-medium text-muted-foreground">{entry.date}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-lg leading-snug font-semibold text-pretty text-foreground">
          {entry.title}
        </h3>
        <StatusBadge status={entry.status} />
      </div>
      {entry.description && (
        <p className="mt-1 max-w-prose text-base leading-relaxed text-foreground">
          {entry.description}
        </p>
      )}
      {entry.link && (
        <p className="mt-2 text-base">
          <Link href={entry.link.href} external={entry.link.external}>
            {entry.link.label}
          </Link>
        </p>
      )}
    </li>
  )
}

const MARKER: Record<TimelineStatus, string> = {
  done: 'bg-primary-fill text-primary-foreground',
  next: 'border-4 border-primary-fill bg-background ring-4 ring-primary/20',
  conditional: 'border-2 border-dashed border-warning-strong bg-background',
  later: 'border-2 border-muted-foreground bg-background',
}

function Marker({ status }: { status: TimelineStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-0 left-0 flex size-6 items-center justify-center rounded-full',
        MARKER[status],
      )}
    >
      {status === 'done' && <Check className="size-4" strokeWidth={3} />}
    </span>
  )
}

const BADGE: Record<TimelineStatus, { variant: BadgeProps['variant']; Icon: typeof Check }> = {
  done: { variant: 'category', Icon: Check },
  next: { variant: 'current', Icon: ArrowRight },
  conditional: { variant: 'caution', Icon: CircleDashed },
  later: { variant: 'neutral', Icon: Clock },
}

function StatusBadge({ status }: { status: TimelineStatus }) {
  const { variant, Icon } = BADGE[status]
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {TIMELINE_STATUS_LABELS[status]}
    </Badge>
  )
}
