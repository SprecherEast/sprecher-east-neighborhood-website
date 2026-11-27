import { NO_STORE_HEADERS } from './constants'

/** What the token address answers: a status, the headers that go with it and a JSON body. */
export type TokenAnswer = { status: number; headers: Record<string, string>; body: unknown }

/**
 * An error answer of the token address (RFC 6749 section 5.2), written once: the route's early
 * refusals and the exchange both build theirs here, never cached.
 */
export const tokenError = (status: number, error: string, description: string): TokenAnswer => ({
  status,
  headers: NO_STORE_HEADERS,
  body: { error, error_description: description },
})
