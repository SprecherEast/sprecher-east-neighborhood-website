/**
 * How often visitors may use the public account forms that send email: sign-up (#187) and forgot
 * password (#282). The same shape as the contact form's limits (decision 0004). Counted in memory,
 * since the site runs as one PM2 process.
 */
export type RequestLimits = {
  /** The sliding window every limit counts in. */
  readonly windowMs: number
  /** Requests per window from one connection (client IP), counted before the robot check. */
  readonly perConnection: number
  /**
   * Requests per window, site-wide, counted only once they pass the robot check, so blocked
   * attempts can't use it up. It bounds the email sent even if X-Forwarded-For is spoofed (#118).
   * Left out, nothing is counted site-wide: use that where the request is free to make, such as
   * the sign-in with a provider (a site-wide cap anyone can fill would switch it off for all).
   */
  readonly siteWide?: number
  /** Bounded memory: past this many connections, the oldest tracked one is forgotten. */
  readonly trackedConnections: number
}

const HOUR = 60 * 60 * 1000

/**
 * Sign-up (decision 0007): each one hashes a password on the one-CPU server and sends Payload's
 * verification email.
 */
export const SIGN_UP_LIMITS: RequestLimits = {
  windowMs: HOUR,
  perConnection: 5,
  siteWide: 20,
  trackedConnections: 2000,
}

/**
 * Starting and finishing a sign-in with a provider (#188), counted per connection, on both routes
 * alike. There is no site-wide limit and no robot check, on purpose: a site-wide cap that anyone
 * can fill (a script can fetch a valid flow cookie from `/auth/google` and replay it for its ten
 * minutes, since the server keeps no record of it) would switch Google sign-in off for every
 * neighbor. What remains: a botnet can still make many requests, each limited per connection, and
 * each costs at most one outbound call to the provider. A new account also counts against
 * `SIGN_UP_LIMITS`. More generous than sign-up, since a neighbor may try again or share a
 * connection and no email is sent.
 */
export const SOCIAL_SIGN_IN_LIMITS: RequestLimits = {
  windowMs: HOUR,
  perConnection: 30,
  trackedConnections: 2000,
}

/**
 * Forgot password (#282): each request can send a reset email. Payload also sends at most one
 * per account every 15 seconds.
 */
export const RESET_REQUEST_LIMITS: RequestLimits = {
  windowMs: HOUR,
  perConnection: 5,
  siteWide: 30,
  trackedConnections: 2000,
}
