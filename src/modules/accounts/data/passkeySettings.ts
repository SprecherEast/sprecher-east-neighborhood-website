import 'server-only'

import { getServerSideURL } from '@/platform/lib/getURL'

import { isPasskeySwitchOn, toRelyingParty, type RelyingParty } from '../domain/passkeys'

/**
 * The relying party passkeys use, or null when the feature is off (#1313, decision 0021). This is
 * the one place that reads the server setting `PASSKEYS_ENABLED`, which is off by default, and
 * the configured site address: both never come from a request. Null also when the address can't
 * be a relying party (a missing address that fell back to localhost in production, an IP address),
 * so a bad setting turns the feature off rather than on.
 */
export function getPasskeyRelyingParty(): RelyingParty | null {
  if (!isPasskeySwitchOn(process.env)) return null
  return toRelyingParty(getServerSideURL(), { production: process.env.NODE_ENV === 'production' })
}
