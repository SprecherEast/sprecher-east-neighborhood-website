import 'server-only'

import { headers } from 'next/headers'

import { ACCOUNTS_COLLECTION } from '@/platform/lib'
import { hasAdmin } from '@/platform/payload/roles'

import type { Viewer } from '../../domain/oauth/types'
import { getOAuthContext } from './context'

/**
 * The account signed in on this request, by Payload's own check of the session cookie, or null.
 * Only an account counts: an API key or OAuth token sent as a header never signs anyone in to
 * the consent page, because Payload's strategies would give it a non-account user.
 *
 * A request that began on another site never counts (the tool's link to the approval page, or a
 * form sent from there): since Payload 3.94 the session cookie is read on a cross-site navigation
 * too, so this check keeps the stricter rule the approval needs.
 */
export async function getViewer(): Promise<Viewer> {
  const { payload } = await getOAuthContext()
  const requestHeaders = await headers()
  if (requestHeaders.get('sec-fetch-site') === 'cross-site') return null
  const { user } = await payload.auth({ headers: requestHeaders })
  if (!user || user.collection !== ACCOUNTS_COLLECTION) return null
  return { id: Number(user.id), isAdmin: hasAdmin(user) }
}
