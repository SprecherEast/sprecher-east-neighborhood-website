/**
 * The review queue for suggested events and posts (#123): what a suggestion is, and the rules
 * that hold it until staff review it. Pure, so the CMS hook and its tests share one copy.
 */

/** Where a suggestion is in review. Empty for content staff write themselves. */
export const MODERATION_STATUSES = [
  { value: 'suggested', label: 'Suggested, waiting for review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const

export type ModerationStatus = (typeof MODERATION_STATUSES)[number]['value']

/** Who an event or post is for (#255). The collections' options too. */
export const AUDIENCES = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'families', label: 'Families' },
  { value: 'youth', label: 'Youth' },
  { value: 'seniors', label: 'Seniors' },
  { value: 'volunteers', label: 'Volunteers' },
  { value: 'association-leaders', label: 'Association and HOA leaders' },
] as const

export type Audience = (typeof AUDIENCES)[number]['value']

/** The fields the review queue reads and writes on a document. */
export type ReviewQueueData = {
  _status?: 'draft' | 'published' | null
  moderationStatus?: ModerationStatus | null
  sourceName?: string | null
  sourceUrl?: string | null
}

export type FieldProblem = { path: 'sourceName' | 'sourceUrl'; message: string }

/** True for an absolute http or https URL. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Trims a text value and turns a blank one into null, so blanks never collide in a unique index. */
export function blankToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * A create that doesn't come from staff: stored as an unpublished draft with status `suggested`,
 * whatever it sent, and it must name its source. Answers the data to store, or what's missing.
 */
export function toHeldSuggestion<T extends ReviewQueueData>(
  data: T,
): { data: T } | { problems: FieldProblem[] } {
  const problems: FieldProblem[] = []
  if (typeof blankToNull(data.sourceName) !== 'string') {
    problems.push({ path: 'sourceName', message: 'A suggestion needs the name of its source.' })
  }
  if (!isHttpUrl(data.sourceUrl)) {
    problems.push({ path: 'sourceUrl', message: 'A suggestion needs its source’s web address.' })
  }
  if (problems.length > 0) return { problems }
  return { data: { ...data, _status: 'draft', moderationStatus: 'suggested' } }
}

/** Publishing a suggestion is approving it, so it leaves the queue. */
export function approveOnPublish<T extends ReviewQueueData>(
  data: T,
  current?: ReviewQueueData | null,
): T {
  const status = data.moderationStatus ?? current?.moderationStatus
  if (data._status === 'published' && status === 'suggested') {
    return { ...data, moderationStatus: 'approved' }
  }
  return data
}
