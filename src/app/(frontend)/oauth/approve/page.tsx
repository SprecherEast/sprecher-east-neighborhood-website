import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { RETURN_PARAM, SIGN_IN_PATH } from '@/modules/accounts'
import { CONNECTION_DESCRIPTION } from '@/modules/agents'
import {
  beginAuthorization,
  ConnectionNotice,
  ConnectionPage,
  type ConnectionPageProps,
  ConsentCard,
  getViewer,
} from '@/modules/agents/server'
import { privateAddressMetadata } from '@/platform/seo/privateAddress'

const TITLE = 'Approve an AI Tool'

export const metadata: Metadata = privateAddressMetadata(TITLE, CONNECTION_DESCRIPTION)

// The answer depends on the signed-in account and on the request, never on a cached page
export const dynamic = 'force-dynamic'

/**
 * Where an admin allows an AI tool in (#1501), reached from the first page (`/oauth/authorize`)
 * on this site, so the session is read as on any page. The request is checked again before
 * anything is asked: a request that can't be trusted is explained here, one with an error goes
 * back to the tool, a visitor is sent to log in and back to this same request, and only a
 * signed-in admin sees the approval. The accounts and agents modules meet here.
 */
export default async function ApprovePage({ searchParams }: ConnectionPageProps) {
  const begun = await beginAuthorization(await searchParams, await headers(), await getViewer())
  if (begun.kind === 'redirect') redirect(begun.url)
  const signInHref =
    begun.kind === 'sign-in-needed'
      ? `${SIGN_IN_PATH}?${RETURN_PARAM}=${encodeURIComponent(begun.returnTo)}`
      : SIGN_IN_PATH

  return (
    <ConnectionPage title={TITLE}>
      {begun.kind === 'consent' ? (
        <ConsentCard view={begun.view} />
      ) : (
        <ConnectionNotice notice={begun} signInHref={signInHref} />
      )}
    </ConnectionPage>
  )
}
