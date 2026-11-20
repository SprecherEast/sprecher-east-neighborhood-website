// When a person signed in (#1314, decision 0021): the start of the session their token names.
// Pure: the data layer reads the stored sessions and the token's session id.

/** A session Payload stores on an account: only what this rule reads. */
export type StoredSession = { id?: string | null; createdAt?: string | null }

/**
 * When the session with this id was started, or null when the token names none, no such session
 * is stored or its time can't be read. Payload moves only a session's `expiresAt` when it
 * refreshes a token, so `createdAt` is when the person signed in: staying signed in doesn't make
 * an old session look new. Null counts as not recent (`decideAddPasskey`).
 */
export function sessionStartedAt(
  sessions: readonly StoredSession[] | null | undefined,
  sessionId: unknown,
): Date | null {
  if (typeof sessionId !== 'string') return null
  const started = sessions?.find(({ id }) => id === sessionId)?.createdAt
  if (!started) return null
  const at = new Date(started)
  return Number.isNaN(at.getTime()) ? null : at
}

/**
 * How recent the session's sign-in must be to add a passkey or connect Google. The session's own start time counts,
 * so "keep me signed in" doesn't make an old session look new.
 */
export const RECENT_SIGN_IN_WINDOW_MS = 5 * 60 * 1000

/**
 * Whether a session that began at `signedInAt` still counts as a recent sign-in: the one rule for
 * every step that asks the person to have signed in lately (adding a passkey, connecting Google,
 * #1338). An unknown, unreadable or future time counts as not recent.
 */
export function isRecentSignIn(signedInAt: Date | null, now: Date): boolean {
  const age = signedInAt ? now.getTime() - signedInAt.getTime() : Number.NaN
  return age >= 0 && age <= RECENT_SIGN_IN_WINDOW_MS
}
