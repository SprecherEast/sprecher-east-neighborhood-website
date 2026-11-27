import 'server-only'

import type { RawParams } from '../../domain/oauth/authorizeRequest'
import { approvePath } from '../../domain/oauth/approveLink'
import { signConsent, type ConsentRequest } from '../../domain/oauth/consent'
import type { Viewer } from '../../domain/oauth/types'
import { findAccountName, getOAuthContext } from '../../data/oauth/context'
import { checkAuthorization, type Checked } from './checkAuthorization'

export type ConsentView = {
  clientName: string
  /** Host and port of the address the sign-in returns to, shown so the admin can recognise it */
  redirectHost: string
  agentName: string | null
  request: ConsentRequest
  ticket: string
}

type Refusal = Exclude<Checked, { kind: 'ok' }>

export type Continuing =
  | Refusal
  | {
      kind: 'continue'
      clientName: string
      redirectHost: string
      /** The approval page, on this site, for exactly this request */
      next: string
    }

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
    clientName: checked.clientName,
    redirectHost: checked.redirectHost,
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
      clientName: checked.clientName,
      redirectHost: checked.redirectHost,
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
