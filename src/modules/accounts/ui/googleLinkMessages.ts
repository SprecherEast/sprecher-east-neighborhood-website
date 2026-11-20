import { message } from '@/platform/lib'

import type { LinkResult } from '../domain/googleLink'
import { GUARD_MESSAGES } from './guardMessages'

/** What the Connect Google card says about how a connect ended: a tone and a fixed text. */
export type LinkNotice = {
  tone: 'success' | 'warning' | 'error'
  text: string
  /** Whether the card offers "Log in again": an old sign-in can only be fixed by logging in */
  logInAgain: boolean
}

/**
 * The fixed message for each way connecting Google from `/account` can end (#1338), never
 * Google's text. An old sign-in is a warning, not an error: the person only needs to log in again.
 */
export const LINK_RESULT_NOTICES: Record<LinkResult, LinkNotice> = {
  linked: { tone: 'success', text: message('accounts.google.linked'), logInAgain: false },
  taken: { tone: 'error', text: message('accounts.google.taken'), logInAgain: false },
  'sign-in-again': {
    tone: 'warning',
    text: message('accounts.google.signInAgain'),
    logInAgain: true,
  },
  failed: { tone: 'error', text: message('accounts.google.failed'), logInAgain: false },
  'too-many': { tone: 'error', text: GUARD_MESSAGES['too-many'], logInAgain: false },
}

/** A `?social=` value from the address as a notice, or null when it isn't one of ours. */
export function parseLinkResult(value: unknown): LinkNotice | null {
  return typeof value === 'string' && Object.hasOwn(LINK_RESULT_NOTICES, value)
    ? LINK_RESULT_NOTICES[value as LinkResult]
    : null
}
