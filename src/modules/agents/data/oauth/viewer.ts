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
 */
export async function getViewer(): Promise<Viewer> {
  const { payload } = await getOAuthContext()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== ACCOUNTS_COLLECTION) return null
  return { id: Number(user.id), isAdmin: hasAdmin(user) }
}
