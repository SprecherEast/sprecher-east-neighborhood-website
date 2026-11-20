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
