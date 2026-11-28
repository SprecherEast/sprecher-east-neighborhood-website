import 'server-only'

import { headers } from 'next/headers'

import { ACCOUNTS_COLLECTION, isFromAnotherSite } from '@/platform/lib'
import { hasAdmin } from '@/platform/payload/roles'

import type { Viewer } from '../../domain/oauth/types'
import { getOAuthContext } from './context'

/**
 * The account signed in on this request, by Payload's own check of the session cookie, or null.
 * Only an account counts: an API key or OAuth token sent as a header never signs anyone in to
 * the consent page, because Payload's strategies would give it a non-account user. A request from
 * another site never counts (`isFromAnotherSite`), so the approval is shown only on a visit from
 * this site, whatever Payload's own check accepts.
 */
export async function getViewer(): Promise<Viewer> {
  const requestHeaders = await headers()
  if (isFromAnotherSite(requestHeaders)) return null
  const { payload } = await getOAuthContext()
  const { user } = await payload.auth({ headers: requestHeaders })
  if (!user || user.collection !== ACCOUNTS_COLLECTION) return null
  return { id: Number(user.id), isAdmin: hasAdmin(user) }
}
