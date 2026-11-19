import { CONFIRMATION_LINK_LIFETIME_MS } from '@/platform/lib'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * How confirmation links are limited (#183). Before the click, the confirmation link is the only
 * email the site sends to an address someone typed, so it is capped per connection, per address
 * and site-wide. Over any limit nothing is sent, and the person sees the same answer.
 */
export const CONFIRMATION_LIMITS = {
  /** How long a link works after it is sent. */
  linkLifetimeMs: CONFIRMATION_LINK_LIFETIME_MS,
  /** Confirmation emails per hour from one connection (client IP). */
  perConnection: 5,
  connectionWindowMs: HOUR,
  /** Confirmation emails to one address per day. */
  perAddress: 3,
  addressWindowMs: DAY,
  /** Confirmation emails per hour, site-wide: bounds Mailgun use even if X-Forwarded-For is spoofed (#118). */
  siteWide: 30,
  siteWideWindowMs: HOUR,
  /** Clicks on "Confirm my email" per hour from one connection. */
  confirmAttemptsPerConnection: 20,
} as const
