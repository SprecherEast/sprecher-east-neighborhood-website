import { isExpired } from '../scopes'
import type { OAuthClient } from './types'

/** Whether a registered client may sign in or hold tokens now: switched on and not past its expiry. */
export function clientIsOn<T extends Pick<OAuthClient, 'enabled' | 'expiresAt'>>(
  client: T | null,
  now: Date,
): client is T {
  return client !== null && client.enabled && !isExpired(client.expiresAt, now)
}
