import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ConnectionNotice,
  ConnectionPage,
  ContinueCard,
  continueAuthorization,
} from '@/modules/agents/server'
import { privateAddressMetadata } from '@/platform/seo/privateAddress'

export const metadata: Metadata = privateAddressMetadata(
  'Connect an AI Tool',
  'Allow an AI tool to connect to the Sprecher East AI agent address.',
)

// The answer depends on the request, never on a cached page
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Where an AI tool sends the browser first (#1501), from its own site. A visit from another site
 * carries no session (Payload's CSRF check ignores the cookie there), so this page reads none and
 * shows nothing about any account: the request is checked, a request that can't be trusted is
 * explained here, one with an error goes back to the tool, and otherwise a link continues on the
 * site itself, at the approval page, which can see who is signed in.
 */
export default async function AuthorizePage({ searchParams }: Props) {
  const begun = await continueAuthorization(await searchParams, await headers())
  if (begun.kind === 'redirect') redirect(begun.url)

  return (
    <ConnectionPage title="Connect an AI Tool">
      {begun.kind === 'continue' ? (
        <ContinueCard view={begun} />
      ) : (
        <ConnectionNotice notice={begun} />
      )}
    </ConnectionPage>
  )
}
