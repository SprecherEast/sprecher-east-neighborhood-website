// How long the site keeps what people send through its public forms: the owner's decision on #274
// (2026-10-24). One place, because two modules apply it: `contact` to its messages, and
// `verification` to the addresses it confirms.

const HOUR = 60 * 60 * 1000

export const RETENTION = {
  /**
   * A message, or an address, that was never confirmed is deleted this long after its link was
   * sent. Longer than the link's own lifetime (`CONFIRMATION_LINK_LIFETIME_MS`), so a link never outlives its record.
   */
  unconfirmedMs: 48 * HOUR,
  /** A confirmed sender's contact details are deleted this many months after their last message. */
  confirmedMonths: 12,
} as const

/** Unconfirmed things from before this moment (an ISO date) are deleted. */
export const toUnconfirmedCutoff = (now: number): string =>
  new Date(now - RETENTION.unconfirmedMs).toISOString()

/**
 * Confirmed contact details whose last message is from before this moment (an ISO date) are
 * deleted. Calendar months, in UTC: 12 months before 2026-10-24T12:00Z is 2025-10-24T12:00Z.
 * From February 29 it is March 1 of the year before, the day after February 28.
 */
export function toConfirmedCutoff(now: number): string {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION.confirmedMonths)
  return cutoff.toISOString()
}
