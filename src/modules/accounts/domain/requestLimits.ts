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

/**
 * Asking for the options to add a passkey (#1314), counted per connection and, in
 * `PASSKEY_OPTIONS_PER_ACCOUNT_LIMITS`, per account. There is no site-wide limit, on purpose: any
 * verified account with a fresh sign-in can ask, so a site-wide cap could be filled by a few
 * accounts and would switch adding a passkey off for every neighbor (the same reason as
 * `SOCIAL_SIGN_IN_LIMITS`). Each request stores one challenge row, so the per-account count bounds
 * what one account can store. No robot check: only a signed-in account gets this far. More
 * generous than sign-up, since a neighbor may need a few tries on a phone and no email is sent.
 */
export const PASSKEY_OPTIONS_LIMITS: RequestLimits = {
  windowMs: HOUR,
  perConnection: 10,
  trackedConnections: 2000,
}

/** One account's options requests an hour, however many connections it uses. */
export const PASSKEY_OPTIONS_PER_ACCOUNT_LIMITS: RequestLimits = {
  windowMs: HOUR,
  perConnection: 10,
  trackedConnections: 2000,
}

/**
 * Asking for the options to sign in with a passkey (#1315, decision 0021), per connection and
 * site-wide. Each request stores one challenge row, which the hourly retention run removes, so the
 * site-wide count bounds what anyone can store. No robot check: the answer needs a real
 * authenticator holding a registered key, so guessing gains nothing, and the limits only keep
 * challenge requests from piling up. The trade-off the decision accepts: a script can fill the
 * site-wide count and switch passkey sign-in off for an hour, which leaves the email and password
 * and Google ways in as they were. Generous per connection, since the login page asks once as it
 * opens (for the email field's autofill) and once more for the button.
 */
export const PASSKEY_SIGN_IN_LIMITS: RequestLimits = {
  windowMs: HOUR,
  perConnection: 30,
  siteWide: 600,
  trackedConnections: 2000,
}
