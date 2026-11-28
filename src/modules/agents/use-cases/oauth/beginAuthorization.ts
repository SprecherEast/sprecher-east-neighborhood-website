import 'server-only'

import type { RawParams } from '../../domain/oauth/authorizeRequest'
import { approvePath } from '../../domain/oauth/approveLink'
import { signConsent, type ConsentRequest } from '../../domain/oauth/consent'
import type { ClientFacts, Viewer } from '../../domain/oauth/types'
import { findAccountName, getOAuthContext } from '../../data/oauth/context'
import { checkAuthorization, type Checked } from './checkAuthorization'

export type ConsentView = ClientFacts & {
  agentName: string | null
  request: ConsentRequest
  ticket: string
}

/** Only the two facts of a checked request leave for a page, never the account or the request */
const clientFacts = ({ clientName, redirectHost }: ClientFacts): ClientFacts => ({
  clientName,
  redirectHost,
})

type Refusal = Exclude<Checked, { kind: 'ok' }>

export type Continuing =
  | Refusal
  | ({
      kind: 'continue'
      /** The approval page, on this site, for exactly this request */
      next: string
    } & ClientFacts)

export type Beginning =
  | Refusal
  | { kind: 'sign-in-needed'; returnTo: string }
  | { kind: 'admin-needed' }
  | { kind: 'consent'; view: ConsentView }

/**
 * The first page of a connection (#1501), reached from the AI tool's own site. The browser
 * withholds the session on such a visit (Payload ignores the sign-in cookie on a cross-site
 * navigation, as its CSRF protection means it to), so this page reads none and shows nothing about
 * any account: only who is asking, and a link that carries the checked request to the next page,
 * which is opened from this site and can see who is signed in.
 */
export async function continueAuthorization(
  params: RawParams,
  headers: Headers,
): Promise<Continuing> {
  const checked = await checkAuthorization(params, headers)
  if (checked.kind !== 'ok') return checked
  return {
    kind: 'continue',
    ...clientFacts(checked),
    next: approvePath(checked.request),
  }
}

/**
 * The approval page, opened from the first page on this site, so the session is read as for
 * any page: a visitor is asked to sign in and come back to this same request, only an admin is
 * shown the approval, and the request is checked again from scratch, never trusted for having
 * passed the first page.
 */
export async function beginAuthorization(
  params: RawParams,
  headers: Headers,
  viewer: Viewer,
): Promise<Beginning> {
  const checked = await checkAuthorization(params, headers)
  if (checked.kind !== 'ok') return checked
  if (!viewer) return { kind: 'sign-in-needed', returnTo: approvePath(checked.request) }
  if (!viewer.isAdmin) return { kind: 'admin-needed' }
  const { payload } = await getOAuthContext()
  return {
    kind: 'consent',
    view: {
      ...clientFacts(checked),
      agentName: await findAccountName(payload, checked.agentId),
      request: checked.request,
      ticket: signConsent(checked.request, {
        adminId: viewer.id,
        now: new Date(),
        secret: payload.secret,
      }),
    },
  }
}
