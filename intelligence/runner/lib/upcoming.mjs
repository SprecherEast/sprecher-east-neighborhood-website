import { dateIn } from './time.mjs'

// The low-water mark (#995, pipeline.yaml `lowWater`): how many upcoming events the site shows at
// the end of a run. Code only, no model; a failure to count never fails the run.

/**
 * Counts the published upcoming events, up to the mark. `low` is true under the mark, false at or
 * above it, and null when the site couldn't say (no key in a dry run, or the find tool failed:
 * then `error` says why). The count is exact up to the mark and stops there.
 */
export async function checkUpcomingEvents({ cms, mark, today = dateIn(new Date()) }) {
  try {
    const count = await cms.upcomingEvents({ today, limit: mark })
    if (count === null || count === undefined) return { count: null, mark, low: null }
    return { count, mark, low: count < mark }
  } catch (error) {
    return { count: null, mark, low: null, error: String(error.message ?? error).slice(0, 300) }
  }
}

/** The sentence for the run log when the list is low; null when it isn't, or isn't known. */
export function lowEventsWarning({ count, mark, low }) {
  if (!low) return null
  const noun = count === 1 ? 'upcoming event' : 'upcoming events'
  return `Low events: ${count} ${noun} published, under the mark of ${mark}. Look for more to suggest.`
}
