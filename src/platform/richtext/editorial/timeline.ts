import type { ResolvedLink } from '@/platform/lib'
import type { TimelineBlock as StoredTimeline } from '@/payload-types'

import { toEditorialLink } from './editorialLink'
import { isTimelineStatus, type TimelineStatus } from './timelineStatus'

/** One milestone, as the timeline draws it. */
export type TimelineEntry = {
  date: string
  title: string
  description: string | null
  status: TimelineStatus
  link: ResolvedLink | null
}

/** The timeline block's props: plain data, so it renders without a CMS (decision 0013). */
export type TimelineProps = {
  entries: TimelineEntry[]
}

/**
 * The stored block as the timeline's props. Entries without a title are dropped, an unknown
 * status reads as `later` (the least certain claim), and an invalid link is left out.
 */
export function toTimelineProps(stored: Pick<StoredTimeline, 'entries'>): TimelineProps {
  const entries = (stored.entries ?? []).flatMap((entry): TimelineEntry[] => {
    const title = entry.title?.trim()
    if (!title) return []
    return [
      {
        date: entry.date?.trim() ?? '',
        title,
        description: entry.description?.trim() || null,
        status: isTimelineStatus(entry.status) ? entry.status : 'later',
        link: toEditorialLink(entry.linkUrl, entry.linkLabel),
      },
    ]
  })
  return { entries }
}
