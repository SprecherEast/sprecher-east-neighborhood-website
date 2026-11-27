import { createHmac, timingSafeEqual } from 'node:crypto'

import { OAUTH_LIFETIMES } from './constants'

/** What the admin is asked to approve: exactly the validated authorization request. */
export type ConsentRequest = {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  resource: string
  scope: string
}

type Context = { adminId: number; now: Date; secret: string }

/** One field per line is not enough alone: JSON of an array keeps field boundaries unambiguous. */
const mac = (request: ConsentRequest, expires: number, { adminId, secret }: Context): string =>
  createHmac('sha256', secret)
    .update(
      JSON.stringify([
        'consent-v1',
        adminId,
        expires,
        request.clientId,
        request.redirectUri,
        request.state,
        request.codeChallenge,
        request.resource,
        request.scope,
      ]),
    )
    .digest('base64url')

/**
 * The ticket the consent page carries to the button that approves (CSRF defence, #1501). It
 * signs the admin's account, the whole request shown on the page and an expiry, so a forged or
 * stale request, a changed request or another admin's ticket cannot be approved. It is no
 * substitute for the admin's own session, which the approval checks again.
 */
export function signConsent(request: ConsentRequest, context: Context): string {
  const expires = Math.floor(context.now.getTime() / 1000) + OAUTH_LIFETIMES.consentSeconds
  return `${expires}.${mac(request, expires, context)}`
}

export function verifyConsent(ticket: string, request: ConsentRequest, context: Context): boolean {
  const [expiry, signature, ...rest] = ticket.split('.')
  if (expiry === undefined || signature === undefined || rest.length > 0) return false
  if (!/^\d{1,12}$/.test(expiry)) return false
  const expires = Number(expiry)
  if (expires <= Math.floor(context.now.getTime() / 1000)) return false
  const given = Buffer.from(signature)
  const wanted = Buffer.from(mac(request, expires, context))
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}
