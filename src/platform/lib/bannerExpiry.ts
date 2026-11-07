/**
 * Whether a banner's "show until" moment has passed (#814). It compares moments, not calendar
 * days, so the server's and the visitor's timezone can't shift it. No end time, or a value that
 * isn't a date, never expires: a typo must not hide content.
 */
export function isBannerExpired(showUntil: string | null | undefined, now: Date): boolean {
  if (!showUntil) return false
  const end = Date.parse(showUntil)
  if (Number.isNaN(end)) return false
  return now.getTime() >= end
}
