/**
 * How long "Keep me signed in" keeps a browser signed in (#587): the token, the stored session and
 * the cookie. The label on the sign-in form says it with `formatDuration()` from this value.
 * Without the box, a sign-in lasts what Payload's `auth.tokenExpiration` default gives (two hours).
 */
export const REMEMBER_ME_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
