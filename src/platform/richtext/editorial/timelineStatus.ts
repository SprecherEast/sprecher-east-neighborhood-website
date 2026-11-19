/**
 * Where a milestone stands, for the timeline block (#507). Each status is drawn with a dot shape,
 * a connector style and a word, so colour is never the only signal (WCAG 1.4.1).
 *
 * - `done`: it happened.
 * - `next`: the next thing on the calendar, the reader's "you are here".
 * - `conditional`: it happens only if something else does, and may never happen.
 * - `later`: expected further out, with no firm date.
 */
export const TIMELINE_STATUSES = ['done', 'next', 'conditional', 'later'] as const

export type TimelineStatus = (typeof TIMELINE_STATUSES)[number]

/** The word a reader sees beside the milestone. */
export const TIMELINE_STATUS_LABELS: Record<TimelineStatus, string> = {
  done: 'Done',
  next: 'Next up',
  conditional: 'Depends',
  later: 'Later',
}

/** The choice an editor sees, with what each one means. */
export const TIMELINE_STATUS_OPTIONS = [
  { label: 'Done: it happened', value: 'done' },
  { label: 'Next up: the next date on the calendar', value: 'next' },
  { label: 'Depends: only happens if something else does', value: 'conditional' },
  { label: 'Later: expected, no firm date', value: 'later' },
] satisfies { label: string; value: TimelineStatus }[]

export function isTimelineStatus(value: unknown): value is TimelineStatus {
  return (TIMELINE_STATUSES as readonly unknown[]).includes(value)
}

/** At most one milestone is "Next up": it is the reader's "you are here" */
export const NEXT_UP_MESSAGE = 'Mark only one milestone as "Next up".'

/** True when more than one of the statuses is `next` */
export const hasTooManyNextUp = (statuses: Iterable<unknown>): boolean =>
  [...statuses].filter((status) => status === 'next').length > 1
