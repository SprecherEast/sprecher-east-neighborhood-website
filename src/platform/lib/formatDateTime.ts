import { SITE_TIMEZONE } from './timezone'

const DAY_ONLY_SUFFIX = 'T00:00:00.000Z'

/** True for Payload day-only dates, which are stored as midnight UTC. */
export function isDayOnly(timestamp: string): boolean {
  return timestamp.endsWith(DAY_ONLY_SUFFIX)
}

/**
 * Picks the correct timezone for formatting.
 * Day-only dates (stored as midnight UTC by Payload's dayOnly picker) must
 * be formatted in UTC so "2026-03-03T00:00:00.000Z" displays as Mar 3,
 * not Mar 2 (which is what the site timezone would show for midnight UTC).
 */
function resolveTimezone(timestamp: string): string {
  return isDayOnly(timestamp) ? 'UTC' : SITE_TIMEZONE
}

function yearIn(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', timeZone })
}

/**
 * Value for a `<time dateTime>` attribute. Day-only dates become a calendar
 * date ("2026-03-03"), because the stored midnight-UTC instant is the evening
 * before in Central Time. Real datetimes stay full ISO strings.
 */
export const toDateTimeAttr = (timestamp: string): string =>
  isDayOnly(timestamp) ? timestamp.slice(0, 10) : new Date(timestamp).toISOString()

export const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp)

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: resolveTimezone(timestamp),
  })
}

/**
 * Short date ("Mar 3"). Adds the year when it isn't the current year in the
 * site timezone ("Jul 25, 2024"), so old items don't read as recent.
 */
export const formatDateShort = (timestamp: string): string => {
  const date = new Date(timestamp)
  const timeZone = resolveTimezone(timestamp)
  const showYear = yearIn(date, timeZone) !== yearIn(new Date(), SITE_TIMEZONE)

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' } : {}),
    timeZone,
  })
}

export const formatDateBadge = (timestamp: string): { month: string; day: string } => {
  const date = new Date(timestamp)
  const tz = resolveTimezone(timestamp)

  return {
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: tz }),
    day: date.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz }),
  }
}

/** A calendar day without its weekday, such as "Nov 13", for tight spaces */
export const formatDayShort = (day: string): string =>
  new Date(`${day}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

/** A calendar day (`yyyy-mm-dd`) as "Fri, Nov 13". It is a day, not an instant, so no time zone moves it. */
export const formatDayLabel = (day: string): string =>
  new Date(`${day}T00:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
